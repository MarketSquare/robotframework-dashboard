# 🛠️ Contributing

This document contains some usefull tips for contributing.

## ⚙️ Validate changes without installing the package
Sometimes it can be quite time consuming to constantly install (pip install .) the entire package to your python version.
To still run the code you can use the following command to run from the package itself. You can add all cli options you desire.
```sh
python -m robotframework_dashboard.main -n robot_dashboard.html
```
It is a good practice to make sure that after everything works like you expect to still install the package and run the same command from the installed version.
All commands should be executed from the root of the project, and can contain the same cli options as above.
```sh
pip install .
robotdashboard -n robot_dashboard.html
```

## ✅ Tests
There are three levels of tests in this project:

### Python Unit Tests
Python unit tests are located in `tests/python/` and run with pytest.
```sh
bash scripts/unittests.sh
```

### JavaScript Unit Tests
JavaScript unit tests are located in `tests/javascript/` and run with [Vitest](https://vitest.dev/).
```sh
npm install
npm run test:js
```
Or on Windows:
```
scripts\jstests.bat
```
To run in watch mode during development:
```sh
npm run test:js:watch
```

### Robot Framework End-to-End Tests
End-to-end tests are located in `tests/robot/` and cover:
- CLI
- Database
- Dashboard

All tests run automatically in GitHub Actions. They are triggered through the `.github/workflows/tests.yml` yml script. In this script details regarding the test pipeline can be found. The tests will run when:

- Creating a PR
- Pushing a commit to a PR
- Manually rerunning a workflow run in GitHub actions

Results can be found at the `PR > checks > Upload robot logs`.
The check will have a failed status if any tests has failed.

### Running Tests Locally
Perhaps you want to run the tests locally on your PC before pushing and waiting for the results from the GitHub actions. But this requires to install the required components in your native PC. In most cases this will not work as expected bacause of the differemt versions used. E.g.  screenshots taken during the tests may differ, so that the tests will fail.

Using a Docker container to run the tests in avoids both, messing up your local system with installing the required parts for the tests and getting failed tests due to your setup.

> Note: To use this methond there is no need to understand how Docker is working in detail.

To run all the tests in the Docker container in the same way as in the GitHub action:
```bash
# Linux
bash scripts/run-in-test-container.sh bash scripts/robot-tests.sh
# Windows
C:> scripts\run-in-test-container.bat bash scripts/robot-tests.sh
```

To run a individual tests out of a suite:
```bash
# Linux
bash scripts/run-in-test-container.sh robot -t "*version*" tests/robot/testsuites/00_cli.robot
# Windows
C:> scripts\run-in-test-container.bat robot -t "*version*" tests/robot/testsuites/00_cli.robot
```
To run a single test suite in such a container:
```bash
# Linux
bash scripts/run-in-test-container.sh robot tests/robot/testsuites/02_overview.robot
# Windows
C:> scripts\run-in-test-container.bat robot tests/robot/testsuites/02_overview.robot
```

> Note: It is not required to run any `pip install .` as this will be done by the script within the Docker container.

#### How does it Work
Using the script requires that you are in the top-level directory of your working copy of the git repository. When using the script, the following happens:
- It is launching a new Docker container based on the image created (see below)
- The current working directory is getting mounted to `/robotframework-dashboard` within the container
- In the container the working copy is installed by `pip install .`
- The arguments you provide are executed as a bash command within the container
    - Due to the mounted working directory all the generated results can be accessed directly 
- Once the command is completed, the running container is stopped and throw away

#### Prerequisuites and Setup
Running the tests in a Docker container requires a working docker installation. To check if your system has Docker installed check for the version:
```bash
# Linux
$ docker -v
Docker version 29.3.0, build 5927d80
# Windows
C:> docker -v
Docker version 29.3.1, build c2be9cc
```
If you have no Docker installer yet, follow the instructions to [Install Docker Engine](https://docs.docker.com/engine/install/) depending on your Linux OS. One way is to use the *convenient script*:
```bash
$ curl -fsSL https://get.docker.com -o get-docker.sh
$ sudo sh get-docker.sh
```
If you are running on Windows, follow the instructions in [Install Docker Desktop on Windows](https://docs.docker.com/desktop/setup/install/windows-install/)

Once Docker is available verify if you are allowed to run docker commands.
```bash
# Linux
$ docker ps
permission denied while trying to connect to the docker API at unix:///var/run/docker.sock
```
If you see such an error message then your user is not configured to use docker. In most Linux environments this can be done by adding your user to the `docker` group (see [Linux post-installation steps](https://docs.docker.com/engine/install/linux-postinstall/#manage-docker-as-a-non-root-user)):
```bash
$ sudo usermod -aG docker $USER
```
Don't forget to relogin to make the new group membership effective for your user.

#### Creating the Docker Image
Once Docker is working you need to generate an *image*. The image can be easily created by:
```bash
# Linux
$ bash scripts/create-test-image.sh
# Windows
C:> scripts\create-test-image.bat
```
> Note: If you are not familar with docker, imagine an *image* as an ISO image of a Linux live-CD. It is an immutable preconfigured setup of an OS which can be used to run it without installing.

The image is created in the following steps:
- It is based on the public image `mcr.microsoft.com/playwright:v1.56.0-jammy`, a *framework for Web Testing and Automation*.
    - which is based on `ubuntu:jammy` (ubuntu 22.04)
- Installs the latest `python3-pip` from the distribution
- Installs all the project requirements to perform the tests from `requirements-test.txt`
- Initializes the `robotframework-browser` library
- Creates a working directory `/robotframework-dashboard`
The image created is being used whenever a new docker container is launched by the `scripts/run-in-test-container.sh`. The image is static. To address changes in the `requirements-test.txt` you can recreate (and replace) the image by running the `create-test-image.sh` or `create-test-image.bat` once again. You can also force a complete requild of the image by:
```bash
# Linux
$ bash scripts/create-test-image.sh --no-cache
# Windows
C:> scripts\create-test-image.bat --no-cache
```

## 📖 Docs

The docs are hosted through the main branch. Only this branch will actually deploy the change you make. To locally test the documentation you can do the following:
1. Install node.js
2. Run below to install the vitepress plugin and all other dependencies
```
npm install
```
3. Run below to start the dev server on which you can see the docs. This will provide live updates.
```
npm run docs:dev
```
