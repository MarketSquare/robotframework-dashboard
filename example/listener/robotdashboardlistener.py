# This file is a thin re-export of robotframework_dashboard.robotdashboardlistener, kept here for
# users who prefer to point --listener at a local file path instead of the installed module. The
# listener now ships inside the package itself (no extra dependencies — it uses the standard
# library for HTTP), so most users don't need this file at all and can use the dotted import path
# directly:
#
#   pip install robotframework-dashboard
#   robot --listener robotframework_dashboard.robotdashboardlistener tests.robot
#
# See robotframework_dashboard/robotdashboardlistener.py for the full implementation, argument
# reference, and usage examples (Robot Framework, Pabot, RobotCode).
#
# Docs:   https://marketsquare.github.io/robotframework-dashboard/listener-integration.html
# Source: https://github.com/marketsquare/robotframework-dashboard/blob/main/robotframework_dashboard/robotdashboardlistener.py
from robotframework_dashboard.robotdashboardlistener import robotdashboardlistener
