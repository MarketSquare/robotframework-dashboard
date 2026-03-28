#!/usr/bin/env bash
set -e

# Run all JavaScript unit tests in tests/javascript/
npx vitest run --reporter=verbose
