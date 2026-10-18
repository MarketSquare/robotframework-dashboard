from re import sub, compile, MULTILINE, DOTALL
from os.path import dirname, abspath, join, normpath, relpath, basename
from pathlib import Path

DEPENDENCIES = {
    "chartjs": {
        "type": "js",
        # pinned below 4.5.1: its retinaScale rounds the canvas size to 0.1px but a canvas attribute
        # is an integer, so every responsive resize check reports a change and fires a zero-duration
        # update('resize') that cancels the draw animation of charts in fractional-width GridStack cells
        # (chartjs/Chart.js#12256, fixed on master by #12142 but not released yet)
        "cdn": "https://cdn.jsdelivr.net/npm/chart.js@4.5.0/dist/chart.umd.min.js",
        "local": "dependencies/chart.js",
        "admin_page": False,
    },
    "datalabels": {
        "type": "js",
        "cdn": "https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0",
        "local": "dependencies/chartjs-plugin-datalabels.js",
        "admin_page": False,
    },
    "adapter_date_fns": {
        "type": "js",
        "cdn": "https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns@3.0.0/dist/chartjs-adapter-date-fns.bundle.min.js",
        "local": "dependencies/chartjs-adapter-date-fns.js",
        "admin_page": False,
    },
    "boxplot": {
        "type": "js",
        "cdn": "https://cdn.jsdelivr.net/npm/@sgratzl/chartjs-chart-boxplot@4.4.5/build/index.umd.min.js",
        "local": "dependencies/chartjs-chart-boxplot.js",
        "admin_page": False,
    },
    "matrix": {
        "type": "js",
        "cdn": "https://cdn.jsdelivr.net/npm/chartjs-chart-matrix@3.1.0/dist/chartjs-chart-matrix.min.js",
        "local": "dependencies/chartjs-chart-matrix.js",
        "admin_page": False,
    },
    "gridstack_css": {
        "type": "css",
        "cdn": "https://cdn.jsdelivr.net/npm/gridstack@13.3.0/dist/gridstack.min.css",
        "local": "dependencies/gridstack.css",
        "admin_page": False,
    },
    "gridstack_js": {
        "type": "js",
        "cdn": "https://cdn.jsdelivr.net/npm/gridstack@13.3.0/dist/gridstack-all.min.js",
        "local": "dependencies/gridstack.js",
        "admin_page": False,
    },
    "bootstrap_css": {
        "type": "css",
        "cdn": "https://cdnjs.cloudflare.com/ajax/libs/twitter-bootstrap/5.3.8/css/bootstrap.min.css",
        "local": "dependencies/bootstrap.css",
        "admin_page": True,
    },
    "datatables_css": {
        "type": "css",
        "cdn": "https://cdn.datatables.net/v/bs5/dt-3.0.4/datatables.min.css",
        "local": "dependencies/datatables.css",
        "admin_page": True,
    },
    "bootstrap_js": {
        "type": "js",
        "cdn": "https://cdnjs.cloudflare.com/ajax/libs/twitter-bootstrap/5.3.8/js/bootstrap.bundle.min.js",
        "local": "dependencies/bootstrap.js",
        "admin_page": True,
    },
    "datatables_js": {
        "type": "js",
        "cdn": "https://cdn.datatables.net/v/bs5/dt-3.0.4/datatables.min.js",
        "local": "dependencies/datatables.js",
        "admin_page": True,
    },
}


# key -> (signature of the source files, built block)
_block_cache = {}


def _cached_block(key, paths, build):
    """Return the block built from paths, rebuilding it only when a file was added, removed or changed,
    so a server that regenerates the dashboard on every upload does not re-read and re-bundle every file"""
    signature = tuple((str(path), path.stat().st_mtime_ns, path.stat().st_size) for path in paths)
    cached = _block_cache.get(key)
    if cached and cached[0] == signature:
        return cached[1]
    block = build()
    _block_cache[key] = (signature, block)
    return block


class DependencyProcessor():
    def __init__(self, admin_page: bool = False):
        self.admin_page = admin_page

    def get_js_block(self):
        js_files = self._gather_files("js")
        return _cached_block(
            ("js", self.admin_page), self._source_paths(js_files), lambda: self._inline_js_modules(js_files)
        )

    def get_css_block(self):
        css_files = self._gather_files("css")
        return _cached_block(
            ("css", self.admin_page), self._source_paths(css_files), lambda: self._inline_css_files(css_files)
        )

    def get_dependencies_block(self, offline: bool):
        local_files = [dep["local"] for _, dep in self._dependencies()] if offline else []
        return _cached_block(
            ("dependencies", self.admin_page, offline),
            self._source_paths(local_files),
            lambda: self._build_dependencies_block(offline),
        )

    def _source_paths(self, rel_paths):
        base = Path(dirname(abspath(__file__)))
        return [base / rel_path for rel_path in rel_paths]

    def _dependencies(self):
        """(name, dependency) pairs for this page, the admin page leaves out the dashboard-only ones"""
        return [
            (name, dep) for name, dep in DEPENDENCIES.items()
            if not (self.admin_page and dep.get("admin_page") is False)
        ]

    def _build_dependencies_block(self, offline: bool) -> str:
        """
        Builds either CDN links or inline js/css for offline mode.
        """
        html_parts = []

        for dep_name, dep in self._dependencies():
            if not offline:
                if dep["type"] == "js":
                    html_parts.append(f'<script src="{dep["cdn"]}"></script>')
                else:
                    html_parts.append(f'<link rel="stylesheet" href="{dep["cdn"]}" />')
            else:
                local_path = Path(dirname(abspath(__file__))) / dep["local"]
                contents = local_path.read_text(encoding="utf-8")
                html_parts.append(f"<!-- {dep_name} -->")
                if dep["type"] == "js":
                    html_parts.append(f"<script>\n{contents}\n</script>")
                else:
                    html_parts.append(f"<style>\n{contents}\n</style>")

        return "\n".join(html_parts)

    def _inline_js_modules(self, js_files):
        """
        Takes a list of JS module file paths, resolves import order,
        strips imports/exports, and returns one merged <script type="module"> block.
        """
        base = Path(dirname(abspath(__file__)))
        # Load all module sources using absolute paths
        modules = {}
        for rel_path in js_files:
            abs_path = base / rel_path
            if not abs_path.exists():  # pragma: no cover
                raise FileNotFoundError(f"JS module not found: {abs_path}")
            modules[str(abs_path)] = abs_path.read_text(encoding="utf-8")

        # Build dependency graph
        import_pattern = compile(r'import\s+.*?from\s+[\'"](.*?)[\'"];?', DOTALL)
        dependencies = {path: [] for path in modules.keys()}
        for abs_path, code in modules.items():
            current_dir = dirname(abs_path)
            for match in import_pattern.findall(code):
                dep_abs = normpath(join(current_dir, match))
                dependencies[abs_path].append(dep_abs)

        # Topological sort
        resolved = []
        visited = set()

        def visit(path):
            if path in visited:
                return
            visited.add(path)
            for dep in dependencies[path]:
                visit(dep)
            resolved.append(path)

        for path in modules.keys():
            visit(path)

        # Merge + strip import/export
        merged = "// MERGED MODULES\n"
        for abs_path in resolved:
            file_name = basename(abs_path)
            code = modules[abs_path]
            # Remove multi-line export blocks first
            code = sub(r"\s*export\s*\{[\s\S]*?\};\s*", "", code)
            # Remove export default statements
            code = sub(r"\s*export\s+default\s+[\s\S]*?;?\s*", "", code)
            # Remove import statements (single or multi-line)
            code = sub(r"^\s*import\s+[\s\S]*?;\s*", "", code, flags=MULTILINE)
            # Remove inline export before function declarations
            code = sub(r"^\s*export\s+", "", code, flags=MULTILINE)
            merged += f"\n// === {file_name} ===\n"
            merged += code + "\n"

        # Wrap in a single script tag
        return f"<script>{merged}</script>"

    def _inline_css_files(self, css_files):
        """
        Takes a list of CSS file paths and merges them into one <style> block.
        """
        base = Path(dirname(abspath(__file__)))
        merged = ""
        for rel_path in css_files:
            abs_path = base / rel_path
            css = abs_path.read_text(encoding="utf-8")
            merged += f"\n/* === {basename(rel_path)} === */\n"
            merged += css + "\n"
        return f"<style>\n{merged}\n</style>"

    def _gather_files(self, folder: str):
        """
        Recursively collect all JS/CSS files for dashboard or admin.

        If admin_page == True:
            Only include files from js/admin_page/
        If admin_page == False:
            Only include all files from js/ except js/admin_page/
        """
        base = Path(__file__).parent
        root = base / folder
        admin_dir = root / "admin_page"

        files = []

        # only admin files
        if self.admin_page and folder == "js":
            if admin_dir.exists():
                for p in sorted(admin_dir.rglob(f"*.{folder}")):
                    files.append(str(relpath(p, base)))
            return files

        # everything except admin files
        for p in sorted(root.rglob(f"*.{folder}")):
            # Skip admin_page subtree
            try:
                p.relative_to(admin_dir)
                continue
            except ValueError:
                pass

            files.append(str(relpath(p, base)))

        return files
