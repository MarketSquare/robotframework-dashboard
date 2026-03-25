#!/usr/bin/env bash
# 
# Replaces all language related settings to "C.utf8"
# Either to the sourced or to be called with some command given as argument
#   . ./local-test-env.sh
#   bash local-test-env.sh robot tests/*.robot

for e in $(env | grep -E 'LC_|LANG' | cut -d= -f 1); do
    unset $e
done
export LANG=C.utf8

[ $# -gt 0 ] && "${@}"
