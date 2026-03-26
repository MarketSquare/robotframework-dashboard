*** Settings ***
Library    OperatingSystem
Library    pabot.pabotlib
Suite Setup    Set Environment
Suite Teardown    Run Teardown Only Once    keyword=Teardown
Test Timeout    60s


*** Keywords ***
Set Environment
    ${OS}    Evaluate    platform.system()    modules=platform
    VAR    ${OS}    ${OS}    scope=GLOBAL 

Teardown
    Remove Index
    Move All Screenshots

Remove Index
    Remove File    path=index.txt

Move All Screenshots
    # All screenshots in pabot dirs have to go to a central screenshot dir to be able to see them in the log.html file
    @{directories}    List Directories In Directory    path=${CURDIR}/../../results/pabot_results
    FOR    ${directory}    IN    @{directories}
        VAR    ${pabot_dir}    ${CURDIR}/../../results/pabot_results/${directory}/screenshots
        ${exists}    Run Keyword And Return Status    Directory Should Exist    path=${pabot_dir}
        IF    ${exists}
            @{files}    List Files In Directory    path=${pabot_dir}
            FOR    ${file}    IN    @{files}
                IF    '.jpg' in $file
                    Move File    source=${pabot_dir}/${file}    destination=${CURDIR}/../../results/screenshots/${directory}-${file}
                END
            END
        END
    END
