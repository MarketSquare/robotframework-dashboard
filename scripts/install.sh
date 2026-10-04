#!/usr/bin/env bash

pip3 install ".[all]"
# the CI test image is rebuilt from requirements-test.txt only on main, so a PR that changes it needs this
pip3 install -r requirements-test.txt
rm -rf dist/ build/ robotframework_dashboard.egg-info/
