*** Settings ***
Documentation    This testsuite covers the Command Line Interface of robotdashboard
Library    pabot.pabotlib
Resource    ../resources/keywords/cli-keywords.resource
Resource    ../resources/keywords/general-keywords.resource
Suite Teardown    Run Teardown Only Once    keyword=Remove Database And Dashboard


*** Variables ***
${OUTPUTS_FOLDER}    ${CURDIR}/../resources/outputs
${OS}   ${None}    # set on runtime


*** Test Cases ***
Validate RobotDashboard h
    Validate CLI    command=robotdashboard -d h.db -h    expected=help

Validate RobotDashboard help
    Validate CLI    command=robotdashboard -d help.db --help    expected=help

Validate RobotDashboard v
    Validate CLI    command=robotdashboard -d v.db -v    expected=version

Validate RobotDashboard version
    Validate CLI    command=robotdashboard -d version.db --version    expected=version

Validate RobotDashboard o
    Validate CLI    command=robotdashboard -d o.db -o ${OUTPUTS_FOLDER}/output-20250313-002222.xml:tag1   expected=outputpath

Validate RobotDashboard outputpath
    Validate CLI    command=robotdashboard -d outputpath.db --outputpath ${OUTPUTS_FOLDER}/output-20250313-002222.xml
    ...       expected=outputpath

Validate RobotDashboard f
    Validate CLI    command=robotdashboard -d f.db -f ${OUTPUTS_FOLDER}    expected=outputfolderpath

Validate RobotDashboard outputfolderpath
    Validate CLI    command=robotdashboard -d outputfolderpath.db --outputfolderpath ${OUTPUTS_FOLDER}:tag1:tag2    expected=outputfolderpath

Validate RobotDashboard r
    Validate CLI    command=robotdashboard -d r.db --outputfolderpath ${OUTPUTS_FOLDER}
    Validate CLI    command=robotdashboard -d r.db -r "index=0:3;-1;6,run_start=2025-03-13 00:27:39.871333,alias=abc,tag=tag1"    expected=removerun

Validate RobotDashboard removerun
    Validate CLI    command=robotdashboard -d removerun.db --outputfolderpath ${OUTPUTS_FOLDER}
    Validate CLI
    ...    command=robotdashboard -d removerun.db --removerun "index=0:3;-1;6" --removerun "run_start=2025-03-13 00:27:39.871333" --removerun alias=abc,tag=tag1
    ...    expected=removerun

Validate RobotDashboard d
    Validate CLI    command=robotdashboard -d databasepath.db    expected=databasepath

Validate RobotDashboard databasepath
    Validate CLI    command=robotdashboard --databasepath databasepath.db    expected=databasepath

Validate RobotDashboard n
    Validate CLI    command=robotdashboard -d n.db -n robot_dashboard.html   expected=namedashboard

Validate RobotDashboard namedashboard
    Validate CLI    command=robotdashboard -d namedashboard.db --namedashboard robot_dashboard.html   expected=namedashboard

Validate RobotDashboard l
    Validate CLI    command=robotdashboard -d l.db -l false   expected=listruns

Validate RobotDashboard listruns
    Validate CLI    command=robotdashboard -d listruns.db --listruns False    expected=listruns

Validate RobotDashboard g
    Validate CLI    command=robotdashboard -d g.db -g    expected=generatedashboard

Validate RobotDashboard generatedashboard
    Validate CLI    command=robotdashboard -d generatedashboard.db --generatedashboard false    expected=generatedashboard

Validate RobotDashboard t
    Validate CLI    command=robotdashboard -d t.db -t some-cool-title    expected=dashboardtitle

Validate RobotDashboard dashboardtitle
    Validate CLI    command=robotdashboard -d dashboardtitle.db --dashboardtitle "Another very interesting title 91239192"    expected=dashboardtitle

Validate RobotDashboard c
    [Documentation]    This test will probably fail if you don't have a custom mysql database running
    IF    '${OS}' != 'Windows'    Skip    msg=Skipping this test in the pipeline as it only runs on local machines where mysql is installed
    Validate CLI    command=robotdashboard -d c.db -c example/database/mysql.py    expected=databaseclass

Validate RobotDashboard databaseclass
    [Documentation]    This test will probably fail if you don't have a custom mysql database running
    IF    '${OS}' != 'Windows'    Skip    msg=Skipping this test in the pipeline as it only runs on local machines where mysql is installed
    Validate CLI    command=robotdashboard -d databaseclass.db --databaseclass ./example/database/mysql.py    expected=databaseclass

Validate RobotDashboard s
    Skip    msg=Might have to implement process library to run in a separate shell and do more tests
    Validate CLI    command=robotdashboard --outputfolderpath ${OUTPUTS_FOLDER} -g f
    Validate CLI    command=robotdashboard -s 127.0.0.1:8543    expected=server

Validate RobotDashboard server
    Skip    msg=Might have to implement process library to run in a separate shell and do more tests
    Validate CLI    command=robotdashboard --outputfolderpath ${OUTPUTS_FOLDER} -g f
    Validate CLI    command=robotdashboard --server default    expected=server

Validate RobotDashboard m
    Validate CLI    command=robotdashboard -d m.db -m ./example/messageconfig.txt    expected=messageconfig

Validate RobotDashboard messageconfig
    Validate CLI    command=robotdashboard -d messageconfig.db --messageconfig ./example/messageconfig.txt    expected=messageconfig

Validate RobotDashboard q
    Validate CLI    command=robotdashboard -d q.db -q -25    expected=quantity

Validate RobotDashboard quantity
    Validate CLI    command=robotdashboard -d quantity.db --quantity 100    expected=quantity

Validate RobotDashboard u
    Validate CLI    command=robotdashboard -d u.db -u    expected=uselogs

Validate RobotDashboard uselogs
    Validate CLI    command=robotdashboard -d uselogs.db --uselogs false    expected=uselogs

Validate RobotDashboard offlinedependencies
    Validate CLI    command=robotdashboard -d offlinedependencies.db --offlinedependencies    expected=offlinedependencies
