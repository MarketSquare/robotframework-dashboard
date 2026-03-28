#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
mkdir -p results results/coverage
# Run all Python unit tests in tests/python/ and collect coverage
COVERAGE_FILE=results/.coverage PYTHONPATH="$SCRIPT_DIR/.." python -m pytest tests/ --cov=robotframework_dashboard --cov-report=term-missing --cov-report=html:results/coverage --cov-report=xml:results/coverage.xml
