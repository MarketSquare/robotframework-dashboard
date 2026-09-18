"""Fake HTTP library. Keyword names mimic RequestsLibrary / JSONLibrary so the
generated output.xml looks like a real API test project. No requests are sent."""

from robot.api.deco import keyword, library

from simulation import SIM


@library(scope="GLOBAL", listener=SIM)
class ApiSim:
    @keyword("Create Session")
    def create_session(self, alias, url, headers=None):
        SIM.step("Create Session", 0.15, alias=alias, url=url)

    @keyword("Delete All Sessions")
    def delete_all_sessions(self):
        SIM.step("Delete All Sessions", 0.05)

    @keyword("GET")
    def get(self, alias, endpoint, params=None, expected_status=200):
        SIM.step("GET", 0.3, alias=alias, endpoint=endpoint)
        return {"status": expected_status, "endpoint": endpoint}

    @keyword("POST")
    def post(self, alias, endpoint, json=None, expected_status=201):
        SIM.step("POST", 0.45, alias=alias, endpoint=endpoint)
        return {"status": expected_status, "endpoint": endpoint}

    @keyword("PUT")
    def put(self, alias, endpoint, json=None, expected_status=200):
        SIM.step("PUT", 0.4, alias=alias, endpoint=endpoint)
        return {"status": expected_status, "endpoint": endpoint}

    @keyword("DELETE")
    def delete(self, alias, endpoint, expected_status=204):
        SIM.step("DELETE", 0.35, alias=alias, endpoint=endpoint)
        return {"status": expected_status, "endpoint": endpoint}

    @keyword("Status Should Be")
    def status_should_be(self, expected, response):
        SIM.step("Status Should Be", 0.01, expected=expected)

    @keyword("Get Value From Json")
    def get_value_from_json(self, response, path, expected=None):
        SIM.step("Get Value From Json", 0.01, path=path, expected=expected)
        return expected

    @keyword("Response Should Contain")
    def response_should_contain(self, response, key):
        SIM.step("Response Should Contain", 0.01, key=key)
