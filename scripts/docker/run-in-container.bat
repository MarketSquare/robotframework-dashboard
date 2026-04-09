@ECHO OFF

SET IMAGE=
IF [%1] == [] GOTO ARGS_MISSING
IF %1 == python SET IMAGE=test-dashboard-python
IF %1 == robot SET IMAGE=test-dashboard-robot
IF %1 == js SET IMAGE=test-dashboard-js
IF [%IMAGE%] == [] GOTO TYPE_UNKNOWN
SET IMAGE_TYPE=%1
SHIFT

REM Check for docker installation
docker -v
IF NOT %ERRORLEVEL% == 0 GOTO DOCKER_NOT_FOUND

REM Check for docker image
SET FOUND=
FOR /F %%I IN ('docker image ls -q %IMAGE%') DO SET "FOUND=%%I"
IF [%FOUND%] == [] GOTO IMAGE_NOT_FOUND

REM Check for workspace
IF NOT EXIST robotframework_dashboard\robotdashboard.py GOTO WORKSPACE_NOT_FOUND

REM Start docker container
docker run -it --rm --ipc=host -v.:/robotframework-dashboard %IMAGE% %1 %2 %3 %4 %5 %6 %7 %8 %9
GOTO END

:ARGS_MISSING
ECHO Missing argument for container type (robot, python, js) to use
GOTO END

:TYPE_UNKNOWN
ECHO Unknown container type (%1) to use
GOTO END

:IMAGE_NOT_FOUND
ECHO Missing container image %IMAGE%. You need to run scripts\docker\create-test-image.bat %IMAGE_TYPE%
GOTO END

:WORKSPACE_NOT_FOUND
ECHO It looks like that you are not in the top-level workspace directory of the
ECHO robotframework_dashboard repository. Please start this script from there.
GOTO END

:DOCKER_NOT_FOUND
ECHO Make sure that you have installed Docker Desktop on your system (see CONTRIBUTING.md)
GOTO END

:END
