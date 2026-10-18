import pytest
from robotframework_dashboard.dependencies import (
    ADMIN_DEPENDENCIES,
    ADMIN_JS_ROOT,
    CSS_ROOT,
    JS_ROOT,
    DependencyProcessor,
)


def admin_processor():
    return DependencyProcessor(js_root=ADMIN_JS_ROOT, dependencies=ADMIN_DEPENDENCIES, exclude=())


def test_get_js_block_returns_script_tag():
    result = DependencyProcessor().get_js_block()
    assert "<script>" in result


def test_get_js_block_contains_merged_modules():
    result = DependencyProcessor().get_js_block()
    assert "MERGED MODULES" in result


def test_get_css_block_returns_style_tag():
    result = DependencyProcessor().get_css_block()
    assert "<style>" in result


def test_get_dependencies_block_online_contains_cdn():
    result = DependencyProcessor().get_dependencies_block(offline=False)
    assert "cdn.jsdelivr.net" in result or "cdnjs.cloudflare.com" in result


def test_get_dependencies_block_online_returns_script_and_link_tags():
    result = DependencyProcessor().get_dependencies_block(offline=False)
    assert "<script" in result or "<link" in result


def test_get_dependencies_block_offline_contains_inline_content():
    result = DependencyProcessor().get_dependencies_block(offline=True)
    assert "<script>" in result or "<style>" in result


def test_get_dependencies_block_offline_contains_comments():
    result = DependencyProcessor().get_dependencies_block(offline=True)
    # Each dependency is labeled with a comment
    assert "<!--" in result


def test_get_dependencies_block_admin_online_includes_bootstrap():
    result = admin_processor().get_dependencies_block(offline=False)
    # Bootstrap is an admin-page dependency
    assert "bootstrap" in result.lower()


def test_get_dependencies_block_admin_offline_contains_inline():
    result = admin_processor().get_dependencies_block(offline=True)
    assert "<script>" in result or "<style>" in result


def test_gather_files_js_not_empty():
    dp = DependencyProcessor()
    files = dp._gather_files(dp.js_root, "js")
    assert len(files) > 0
    assert all(f.suffix == ".js" for f in files)


def test_gather_files_css_not_empty():
    dp = DependencyProcessor()
    files = dp._gather_files(dp.css_root, "css")
    assert len(files) > 0
    assert all(f.suffix == ".css" for f in files)


def test_gather_files_admin_js_excludes_non_admin():
    dp_admin = admin_processor()
    files = dp_admin._gather_files(dp_admin.js_root, "js")
    # Admin page JS files come only from the admin_page subfolder
    for f in files:
        assert f.is_relative_to(ADMIN_JS_ROOT)


def test_gather_files_non_admin_excludes_admin_page_files():
    dp = DependencyProcessor()
    files = dp._gather_files(dp.js_root, "js")
    for f in files:
        assert not f.is_relative_to(ADMIN_JS_ROOT)


def test_admin_page_get_js_block_returns_string():
    result = admin_processor().get_js_block()
    assert isinstance(result, str)
    assert "<script>" in result


def test_inline_css_files_wraps_in_style():
    dp = DependencyProcessor()
    css_files = dp._gather_files(dp.css_root, "css")
    assert len(css_files) > 0
    result = dp._inline_css_files(css_files)
    assert result.startswith("<style>")
    assert result.endswith("</style>")


def test_blocks_are_cached_until_a_source_file_changes(tmp_path, monkeypatch):
    import os
    from robotframework_dashboard import dependencies

    source = tmp_path / "a.js"
    source.write_text("one", encoding="utf-8")
    builds = []

    def build():
        builds.append(source.read_text(encoding="utf-8"))
        return builds[-1]

    monkeypatch.setattr(dependencies, "_block_cache", {})
    assert dependencies._cached_block("key", [source], build) == "one"
    assert dependencies._cached_block("key", [source], build) == "one"
    assert builds == ["one"]
    source.write_text("two!", encoding="utf-8")
    stat = source.stat()
    os.utime(source, ns=(stat.st_atime_ns, stat.st_mtime_ns + 1_000_000))
    assert dependencies._cached_block("key", [source], build) == "two!"
    assert builds == ["one", "two!"]


def test_js_block_is_identical_when_served_from_the_cache():
    from robotframework_dashboard import dependencies

    first = DependencyProcessor().get_js_block()
    dependencies._block_cache.clear()
    assert DependencyProcessor().get_js_block() == first
    assert admin_processor().get_js_block() != first


def test_admin_dependencies_leave_out_the_dashboard_only_libraries():
    result = admin_processor().get_dependencies_block(offline=False)
    assert "bootstrap" in result and "datatables" in result
    assert "chart.js" not in result and "gridstack" not in result


def test_unknown_dependency_name_is_rejected():
    with pytest.raises(ValueError, match="Unknown dependencies: nope"):
        DependencyProcessor(dependencies=("chartjs", "nope"))


def test_custom_roots_bundle_another_package(tmp_path):
    # another package (the hub) bundles its own js/css but loads libraries from DEPENDENCIES
    (tmp_path / "js" / "sub").mkdir(parents=True)
    (tmp_path / "css").mkdir()
    (tmp_path / "js" / "main.js").write_text('import { helper } from "./sub/helper.js";\nhelper();\n', encoding="utf-8")
    (tmp_path / "js" / "sub" / "helper.js").write_text("export function helper() {}\n", encoding="utf-8")
    (tmp_path / "css" / "hub.css").write_text(".hub { color: red; }\n", encoding="utf-8")
    dp = DependencyProcessor(js_root=tmp_path / "js", css_root=tmp_path / "css", dependencies=("chartjs",), exclude=())
    js = dp.get_js_block()
    assert js.index("=== helper.js ===") < js.index("=== main.js ===")
    assert "import" not in js and "export" not in js
    assert "=== hub.css ===" in dp.get_css_block()
    assert "toggleTheme" not in js
    offline = dp.get_dependencies_block(offline=True)
    assert "<!-- chartjs -->" in offline and "bootstrap" not in offline


def test_default_roots_are_the_package_folders():
    dp = DependencyProcessor()
    assert dp.js_root == JS_ROOT and dp.css_root == CSS_ROOT
