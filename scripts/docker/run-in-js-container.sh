#!/usr/bin/env bash

echo "Installing node.js dependencies and running '$*'"

bash scripts/docker/run-in-container.sh js bash -c "npm ci; ${*}"
