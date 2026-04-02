docker run -it --rm --ipc=host -v.:/robotframework-dashboard test-dashboard /bin/bash -c "pip install .; %*"
