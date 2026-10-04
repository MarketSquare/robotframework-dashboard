#!/usr/bin/env bash
# Run all Robot Framework tests in tests/robot/testsuites/.
#
# Failed tests are rerun once and the results merged (rebot --merge), so a transient
# browser-launch crash or UI timing race does not fail the pipeline. The merged
# results/output.xml + log.html are what CI uploads; the first attempt is kept as
# results/first_output.xml, the rerun as results/rerun_output.xml.
#
# Text snapshots (SnapshotLibrary) run in strict mode: a missing snapshot fails instead of being
# recorded. Record or update them with SNAPSHOT_STRICT=False, or pass --variable REFERENCE_RUN:True
# by running a suite directly (see the testing skill).

# ROBOT_PROCESSES: parallel pabot processes (GitHub ubuntu-latest has 4 vCPU; browser tests are CPU bound)
PABOT_ARGS=(--variable "SNAPSHOT_STRICT:${SNAPSHOT_STRICT:-True}" --pabotlib --testlevelsplit --artifacts png,jpg --artifactsinsubfolders --processes "${ROBOT_PROCESSES:-4}" -d results)
SUITES=(tests/robot/testsuites/*.robot)

pabot "${PABOT_ARGS[@]}" "${SUITES[@]}"
rc=$?
if [ "$rc" -eq 0 ]; then
  # --testlevelsplit means no process sees a whole suite, so the library's own unused-snapshot
  # warning never fires; check the merged usage records instead. Only here: the rerun below is a
  # filtered run and pabot clears pabot_results when it starts.
  python3 -m SnapshotLibrary unused results
  exit $?
fi
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
