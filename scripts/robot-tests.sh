#!/usr/bin/env bash
# Run all Robot Framework tests in tests/robot/testsuites/.
#
# Failed tests are rerun once and the results merged (rebot --merge), so a transient
# browser-launch crash or UI timing race does not fail the pipeline. The merged
# results/output.xml + log.html are what CI uploads; the first attempt is kept as
# results/first_output.xml, the rerun as results/rerun_output.xml.

# ROBOT_PROCESSES: parallel pabot processes (GitHub ubuntu-latest has 4 vCPU; browser tests are CPU bound)
PABOT_ARGS=(--pabotlib --testlevelsplit --artifacts png,jpg --artifactsinsubfolders --processes "${ROBOT_PROCESSES:-4}" -d results)
SUITES=(tests/robot/testsuites/*.robot)

pabot "${PABOT_ARGS[@]}" "${SUITES[@]}"
rc=$?
[ "$rc" -eq 0 ] && exit 0
# robot exit codes >= 250 mean the run itself broke (invalid data, ...) -> nothing sensible to rerun
{ [ "$rc" -ge 250 ] || [ ! -f results/output.xml ]; } && exit "$rc"

echo
echo "===== $rc test(s) failed, rerunning the failed tests once ====="
cp results/output.xml results/first_output.xml
pabot "${PABOT_ARGS[@]}" \
  --rerunfailed results/first_output.xml \
  --output rerun_output.xml --log rerun_log.html --report rerun_report.html \
  "${SUITES[@]}"

# exit code of rebot is the number of tests still failing after the merge
rebot --merge -d results --output output.xml --log log.html --report report.html \
  results/first_output.xml results/rerun_output.xml
