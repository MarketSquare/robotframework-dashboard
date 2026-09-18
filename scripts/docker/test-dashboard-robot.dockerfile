# Image for the robot acceptance tests, used both locally (scripts/docker/run-in-robot-container.sh)
# and in CI (.github/workflows/tests.yml pulls the copy that test-image.yml publishes to GHCR).
#
# Stage 1 installs everything on top of the Playwright image for ubuntu 22.04; that base is kept so
# fonts and system libraries stay identical to the reference screenshots. Stage 2 stages the
# filesystem in a few large pieces and stage 3 copies them into a fresh image: that is what actually
# shrinks it (files deleted in stage 1 - Firefox, WebKit, pip/apt caches - would otherwise still be
# carried in the base layers), and a handful of similar-sized layers is pulled in parallel, which a
# single flattened layer is not. test-image.yml pushes the layers zstd-compressed, which decompresses
# much faster than gzip on the CI runner.
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

FROM build AS split
RUN <<SPLIT
    set -e
    # everything outside /usr, /ms-playwright (cp -a keeps the bin -> usr/bin style symlinks)
    mkdir -p /split/rest /split/usr-rest/usr
    cd /
    for d in bin boot etc home lib lib32 lib64 libx32 media mnt opt root run sbin srv tmp var; do
        [ -e "$d" ] && cp -a "$d" /split/rest/
    done
    # /usr without its two big subtrees, which get layers of their own
    cd /usr
    for d in *; do
        case "$d" in local|lib) ;; *) cp -a "$d" /split/usr-rest/usr/ ;; esac
    done
SPLIT

FROM scratch
COPY --from=split /split/rest /
COPY --from=split /split/usr-rest /
COPY --from=build /usr/lib /usr/lib
COPY --from=build /usr/local /usr/local
COPY --from=build /ms-playwright /ms-playwright

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
