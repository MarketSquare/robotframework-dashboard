*** Settings ***
Library    OperatingSystem


*** Keywords ***
Validate CLI
    [Arguments]    ${command}    ${expected}=${NONE}
    ${result}    Run    command=${command}
    IF    '${expected}' != '${NONE}'
        ${expected}    Get File    path=${CURDIR}/../cli_output/${expected}.txt
        Should Match    string=${result}    pattern=${expected}
    END
