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
