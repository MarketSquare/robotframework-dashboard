@echo off
REM Run all Robot Framework tests in tests/robot/testsuites/; see robot-tests.sh for the rerun/merge logic.
set PABOT_ARGS=--pabotlib --testlevelsplit --artifacts png,jpg --artifactsinsubfolders --processes 4 -d results
set SUITES=.\tests\robot\testsuites\*.robot

pabot %PABOT_ARGS% %SUITES%
set RC=%ERRORLEVEL%
if %RC% EQU 0 exit /b 0
if %RC% GEQ 250 exit /b %RC%
if not exist results\output.xml exit /b %RC%

echo.
echo ===== %RC% test(s) failed, rerunning the failed tests once =====
copy /y results\output.xml results\first_output.xml >nul
pabot %PABOT_ARGS% --rerunfailed results\first_output.xml --output rerun_output.xml --log rerun_log.html --report rerun_report.html %SUITES%

rebot --merge -d results --output output.xml --log log.html --report report.html results\first_output.xml results\rerun_output.xml
exit /b %ERRORLEVEL%
