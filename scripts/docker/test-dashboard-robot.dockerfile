# Base of the image is the playwright image for ubuntu 22.04
FROM mcr.microsoft.com/playwright:v1.56.0-jammy

# we need the test requirements to be withing the image to install them
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
