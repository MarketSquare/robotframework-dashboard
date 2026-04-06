#!/usr/bin/env bash

die() { echo "FATAL: $*"; exit 1; }
IMAGE=

[ $# -gt 0 ] || die "Missing argument for container type (robot, python, js) to use"
[ $# -gt 1 ] || die "Missing command to run in the container"
[ "$1" = robot ] && IMAGE=test-dashboard-robot
[ "$1" = python ] && IMAGE=test-dashboard-python
[ "$1" = js ] && IMAGE=test-dashboard-js
[ -n "$IMAGE" ] || die "Unknown container type ($1)"
shift

docker -v 2> /dev/null ||
    die "Docker seems not being installed"
[ -n "$(docker images -q "$IMAGE" 2> /dev/null)" ] || 
    die "Docker image $IMAGE not found, please run 'scripts/docker/create-test-image.sh $1'"
[ -d .git ] ||
    die "you need to start this script from the toplevel directory of the robotframework-dashboard repository"

USER_MAPPING="--user $(id -u):$(id -g)"
[ "$(uname -o)" = Msys ] && USER_MAPPING=""

docker run -it --rm --ipc=host -v"/$(pwd)":/robotframework-dashboard $USER_MAPPING $IMAGE "${@}"
