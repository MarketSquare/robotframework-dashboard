#!/usr/bin/env bash
set -e

pabot \
  --pabotlib \
  --testlevelsplit \
  --artifacts png,jpg \
  --artifactsinsubfolders \
  --processes 2 \
  -d results \
  tests/e2e/testsuites/*.robot