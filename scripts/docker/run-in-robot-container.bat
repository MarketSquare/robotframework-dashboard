@ECHO OFF
ECHO Deploying current workingdirectory into the container and running "%*"
scripts\docker\run-in-container.bat robot bash -c "pip install .; export PATH=$PATH:~/.local/bin; %*"
