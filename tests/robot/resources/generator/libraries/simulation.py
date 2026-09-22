"""Core of the fixture generator: decides, per test and per run, what happens.

Nothing here talks to a real system. The fake libraries (BrowserSim, ApiSim)
call ``SIM.step()`` for every leaf keyword; the simulation sleeps for a scaled
duration and raises when the plan for the current test says so. All randomness
is seeded from ``${SEED}``, ``${RUN_INDEX}`` and the test name, so the same
inputs always produce the same output.xml (apart from real-time noise on
durations, which is what we want: min/avg/max keyword times differ).

Time scaling: keyword "target" durations are in seconds as they should appear
in the fixture. The actual sleep is ``target / SIM_SCALE``; ``generate.py``
multiplies every ``elapsed`` in the resulting output.xml by ``SIM_SCALE`` again.
"""

import json
import random
import time

from robot.api.exceptions import Failure, SkipExecution
from robot.libraries.BuiltIn import BuiltIn

from profiles import (
    BAD_RUNS,
    CLEAN_RUNS,
    EXCEPTION_MESSAGES,
    EXCEPTION_RATES,
    FAILURE_MESSAGES,
    FEATURE_FLAGS,
    OUTAGE_MESSAGES,
    PROFILES,
    STEP_WEIGHTS,
)


class CaughtException(Failure):
    """Raised inside TRY blocks; the resource keywords catch these by glob pattern."""


class TestPlan:
    """What should happen to one test in one run."""

    def __init__(self, longname, name, project, run_index, seed, step_count, outage_rate, exception_rate):
        self.longname = longname
        self.name = name
        self.project = project
        self.run_index = run_index
        self.step_count = step_count
        self.exception_rate = exception_rate
        self.profile = PROFILES.get(name, "stable")

        # rng_test: identical for every run of this test (persistent behaviour)
        # rng_run:  differs per run (flakiness, exceptions, outages)
        self.rng_test = random.Random(f"{seed}:{project}:{name}")
        self.rng_run = random.Random(f"{seed}:{project}:{name}:{run_index}")

        self.fail = False
        self.fail_step = None
        self.fail_rng = self.rng_test
        self.outage = False
        self.skip_reason = None
        self.duration_factor = 1.0
        self.steps_done = 0
        self.setup_steps = 0
        self.last_step_threw = False
        self.failure_raised = False

        self._apply_profile()
        self.clean = CLEAN_RUNS.get((project, run_index))
        if self.clean:
            self.fail = False
            outage_rate = 0.0
        if not self.fail and outage_rate and self.rng_run.random() < outage_rate:
            self.fail = True
            self.outage = True
            self.fail_rng = self.rng_run
        if self.fail:
            self._pick_fail_step()

    def _apply_profile(self):
        kind, _, arg = self.profile.partition(":")
        if kind == "stable":
            return
        if kind == "always-fail":
            self.fail = True
        elif kind == "flaky":
            if self.rng_run.random() < float(arg or 0.3):
                self.fail = True
                self.fail_rng = self.rng_run
        elif kind == "broken-since":
            self.fail = self.run_index >= int(arg)
        elif kind == "fixed-since":
            self.fail = self.run_index < int(arg)
        elif kind == "slow-outlier":
            if self.rng_run.random() < float(arg or 0.3):
                self.duration_factor = 3.0 + self.rng_run.random() * 3
        elif kind == "slower-every-run":
            self.duration_factor = 1.0 + float(arg or 0.2) * self.run_index
        elif kind == "faster-every-run":
            self.duration_factor = max(0.3, 2.5 - float(arg or 0.2) * self.run_index)
        else:
            raise ValueError(f"Unknown profile '{self.profile}' for test '{self.name}'")

    def _pick_fail_step(self):
        # step_count = {"setup": n, "body": m} from the calibration run. Planned failures land in
        # the test body; only outages may also break the setup (never on its very first step).
        setup = self.step_count.get("setup", 0) if self.step_count else 0
        body = self.step_count.get("body", 0) if self.step_count else 0
        if not body:
            self.fail_step = max(2, setup + 1)
            return
        first = 2 if self.outage else setup + 1
        self.fail_step = self.fail_rng.randint(min(first, setup + body), setup + body)

    def feature_enabled(self, flag):
        schedule = FEATURE_FLAGS.get(flag)
        if schedule is None or self.clean == "green":
            return True
        return schedule(self.project, self.run_index)


class Simulation:
    ROBOT_LISTENER_API_VERSION = 3

    def __init__(self):
        self.builtin = BuiltIn()
        self.plan = None
        self.try_depth = 0
        self.phase = "body"  # or "setup" / "teardown" while inside a test setup/teardown
        self.step_counts = {}
        self.count_mode = False
        self.recorded_counts = {}
        self._configured = False

    # setup
    def _configure(self):
        if self._configured:
            return
        get = self.builtin.get_variable_value
        self.seed = int(get("${SEED}", 1))
        self.run_index = int(get("${RUN_INDEX}", 1))
        self.scale = float(get("${SIM_SCALE}", 50))
        self.count_mode = str(get("${SIM_MODE}", "run")) == "count"
        self.counts_out = get("${STEP_COUNTS_OUT}", None)
        counts_file = get("${STEP_COUNTS}", None)
        if counts_file:
            with open(counts_file) as f:
                self.step_counts = json.load(f)
        self._configured = True

    # listener
    def start_test(self, data, result):
        # Both fake libraries register this object as listener: build the plan once.
        if self.plan is not None and self.plan.longname == data.longname:
            return
        self._configure()
        project = data.longname.split(".", 1)[0]
        outage_rate = BAD_RUNS.get((project, self.run_index), 0.0)
        exception_rate = EXCEPTION_RATES.get((project, self.run_index), EXCEPTION_RATES["default"])
        if self.count_mode:
            outage_rate, exception_rate = 0.0, 0.0
        self.plan = TestPlan(
            longname=data.longname,
            name=data.name,
            project=project,
            run_index=self.run_index,
            seed=self.seed,
            step_count=self.step_counts.get(data.longname, 0),
            outage_rate=outage_rate,
            exception_rate=exception_rate,
        )
        if self.count_mode:
            self.plan.fail = False
            self.plan.fail_step = None

    def end_test(self, data, result):
        if self.plan is None:
            return
        if self.count_mode:
            self.recorded_counts[data.longname] = {
                "setup": self.plan.setup_steps,
                "body": self.plan.steps_done - self.plan.setup_steps,
            }
        self.plan = None
        self.try_depth = 0
        self.phase = "body"

    def start_keyword(self, data, result):
        if self.plan is not None and result.type in ("SETUP", "TEARDOWN") and self.phase == "body":
            self.phase = result.type.lower()

    def end_keyword(self, data, result):
        if self.plan is not None and result.type in ("SETUP", "TEARDOWN") and self.phase == result.type.lower():
            self.phase = "body"

    def start_try_branch(self, data, result):
        if data.type == "TRY":
            self.try_depth += 1

    def end_try_branch(self, data, result):
        if data.type == "TRY":
            self.try_depth -= 1

    def close(self):
        if self.count_mode and self.recorded_counts and self.counts_out:
            with open(self.counts_out, "w") as f:
                json.dump(self.recorded_counts, f, indent=2, sort_keys=True)

    # steps
    def step(self, keyword, base_duration, **fmt):
        """Execute one simulated leaf keyword.

        ``keyword`` selects the failure message pool and weight, ``base_duration``
        is the target duration in seconds, ``fmt`` are values substituted into
        message templates (selector, url, expected value, ...).
        """
        plan = self.plan
        if plan is None:  # keyword used in suite setup/teardown
            self._sleep(base_duration)
            return
        if self.phase == "teardown":  # teardowns only sleep, they never fail
            self._sleep(base_duration * plan.duration_factor)
            return
        plan.steps_done += 1
        if self.phase == "setup":
            plan.setup_steps += 1
        if self.count_mode:
            return
        self._sleep(base_duration * plan.duration_factor)

        if self.try_depth > 0 and self._should_throw_exception(plan):
            plan.last_step_threw = True
            raise CaughtException(plan.rng_run.choice(EXCEPTION_MESSAGES[plan.project]))
        plan.last_step_threw = False

        if plan.fail and not plan.failure_raised and plan.steps_done >= plan.fail_step:
            # Postpone the failure to a "better" keyword (assertions, waits) most of the time.
            weight = STEP_WEIGHTS.get(keyword, 1)
            total = sum(plan.step_count.values()) if plan.step_count else 0
            if weight < 3 and plan.steps_done < total and plan.fail_rng.random() < 0.7:
                return
            plan.failure_raised = True
            raise Failure(self._failure_message(plan, keyword, fmt))

    def _should_throw_exception(self, plan):
        # Never throw twice in a row: the EXCEPT branch retries the same step and must succeed.
        if plan.last_step_threw:
            return False
        return plan.rng_run.random() < plan.exception_rate

    def _failure_message(self, plan, keyword, fmt):
        if plan.outage:
            template = plan.fail_rng.choice(OUTAGE_MESSAGES[plan.project])
        else:
            template = plan.fail_rng.choice(FAILURE_MESSAGES.get(keyword, FAILURE_MESSAGES["default"]))
        values = dict(fmt)
        values.setdefault("id", "%08x" % plan.fail_rng.getrandbits(32))
        values.setdefault("ms", plan.fail_rng.choice([10000, 15000, 30000]))
        values.setdefault("actual", plan.fail_rng.choice(["", "Loading...", "0", "undefined", "Error"]))
        values.setdefault("actual_count", plan.fail_rng.choice([0, 1, 3]))
        return template.format(**values)

    def _sleep(self, target):
        if target > 0 and not self.count_mode:
            time.sleep(target / self.scale)

    def require_feature(self, flag):
        plan = self.plan
        if plan is None or self.count_mode:
            return
        if not plan.feature_enabled(flag):
            raise SkipExecution(f"Feature '{flag}' is disabled in this environment")


SIM = Simulation()
