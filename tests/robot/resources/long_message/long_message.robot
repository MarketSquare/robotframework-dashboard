*** Settings ***
Documentation    A test with a failure message longer than the default --messagelength of 1000 characters,
...    run by "Generate Dashboard With Long Message" (general-keywords.resource).


*** Test Cases ***
Long Failure Message
    Fail    ${{ "Response body did not match: " + "x" * 1500 }}
