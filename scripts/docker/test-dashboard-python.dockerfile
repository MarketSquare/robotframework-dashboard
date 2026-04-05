# Base of the image is the latest ubuntu like 24.04 LTS
FROM ubuntu:latest

RUN << FOE
    # install python
    apt-get update

    apt-get install -y python3.12 python3 python-is-python3 python3-pip
FOE

# we need the test requirements file withing the image to install them
COPY requirements-dev.txt /tmp/requirements-dev.txt
RUN << FOE
    # Install requirements
    pip3 install -r /tmp/requirements-dev.txt --break-system-packages
FOE

# create a workspace directory, where we mount the repo into
WORKDIR /robotframework-dashboard
