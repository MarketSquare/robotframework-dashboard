@ECHO OFF
REM Creates a docker image to used to run tests locally, without
REM installing all the required tool into your system

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

REM Start docker container
docker build --tag %IMAGE% -f scripts/docker/%IMAGE%.dockerfile %1 %2 %3 %4 %5 %6 %7 %8 %9  .

REM To run the container in an interactive mode:
REM   docker run -it --rm --ipc=host -v.:/robotframework-dashboard test-dashboard-robot
REM Within the container install the current code from the working directory
REM   pip install .
REM add the ~/.local/bin to your path
REM   export PATH=$PATH:~/.local/bin
REM and run the tests, e.g.
REM   robot tests/robot/testsuites/06_filters.robot
GOTO END

:ARGS_MISSING
ECHO Missing argument for container type (robot, python, js) to use
GOTO END

:TYPE_UNKNOWN
ECHO Unknown container type (robot, python, js) to use
GOTO END

:DOCKER_NOT_FOUND
ECHO Make sure that you have installed Docker Desktop on your system (see CONTRIBUTING.md)
GOTO END

:END

