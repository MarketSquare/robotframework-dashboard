@echo off
REM Run all Python unit tests in tests/python/ and collect coverage
set COVERAGE_FILE=results/.coverage
set PYTHONPATH=%~dp0..
if not exist results mkdir results
python -m pytest tests/ --cov=robotframework_dashboard --cov-report=term-missing --cov-report=html:results/coverage --cov-report=xml:results/coverage.xml
