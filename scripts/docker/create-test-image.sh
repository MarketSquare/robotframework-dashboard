#!/usr/bin/env bash
#
# Creates a docker image to used to run tests locally, without
# installing all the required tool into your system

die() { echo "FATAL: $*"; exit 1; }

IMAGE=

[ $# -gt 0 ] || die "Missing argument for container type (robot, python, js) to use"
[ "$1" = robot ] && IMAGE=test-dashboard-robot
[ "$1" = python ] && IMAGE=test-dashboard-python
[ "$1" = js ] && IMAGE=test-dashboard-js
[ -n "$IMAGE" ] || die "Unknown container type ($1)"
shift

docker -v || die "docker seems not being installed"

docker build --tag $IMAGE -f scripts/docker/$IMAGE.dockerfile "${@}" .

# To run the container in an interactive mode:
#   docker run -it --rm --ipc=host -v.:/robotframework-dashboard --user 1000:1000 test-dashboard-robot
# Within the container install the current code from the working directory
#   pip install .
# add the ~/.local/bin to your path
#   export PATH=$PATH:~/.local/bin
# and run the tests, e.g.
#   robot tests/robot/testsuites/06_filters.robot
#