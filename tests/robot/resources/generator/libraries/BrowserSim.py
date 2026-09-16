"""Fake browser library. Keyword names mimic robotframework-browser so the
generated output.xml looks like a real UI test project, but nothing is opened:
every keyword is a scaled sleep plus, when the plan says so, a failure."""

from robot.api.deco import keyword, library

from simulation import SIM


@library(scope="GLOBAL", listener=SIM)
class BrowserSim:
    @keyword("New Browser")
    def new_browser(self, browser="chromium", headless=True):
        SIM.step("New Browser", 2.0, browser=browser)

    @keyword("New Page")
    def new_page(self, url):
        SIM.step("New Page", 1.3, url=url)

    @keyword("Go To")
    def go_to(self, url):
        SIM.step("Go To", 0.9, url=url)

    @keyword("Click")
    def click(self, selector):
        SIM.step("Click", 0.3, selector=selector)

    @keyword("Fill Text")
    def fill_text(self, selector, txt):
        SIM.step("Fill Text", 0.25, selector=selector, txt=txt)

    @keyword("Wait For Elements State")
    def wait_for_elements_state(self, selector, state="visible", timeout="10s"):
        SIM.step("Wait For Elements State", 0.7, selector=selector, state=state)

    @keyword("Get Text")
    def get_text(self, selector, expected=None):
        SIM.step("Get Text", 0.1, selector=selector, expected=expected)
        return expected

    @keyword("Get Element Count")
    def get_element_count(self, selector, expected=None):
        SIM.step("Get Element Count", 0.12, selector=selector, expected=expected)
        return expected

    @keyword("Get Url")
    def get_url(self, expected=None):
        SIM.step("Get Url", 0.05, expected=expected)
        return expected

    @keyword("Select Options By")
    def select_options_by(self, selector, attribute, value):
        SIM.step("Select Options By", 0.2, selector=selector, attribute=attribute, value=value)

    @keyword("Check Checkbox")
    def check_checkbox(self, selector):
        SIM.step("Check Checkbox", 0.15, selector=selector)

    @keyword("Hover")
    def hover(self, selector):
        SIM.step("Hover", 0.15, selector=selector)

    @keyword("Scroll To Element")
    def scroll_to_element(self, selector):
        SIM.step("Scroll To Element", 0.2, selector=selector)

    @keyword("Press Keys")
    def press_keys(self, selector, *keys):
        SIM.step("Press Keys", 0.1, selector=selector)

    @keyword("Upload File By Selector")
    def upload_file_by_selector(self, selector, path):
        SIM.step("Upload File By Selector", 0.6, selector=selector, path=path)

    @keyword("Take Screenshot")
    def take_screenshot(self, filename="screenshot"):
        SIM.step("Take Screenshot", 0.5)

    @keyword("Close Browser")
    def close_browser(self):
        SIM.step("Close Browser", 0.4)
