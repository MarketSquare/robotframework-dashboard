from fastapi_offline import FastAPIOffline
from fastapi import Depends, HTTPException, status
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from uvicorn import run

from os.path import join, abspath, dirname
from pathlib import Path
from typing import Optional
from secrets import compare_digest

from .robotdashboard import RobotDashboard
from .dependencies import DependencyProcessor

# re-exported so 'from robotframework_dashboard.server import ResponseMessage' keeps working
from .server_models import (
    AddLog,
    AddOutput,
    GetLog,
    GetOutput,
    RemoveLog,
    RemoveOutputs,
    ResponseMessage,
)
from .server_routes_logs import register_log_routes
from .server_routes_outputs import register_output_routes
from .version import __version__


class ApiServer:
    """Robot Dashboard server implementation, this class handles the admin page and all functions related to the server"""

    def __init__(
        self,
        server_host: str,
        server_port: int,
        server_user: str,
        server_pass: str,
        offline_dependencies: bool,
        no_autoupdate: bool = False,
        ssl_certfile: str = None,
        ssl_keyfile: str = None,
    ):
        """Init function that starts up the fastapi app and initializes all the vars and endpoints"""
        self.app = FastAPIOffline(
            title="Robot Framework Dashboard Server", version=__version__
        )
        self.security = HTTPBasic(auto_error=False)
        self.robotdashboard: RobotDashboard
        self.server_host = server_host
        self.server_port = server_port
        self.server_user = server_user
        self.server_pass = server_pass
        self.offline = offline_dependencies
        self.no_autoupdate = no_autoupdate
        self.ssl_certfile = ssl_certfile
        self.ssl_keyfile = ssl_keyfile
        self.log_dir = "robot_logs"
        self.latest_log_dir = None

        self._setup_routes()
        self._setup_catch_all_route()

    def _get_admin_page(self):
        admin_file = join(dirname(abspath(__file__)), "./templates", "admin.html")
        with open(admin_file, "r", encoding="utf-8") as _f:
            admin_html = _f.read()
        admin_html = admin_html.replace(
            "<!-- placeholder_refresh_card_visibility -->",
            "" if self.no_autoupdate else "hidden",
        )
        admin_html = admin_html.replace(
            "<!-- placeholder_noautoupdate -->",
            "true" if self.no_autoupdate else "false",
        )
        dependency_processor = DependencyProcessor(admin_page=True)
        admin_html = admin_html.replace(
            "<!-- placeholder_javascript -->", dependency_processor.get_js_block()
        )
        admin_html = admin_html.replace(
            "<!-- placeholder_css -->", dependency_processor.get_css_block()
        )
        admin_html = admin_html.replace(
            "<!-- placeholder_dependencies -->",
            dependency_processor.get_dependencies_block(self.offline),
        )
        admin_html = admin_html.replace('"placeholder_version"', __version__)
        return admin_html

    def _authenticate(self, credentials: Optional[HTTPBasicCredentials]):
        if not self.server_user or not self.server_pass:
            return "anonymous"
        if credentials is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Not authenticated",
                headers={"WWW-Authenticate": "Basic"},
            )
        correct_username = compare_digest(credentials.username, self.server_user)
        correct_password = compare_digest(credentials.password, self.server_pass)
        if not (correct_username and correct_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
                headers={"WWW-Authenticate": "Basic"},
            )
        return credentials.username

    def _setup_routes(self):
        """Register the HTML serving routes, then hand the output and log routes to their own modules"""

        def authenticate(
            credentials: Optional[HTTPBasicCredentials] = Depends(self.security),
        ):
            return self._authenticate(credentials)

        if not self.server_user or not self.server_pass:

            @self.app.get("/admin", response_class=HTMLResponse, include_in_schema=False)
            async def admin_page():
                """Admin page endpoint function"""
                return self._get_admin_page()

        else:

            @self.app.get("/admin", response_class=HTMLResponse, include_in_schema=False)
            async def admin_page(username: str = Depends(authenticate)):
                """Admin page endpoint function"""
                return self._get_admin_page()

        @self.app.get(
            "/", response_class=HTMLResponse, include_in_schema=False
        )
        async def dashboard_page():
            """Serve robotdashboard HTML endpoint function"""
            with open("robot_dashboard.html", "r", encoding="utf-8") as _f:
                robot_dashboard_html = _f.read()
            return robot_dashboard_html

        @self.app.post("/refresh-dashboard")
        async def refresh_dashboard(username: str = Depends(authenticate)) -> ResponseMessage:
            """Manually trigger regeneration of the dashboard HTML"""
            console = "no console output"
            try:
                console = self.robotdashboard.create_dashboard()
                response = {
                    "success": "1",
                    "message": "SUCCESS: Dashboard refreshed successfully!",
                    "console": console,
                }
            except Exception as error:
                message = f"Something went wrong while refreshing the dashboard, ERROR: {error}"
                response = {"success": "0", "message": message, "console": console}
            return response

        # stays next to the catch-all route below: it is the only place latest_log_dir is set
        @self.app.get("/log", response_class=HTMLResponse, include_in_schema=False)
        async def log_page(path: str):
            """Serve log HTML and store the log directory for resources."""
            try:
                log_path = Path(path).resolve()
                log_html = log_path.read_text(encoding="utf-8")
                self.latest_log_dir = log_path.parent

            except Exception:
                log_html = f"""<!DOCTYPE html>
                    <html lang="en">
                        <head><meta charset="UTF-8"><title>404 - File Not Found</title></head>
                        <body>
                            <h1>404 - File Not Found</h1>
                            <p>The file you are looking for ({path}) could not be found on the server!</p>
                        </body>
                    </html>
                """
            return HTMLResponse(content=log_html)

        register_output_routes(self, authenticate)
        register_log_routes(self, authenticate)

    def _setup_catch_all_route(self):
        """Catch-all route for any resource after all other routes
        This will try to resolve based on screenshots that are relative to the log files
        If it doesn't find any matching file nothing will happen"""

        @self.app.get("/{full_path:path}", include_in_schema=False)
        async def catch_all(full_path: str):
            if self.latest_log_dir is None:
                raise HTTPException(404, "No log file opened yet")

            resource_path = (self.latest_log_dir / full_path).resolve()
            if not str(resource_path).startswith(str(self.latest_log_dir)):
                raise HTTPException(403, "Access denied")

            if not resource_path.exists():
                raise HTTPException(404, f"Resource {full_path} not found")

            return FileResponse(resource_path)

    def set_robotdashboard(self, robotdashboard: RobotDashboard):
        """Function to initialize the RobotDashboard class"""
        self.robotdashboard = robotdashboard

    def run(self):  # pragma: no cover
        """Function to start up the FastAPI server through uvicorn"""
        run(
            self.app,
            host=self.server_host,
            port=self.server_port,
            ssl_certfile=self.ssl_certfile,
            ssl_keyfile=self.ssl_keyfile,
        )
