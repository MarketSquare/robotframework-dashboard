"""Feature-flag keyword: skips the current test when the flag is disabled for this run."""

from robot.api.deco import keyword, library

from simulation import SIM


@library(scope="GLOBAL")
class Features:
    @keyword("Require Feature")
    def require_feature(self, flag):
        SIM.require_feature(flag)
