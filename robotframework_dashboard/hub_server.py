from fastapi_offline import FastAPIOffline
from fastapi import Depends, HTTPException, status
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from pydantic import BaseModel
from uvicorn import run
from secrets import compare_digest
from datetime import datetime
from typing import Optional

from .hub_generator import HubGenerator
from .hub_sources import load_sources, merge_cli_sources_into_file, add_source, remove_source
from .version import __version__


class HubServer:
    """
    Robot Framework Dashboard Hub Server.

    Serves a self-contained hub HTML page that aggregates pass-rate
    data from one or more DB files or running dashboard server URLs.
    """

    def __init__(
        self,
        hub_host: str,
        hub_port: int,
        hub_user: str,
        hub_pass: str,
        sources: list,
        offline_dependencies: bool,
        hub_title: str,
        sources_file: str = "hub_sources.json",
        ssl_certfile: str = None,
        ssl_keyfile: str = None,
    ):
        """Initialise the FastAPI app and register all routes."""
        self.app = FastAPIOffline(
            title="Robot Framework Dashboard Hub", version=__version__
        )
        self.security = HTTPBasic()
        self.hub_host = hub_host
        self.hub_port = hub_port
        self.hub_user = hub_user
        self.hub_pass = hub_pass
        self.offline = offline_dependencies
        self.hub_title = hub_title
        self.sources_file = sources_file
        self.ssl_certfile = ssl_certfile
        self.ssl_keyfile = ssl_keyfile

        # Merge CLI-supplied sources into the persistent JSON file, then load the
        # combined list so that sources from previous runs are also included.
        self.sources = merge_cli_sources_into_file(sources, path=self.sources_file)

        self._hub_html: str = ""
        self._setup_routes()

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _generate(self) -> str:
        """Regenerate the hub HTML from the current sources and cache it."""
        generator = HubGenerator()
        projects_data = generator.get_projects_data(self.sources)
        hub_name = "robot_hub.html"
        generator.generate_hub(
            hub_name=hub_name,
            projects_data=projects_data,
            generation_datetime=datetime.now(),
            offline=self.offline,
            hub_title=self.hub_title,
            is_server=True,
        )
        with open(hub_name, "r", encoding="utf-8") as fh:
            self._hub_html = fh.read()
        return self._hub_html

    # ------------------------------------------------------------------
    # Routes
    # ------------------------------------------------------------------

    def _setup_routes(self):
        def authenticate(credentials: HTTPBasicCredentials = Depends(self.security)):
            if not self.hub_user or not self.hub_pass:  # pragma: no cover
                return "anonymous"  # pragma: no cover
            correct_username = compare_digest(credentials.username, self.hub_user)
            correct_password = compare_digest(credentials.password, self.hub_pass)
            if not (correct_username and correct_password):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid authentication credentials",
                    headers={"WWW-Authenticate": "Basic"},
                )
            return credentials.username

        # ---- Pydantic request models ----

        class AddSourceRequest(BaseModel):
            source: str
            label: Optional[str] = None
            source_type: Optional[str] = None

        class RemoveSourceRequest(BaseModel):
            source: str

        # ---- shared helpers (used by both auth and no-auth variants) ----

        def _do_refresh():
            try:
                self._generate()
                return {"success": "1", "message": "Hub refreshed successfully."}
            except Exception as exc:
                return {"success": "0", "message": f"ERROR: {exc}"}

        def _do_add_source(body):
            source_type = body.source_type or (
                "url" if body.source.startswith("http") else "db"
            )
            self.sources = add_source(
                body.source, body.label or body.source, source_type,
                path=self.sources_file,
            )
            self._generate()
            return {"success": "1", "message": f"Source '{body.source}' added."}

        def _do_remove_source(body):
            self.sources = remove_source(body.source, path=self.sources_file)
            self._generate()
            return {"success": "1", "message": f"Source '{body.source}' removed."}

        def _do_list_sources():
            return JSONResponse(content={"sources": self.sources})

        if not self.hub_user or not self.hub_pass:

            @self.app.get("/", response_class=HTMLResponse, include_in_schema=False)
            async def hub_page():
                """Serve the hub HTML page."""
                return self._hub_html or self._generate()

            @self.app.post("/refresh-hub")
            async def refresh_hub():
                """Regenerate the hub HTML from all sources."""
                return _do_refresh()

            @self.app.get("/hub-sources")
            async def list_sources():
                """Return the list of configured data sources."""
                return _do_list_sources()

            @self.app.post("/add-hub-source")
            async def add_hub_source(body: AddSourceRequest):
                """Add a new data source, persist it, and regenerate the hub."""
                try:
                    return _do_add_source(body)
                except Exception as exc:
                    return {"success": "0", "message": f"ERROR: {exc}"}

            @self.app.post("/remove-hub-source")
            async def remove_hub_source(body: RemoveSourceRequest):
                """Remove a data source, persist the change, and regenerate the hub."""
                try:
                    return _do_remove_source(body)
                except Exception as exc:
                    return {"success": "0", "message": f"ERROR: {exc}"}

        else:

            @self.app.get("/", response_class=HTMLResponse, include_in_schema=False)
            async def hub_page_auth(username: str = Depends(authenticate)):
                """Serve the hub HTML page (authenticated)."""
                return self._hub_html or self._generate()

            @self.app.post("/refresh-hub")
            async def refresh_hub_auth(username: str = Depends(authenticate)):
                """Regenerate the hub HTML from all sources (authenticated)."""
                return _do_refresh()

            @self.app.get("/hub-sources")
            async def list_sources_auth(username: str = Depends(authenticate)):
                """Return the list of configured data sources (authenticated)."""
                return _do_list_sources()

            @self.app.post("/add-hub-source")
            async def add_hub_source_auth(body: AddSourceRequest, username: str = Depends(authenticate)):
                """Add a new data source, persist it, and regenerate the hub (authenticated)."""
                try:
                    return _do_add_source(body)
                except Exception as exc:
                    return {"success": "0", "message": f"ERROR: {exc}"}

            @self.app.post("/remove-hub-source")
            async def remove_hub_source_auth(body: RemoveSourceRequest, username: str = Depends(authenticate)):
                """Remove a data source, persist the change, and regenerate the hub (authenticated)."""
                try:
                    return _do_remove_source(body)
                except Exception as exc:
                    return {"success": "0", "message": f"ERROR: {exc}"}

    # ------------------------------------------------------------------
    # Entry point
    # ------------------------------------------------------------------

    def start(self):  # pragma: no cover
        """Generate the initial hub HTML and start the uvicorn server."""
        _sep = "======================================================================================"
        print(" 2. Generating initial hub HTML")
        self._generate()
        print(f"  Created 'robot_hub.html'")
        print(_sep)
        print(" 3. Starting hub server")
        print(f"  Running at http://{self.hub_host}:{self.hub_port}")
        print(_sep)
        run(
            self.app,
            host=self.hub_host,
            port=self.hub_port,
            ssl_certfile=self.ssl_certfile,
            ssl_keyfile=self.ssl_keyfile,
        )
