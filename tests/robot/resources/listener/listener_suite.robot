*** Settings ***
Documentation    Tiny suite executed by 09_server.robot with the packaged listener attached, so the
...              listener uploads a real output.xml / log.html to a running dashboard server.
...              Not part of the test run itself (only tests/robot/testsuites/ is).


*** Test Cases ***
Listener Passing Test
    Log    uploaded through robotframework_dashboard.robotdashboardlistener

Listener Failing Test
    Fail    msg=expected failure so the run carries a failed test
