#!/usr/bin/env bash
set -e

# vitest loads its runner twice and fails every file with "reading 'config'"
# when the working directory has a lower case drive letter (c:\ in VS Code on Windows)
if [[ "$OSTYPE" == msys* || "$OSTYPE" == cygwin* ]]; then
    cd "$(pwd | sed -E 's#^/([a-z])/#/\U\1/#')"
fi

# Run all JavaScript unit tests in tests/javascript/
npx vitest run --reporter=verbose
