#!/usr/bin/env bash
#
# Creates a docker image to used to run tests locally, without
# installing all the required tool into your system

die() { echo "FATAL: $*"; exit 1; }

docker -v || die "docker seems not being installed"

docker build --tag test-dashboard -f tests/test-image.dockerfile "${@}" .

# To run the container in an interactive mode:
#   docker run -it --rm --ipc=host -v.:/robotframework-dashboard --user 1000:1000 test-dashboard
# Within the container install the current code from the working directory
#   pip install .
# add the ~/.local/bin to your path
#   export PATH=$PATH:~/.local/bin
# and run the tests, e.g.
#   robot tests/robot/testsuites/06_filters.robot
#