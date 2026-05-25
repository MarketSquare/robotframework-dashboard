#!/usr/bin/env bash
set -e

# Run all Robot Framework tests in tests/robot/testsuites/
pabot \
  --pabotlib \
  --testlevelsplit \
  --artifacts png,jpg \
  --artifactsinsubfolders \
  --processes 2 \
  -d results \
  tests/robot/testsuites/*.robot
