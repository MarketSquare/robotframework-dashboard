*** Settings ***
Documentation    This testsuite covers the Command Line Interface of robotdashboard
Library    pabot.pabotlib
Resource    ../resources/keywords/cli-keywords.resource
Resource    ../resources/keywords/general-keywords.resource
Suite Teardown    Run Teardown Only Once    keyword=Remove Database And Dashboard


*** Variables ***
${OUTPUTS_FOLDER}    ${CURDIR}/../resources/outputs


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
    Validate CLI    command=robotdashboard -d o.db -o ${OUTPUTS_FOLDER}/output-20260818-021545.xml:tag1   expected=outputpath

Validate RobotDashboard outputpath
    Validate CLI    command=robotdashboard -d outputpath.db --outputpath ${OUTPUTS_FOLDER}/output-20260818-021545.xml
    ...       expected=outputpath

Validate RobotDashboard f
    Validate CLI    command=robotdashboard -d f.db -f ${OUTPUTS_FOLDER}    expected=outputfolderpath

Validate RobotDashboard outputfolderpath
    Validate CLI    command=robotdashboard -d outputfolderpath.db --outputfolderpath ${OUTPUTS_FOLDER}:tag1:tag2    expected=outputfolderpath

Validate RobotDashboard r
    Validate CLI    command=robotdashboard -d r.db --outputfolderpath ${OUTPUTS_FOLDER}
    Validate CLI    command=robotdashboard -d r.db -r "index=0:3;-1;6,run_start=2026-09-01 02:15:19.481484,alias=abc,tag=tag1"    expected=removerun

Validate RobotDashboard removerun
    Validate CLI    command=robotdashboard -d removerun.db --outputfolderpath ${OUTPUTS_FOLDER}
    Validate CLI
    ...    command=robotdashboard -d removerun.db --removerun "index=0:3;-1;6" --removerun "run_start=2026-09-01 02:15:19.481484" --removerun alias=abc,tag=tag1
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
    [Documentation]    example/database/sqlite3.py is the reference copy of the built-in database class; it is loaded
    ...    through the --databaseclass import path and must process an output like the built-in one does.
    Validate CLI    command=robotdashboard -d c.db -c example/database/sqlite3.py -o ${OUTPUTS_FOLDER}/output-20260910-060011.xml    expected=databaseclass

Validate RobotDashboard databaseclass
    Validate CLI    command=robotdashboard -d databaseclass.db --databaseclass ./example/database/sqlite3.py -o ${OUTPUTS_FOLDER}/output-20260910-060011.xml    expected=databaseclass

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
