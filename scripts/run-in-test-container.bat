@docker -v
@IF %ERRORLEVEL% == 0 GOTO DOCKER_FOUND
@ECHO Could not start the docker command. Make sure that you have installed 
@ECHO Docker Desktop on your system (see CONTRIBUTING.md)
@EXIT 1

:DOCKER_FOUND
@SET IMAGE_ID=
@FOR /F %%I IN ('docker image ls -q test-dashboard') DO @SET "IMAGE_ID=%%I"
@IF NOT [%IMAGE_ID%] == [] GOTO IMAGE_FOUND

:IMAGE_FOUND
@IF exist robotframework_dashboard\robotdashboard.py GOTO WORKSPACE_FOUND
@ECHO It looks like that you are not in the top-level workspace directory of the
@ECHO robotframework_dashboard repository. Please start this script from there.
@EXIT 1

:WORKSPACE_FOUND
@IF NOT [%1] == [] GOTO CMD_GIVEN
docker run -it --rm --ipc=host -v.:/robotframework-dashboard test-dashboard
@GOTO END

:CMD_GIVEN
@docker run -it --rm --ipc=host -v.:/robotframework-dashboard test-dashboard /bin/bash -c "pip install .; %*"

:END
