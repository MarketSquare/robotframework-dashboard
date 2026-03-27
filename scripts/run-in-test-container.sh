#!/usr/bin/env bash

IMAGE=test-dashboard

die() { echo "FATAL: $*"; exit 1; }

docker -v 2> /dev/null ||
    die "docker seems not being installed"
[ -n "$(docker images -q "$IMAGE" 2> /dev/null)" ] || 
    die "image $IMAGE not found, please run scripts/create-test-image.sh"
[ -d .git ] ||
    die "you need to start this script from the toplevel directory of the robotframework-dashboard repository"

my_uid=$(id -u)
my_gid=$(id -g)

if [ $# = 0 ]; then
    echo "No arguments given, starting container with interactive terminal"
    echo "Hint: don't forget to install the dashboard from the git repository in the container:"
    echo "    pip install . && export PATH=\$PATH:~/.local/bin"
    echo ""
    docker run -it --rm --ipc=host -v.:/robotframework-dashboard --user ${my_uid}:${my_gid} test-dashboard
else
    echo "Deploying current workingdirectory into the container and running"
    echo "   $*"
    echo ""
    docker run -it --rm --ipc=host -v.:/robotframework-dashboard --user ${my_uid}:${my_gid} test-dashboard \
        /bin/bash -c \
            "pip install .; export PATH=\$PATH:~/.local/bin; ${*}"
fi
