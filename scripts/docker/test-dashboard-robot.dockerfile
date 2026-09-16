# Image for the robot acceptance tests, used both locally (scripts/docker/run-in-robot-container.sh)
# and in CI (.github/workflows/tests.yml pulls the copy that test-image.yml publishes to GHCR).
#
# Stage 1 installs everything on top of the Playwright image for ubuntu 22.04; that base is kept so
# fonts and system libraries stay identical to the reference screenshots. Stage 2 flattens the result
# into a single layer, which is what actually shrinks the image: files deleted in stage 1 (Firefox,
# WebKit, pip/apt caches) would otherwise still be carried in the base layers.
FROM mcr.microsoft.com/playwright:v1.56.0-jammy AS build

COPY requirements-test.txt /tmp/requirements-test.txt
RUN <<INSTALL
    set -e
    apt-get update
    apt-get install -y --no-install-recommends python3-pip

    python3 -m pip install --upgrade pip
    pip3 install -r /tmp/requirements-test.txt

    # The Browser library brings its own Playwright (node side), whose version can be newer than
    # the base image's, so it needs its own browser build. Drop the base image's browsers
    # (chromium, firefox, webkit) and install only chromium for the library's Playwright version;
    # the tests never use the other browsers.
    rm -rf /ms-playwright/*
    rfbrowser init chromium

    rm -rf /root/.cache/pip /var/lib/apt/lists/* /tmp/*
INSTALL

FROM scratch
COPY --from=build / /

# FROM scratch drops the base image's configuration; restore what the tests rely on
ENV PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# links the GHCR package built by .github/workflows/test-image.yml to this repository
LABEL org.opencontainers.image.source=https://github.com/MarketSquare/robotframework-dashboard

# create a workspace directory, where we mount the repo into
WORKDIR /robotframework-dashboard
CMD ["/bin/bash"]
