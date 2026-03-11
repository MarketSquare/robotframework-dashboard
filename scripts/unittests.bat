set COVERAGE_FILE=results/.coverage
set PYTHONPATH=%~dp0..
python -m pytest tests/ --cov=robotframework_dashboard --cov-report=term-missing --cov-report=html:results/coverage
