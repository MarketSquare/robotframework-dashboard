# Base of the image is the latest ubuntu like 24.04 LTS
FROM ubuntu:latest

RUN << FOE
    # Install prereqs
    apt-get update

    apt install -y curl
FOE

RUN << FOE
    # Download and install nvm:
    curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
    apt install -y nodejs

    # Verify the Node.js version:
    node -v # Should print "v24.14.1".

    # Verify npm version:
    npm -v # Should print "11.11.0".
FOE

# create a workspace directory, where we mount the repo into
WORKDIR /robotframework-dashboard
