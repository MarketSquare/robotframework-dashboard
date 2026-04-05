@REM Creates a docker image to used to run tests locally, without
@REM installing all the required tool into your system

docker build --tag test-dashboard -f tests\test-image.dockerfile %* .

@REM To run the container in an interactive mode:
@REM   docker run -it --rm --ipc=host -v.:/robotframework-dashboard test-dashboard
@REM Within the container install the current code from the working directory
@REM   pip install .
@REM add the ~/.local/bin to your path
@REM   export PATH=$PATH:~/.local/bin
@REM and run the tests, e.g.
@REM   robot tests/robot/testsuites/06_filters.robot
