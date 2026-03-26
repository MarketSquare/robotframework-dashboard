import pytest
from robotframework_dashboard.dependencies import DependencyProcessor


# --- get_js_block ---

def test_get_js_block_returns_script_tag():
    result = DependencyProcessor().get_js_block()
    assert "<script>" in result


def test_get_js_block_contains_merged_modules():
    result = DependencyProcessor().get_js_block()
    assert "MERGED MODULES" in result


# --- get_css_block ---

def test_get_css_block_returns_style_tag():
    result = DependencyProcessor().get_css_block()
    assert "<style>" in result


# --- get_dependencies_block offline=False (CDN) ---

def test_get_dependencies_block_online_contains_cdn():
    result = DependencyProcessor().get_dependencies_block(offline=False)
    assert "cdn.jsdelivr.net" in result or "cdnjs.cloudflare.com" in result or "unpkg.com" in result


def test_get_dependencies_block_online_returns_script_and_link_tags():
    result = DependencyProcessor().get_dependencies_block(offline=False)
    assert "<script" in result or "<link" in result


# --- get_dependencies_block offline=True (local files) ---

def test_get_dependencies_block_offline_contains_inline_content():
    result = DependencyProcessor().get_dependencies_block(offline=True)
    assert "<script>" in result or "<style>" in result


def test_get_dependencies_block_offline_contains_comments():
    result = DependencyProcessor().get_dependencies_block(offline=True)
    # Each dependency is labeled with a comment
    assert "<!--" in result


# --- admin_page variant ---

def test_get_dependencies_block_admin_online_includes_bootstrap():
    result = DependencyProcessor(admin_page=True).get_dependencies_block(offline=False)
    # Bootstrap is an admin-page dependency
    assert "bootstrap" in result.lower()


def test_get_dependencies_block_admin_offline_contains_inline():
    result = DependencyProcessor(admin_page=True).get_dependencies_block(offline=True)
    assert "<script>" in result or "<style>" in result


# --- _gather_files ---

def test_gather_files_js_not_empty():
    dp = DependencyProcessor()
    files = dp._gather_files("js")
    assert len(files) > 0
    assert all(f.endswith(".js") for f in files)


def test_gather_files_css_not_empty():
    dp = DependencyProcessor()
    files = dp._gather_files("css")
    assert len(files) > 0
    assert all(f.endswith(".css") for f in files)


def test_gather_files_admin_js_excludes_non_admin():
    dp_admin = DependencyProcessor(admin_page=True)
    files = dp_admin._gather_files("js")
    # Admin page JS files come only from the admin_page subfolder
    for f in files:
        assert "admin_page" in f


def test_gather_files_non_admin_excludes_admin_page_files():
    dp = DependencyProcessor(admin_page=False)
    files = dp._gather_files("js")
    for f in files:
        assert "admin_page" not in f


def test_admin_page_get_js_block_returns_string():
    result = DependencyProcessor(admin_page=True).get_js_block()
    assert isinstance(result, str)
    assert "<script>" in result


def test_inline_css_files_wraps_in_style():
    dp = DependencyProcessor()
    css_files = dp._gather_files("css")
    assert len(css_files) > 0
    result = dp._inline_css_files(css_files)
    assert result.startswith("<style>")
    assert result.endswith("</style>")
