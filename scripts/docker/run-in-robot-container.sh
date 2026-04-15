#!/usr/bin/env bash

echo "Deploying current workingdirectory into the container and running"
echo "   $*"
echo ""
bash scripts/docker/run-in-container.sh robot bash -c "pip install .; export PATH=\$PATH:~/.local/bin; ${*}"
