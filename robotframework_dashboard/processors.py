from robot.api import ExecutionResult, ResultVisitor
from robot.result.model import TestCase, TestSuite, Keyword
from datetime import datetime
from pathlib import Path
from collections import Counter


class OutputProcessor:
    """This class creates an output processor that collects all the relevant data for the database"""

    def __init__(self, output_path: Path):
        self.output_path = output_path
        self.execution_result = ExecutionResult(output_path)

    def get_run_start(self):
        """Function to get the run_start to do a check if it is not already present in the database"""
        if hasattr(self.execution_result, "generation_time"):
            generation_time = self.execution_result.generation_time
        else:
            with open(self.output_path, "r") as f:
                for line in f:
                    if "<robot" in line:
                        generation_time = line.split('generated="', 1)[1].split('"', 1)[
                            0
                        ]
                        if "T" in generation_time:
                            generation_time = datetime.strptime(
                                generation_time, "%Y-%m-%dT%H:%M:%S.%f"
                            )
                        else:
                            generation_time = datetime.strptime(
                                generation_time, "%Y%m%d %H:%M:%S.%f"
                            )
                        break
        self.generation_time = generation_time
        return self.generation_time

    def get_output_data(self):
        """This is the main function that is actually called by robotdashboard"""
        run_list, suite_list, test_list, keyword_list = [], [], [], []
        self.execution_result.visit(RunProcessor(self.generation_time, run_list))
        self.execution_result.visit(SuiteProcessor(self.generation_time, suite_list))
        self.execution_result.visit(TestProcessor(self.generation_time, test_list))
        self.execution_result.visit(
            KeywordProcessor(self.generation_time, keyword_list)
        )
        exception_processor = ExceptionProcessor(self.generation_time)
        self.execution_result.visit(exception_processor)
        average_keyword_list = self.calculate_keyword_averages(keyword_list)
        run_list, suite_list = self.merge_run_and_suite_metadata(run_list, suite_list)
        return {
            "runs": run_list,
            "suites": suite_list,
            "tests": test_list,
            "keywords": average_keyword_list,
            "exceptions": exception_processor.get_aggregated_exceptions(),
        }

    def calculate_keyword_averages(self, keyword_list: list):
        """Helper function to calculate keyword statistics"""
        average_keyword_dict = {}
        average_keyword_list = []
        run_start = keyword_list[0][0]
        for keyword in keyword_list:
            name = keyword[1]
            passed = int(keyword[2])
            failed = int(keyword[3])
            skipped = int(keyword[4])
            elapsed_s = keyword[5]
            owner = keyword[6]
            if not name in average_keyword_dict.keys():
                average_keyword_dict[name] = {
                    "passed": passed,
                    "failed": failed,
                    "skipped": skipped,
                    "elapsed_s": [elapsed_s],
                    "owner": owner,
                }
            else:
                average_keyword_dict[name]["passed"] += passed
                average_keyword_dict[name]["failed"] += failed
                average_keyword_dict[name]["skipped"] += skipped
                average_keyword_dict[name]["elapsed_s"].append(elapsed_s)
        for name in average_keyword_dict.keys():
            elapsed_list = average_keyword_dict[name]["elapsed_s"]
            sum_elapsed_list = sum(elapsed_list)
            len_elapsed_list = len(elapsed_list)
            min_elapsed_list = min(elapsed_list)
            max_elapsed_list = max(elapsed_list)
            average_keyword_list.append(
                (
                    run_start,  # run_start
                    name,  # keyword name
                    average_keyword_dict[name]["passed"],  # amount of passes
                    average_keyword_dict[name]["failed"],  # amount of fails
                    average_keyword_dict[name]["skipped"],  # amount of skips
                    len_elapsed_list,  # times used
                    round(sum_elapsed_list, 3),  # total usage time
                    round(sum_elapsed_list / len_elapsed_list, 3),  # average usage time
                    round(min_elapsed_list, 3),  # fastest usage time
                    round(max_elapsed_list, 3),  # slowest usage time
                    average_keyword_dict[name]["owner"],  # library
                )
            )
        return average_keyword_list

    def merge_run_and_suite_metadata(self, run_list: list, suite_list: list):
        new_suite_list = []
        suite_metadata_items = []

        def clean_metadata_value(s):
            s = s.replace("'", "")
            s = s.replace('"', "")
            return s

        for suite in suite_list:
            for k, v in suite[-1].items():
                cleaned_key = clean_metadata_value(str(k))
                cleaned_value = clean_metadata_value(str(v))
                suite_metadata_items.append(f"{cleaned_key}: {cleaned_value}")
            suite = suite[:-1]
            new_suite_list.append(suite)

        run_metadata = run_list[0][-1]
        run_metadata_items = []
        for k, v in run_metadata.items():
            cleaned_key = clean_metadata_value(str(k))
            cleaned_value = clean_metadata_value(str(v))
            run_metadata_items.append(f"{cleaned_key}: {cleaned_value}")
        run_metadata_items += suite_metadata_items

        # Convert tuple to list, update last element, then back to tuple
        run = list(run_list[0])
        run[-1] = str(list(set(run_metadata_items)))
        run_list[0] = tuple(run)

        return run_list, new_suite_list


class RunProcessor(ResultVisitor):
    """Processer to get the run data"""

    def __init__(self, run_time: datetime, run_list: list):
        self.run_list = run_list
        self.run_time = run_time

    def visit_suite(self, suite: TestSuite):
        stats = suite.statistics

        # handling for older robot versions
        if hasattr(suite, "full_name"):
            full_name = suite.full_name
        else:
            full_name = suite.longname
        if hasattr(suite, "elapsed_time"):
            elapsed_time = round(suite.elapsed_time.total_seconds(), 3)
        else:
            elapsed_time = round(suite.elapsedtime / 1000, 3)
        if hasattr(suite, "start_time"):
            start_time = suite.start_time
        else:
            start_time = suite.starttime

        self.run_list.append(
            (
                self.run_time,
                full_name,
                suite.name,
                stats.total,
                stats.passed,
                stats.failed,
                stats.skipped,
                elapsed_time,
                start_time,
                suite.metadata,
            )
        )


class SuiteProcessor(ResultVisitor):
    """Processer to get the suite data"""

    def __init__(self, run_time: datetime, suite_list: list):
        self.suite_list = suite_list
        self.run_time = run_time

    def start_suite(self, suite: TestSuite):
        if suite.tests:
            try:
                stats = suite.statistics.all
            except:
                stats = suite.statistics

            # handling for older robot versions
            if hasattr(suite, "full_name"):
                full_name = suite.full_name
            else:
                full_name = suite.longname
            if hasattr(suite, "elapsed_time"):
                elapsed_time = round(suite.elapsed_time.total_seconds(), 3)
            else:
                elapsed_time = round(suite.elapsedtime / 1000, 3)
            if hasattr(suite, "start_time"):
                start_time = suite.start_time
            else:
                start_time = suite.starttime

            self.suite_list.append(
                (
                    self.run_time,
                    full_name,
                    suite.name,
                    stats.total,
                    stats.passed,
                    stats.failed,
                    stats.skipped,
                    elapsed_time,
                    start_time,
                    suite.id,
                    suite.metadata,
                )
            )


class TestProcessor(ResultVisitor):
    """Processer to get the test data"""

    def __init__(self, run_time: datetime, test_list: list):
        self.test_list = test_list
        self.run_time = run_time

    def visit_test(self, test: TestCase):
        # handling for older robot versions
        if hasattr(test, "full_name"):
            full_name = test.full_name
        else:
            full_name = test.longname
        if hasattr(test, "elapsed_time"):
            elapsed_time = round(test.elapsed_time.total_seconds(), 3)
        else:
            elapsed_time = round(test.elapsedtime / 1000, 3)
        if hasattr(test, "start_time"):
            start_time = test.start_time
        else:
            start_time = test.starttime

        self.test_list.append(
            (
                self.run_time,
                full_name,
                test.name,
                test.passed,
                test.failed,
                test.skipped,
                elapsed_time,
                start_time,
                test.message[:150],
                str(test.tags).replace(" ", ""),
                test.id,
            )
        )


class KeywordProcessor(ResultVisitor):
    """Processer to get the keyword data"""

    def __init__(self, run_time: datetime, keyword_list: list):
        self.keyword_list = keyword_list
        self.run_time = run_time

    def end_keyword(self, keyword: Keyword):
        # handling for older robot versions
        if hasattr(keyword, "elapsed_time"):
            elapsed_time = round(keyword.elapsed_time.total_seconds(), 3)
        else:
            elapsed_time = round(keyword.elapsedtime / 1000, 3)

        if hasattr(keyword, "owner"):
            name = keyword.name
            owner = keyword.owner
            if not owner:
                # There is no owner, this happens when keywords are located in testsuites directly
                # Add a default one to not be empty
                owner = "TestSuite"
        else:
            name = keyword.name
            owner = keyword.libname
            if owner:   
                # There is a parent library or resource file
                if "." in name: 
                    # There is a library name in the name of the keyword
                    name = name.split(".", 1)[1]
            else:   
                # There is no owner, this happens when keywords are located in testsuites directly
                # Add a default one to not be empty
                owner = 'TestSuite'

        self.keyword_list.append(
            (
                self.run_time,
                name,
                keyword.passed,
                keyword.failed,
                keyword.skipped,
                elapsed_time,
                owner,
            )
        )


class ExceptionProcessor(ResultVisitor):
    """Processor to collect exception messages from keywords inside TRY/EXCEPT blocks"""

    def __init__(self, run_time: datetime):
        self.run_time = run_time
        self._try_depth = 0
        self._exception_counts = Counter()
        self._child_failed = []

    def start_try_branch(self, branch):
        if branch.type == "TRY":
            self._try_depth += 1

    def end_try_branch(self, branch):
        if branch.type == "TRY":
            self._try_depth -= 1

    def start_keyword(self, keyword: Keyword):
        self._child_failed.append(False)

    def end_keyword(self, keyword: Keyword):
        child_already_counted = self._child_failed.pop()
        if self._try_depth > 0 and keyword.failed and keyword.message and not child_already_counted:
            self._exception_counts[keyword.message[:150]] += 1
        if self._child_failed and keyword.failed:
            self._child_failed[-1] = True

    def get_aggregated_exceptions(self):
        return [
            (self.run_time, message, count)
            for message, count in self._exception_counts.items()
        ]
