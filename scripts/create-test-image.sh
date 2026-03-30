#!/usr/bin/env bash
#
# Creates a docker image to used to run tests locally, without
# installing all the required tool into your system

die() { echo "FATAL: $*"; exit 1; }

docker -v || die "docker seems not being installed"

docker build --tag test-dashboard -f - . <<EOF-EOF
FROM mcr.microsoft.com/playwright:v1.56.0-jammy

COPY requirements-test.txt /tmp/requirements-test.txt
RUN << EOF
    # Ensure pip is installed
    apt-get update
    apt-get install -y python3-pip

    # Install Robot Framework and Python dependencies
    python3 -m pip install --upgrade pip
    pip3 install -r /tmp/requirements-test.txt

    # Initialize Browser library
    rfbrowser init
EOF

# create a workspace directory, where we mount the repo into
WORKDIR /robotframework-dashboard
EOF-EOF

# Then run the container in an interactive mode:
#   docker run -it --rm --ipc=host -v.:/robotframework-dashboard --user 1000:1000 test-dashboard
# install the dashboard based on the working directory
#   pip install .
# add the ~/.local/bin to your path
#   export PATH=$PATH:~/.local/bin
# and run the tests, e.g.
#   robot tests/robot/testsuites/06_filters.robot
#