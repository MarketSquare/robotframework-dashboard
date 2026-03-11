#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COVERAGE_FILE=results/.coverage PYTHONPATH="$SCRIPT_DIR/.." python -m pytest tests/ --cov=robotframework_dashboard --cov-report=term-missing --cov-report=html:results/coverage --cov-report=xml:coverage.xml
