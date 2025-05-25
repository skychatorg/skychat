#!/bin/bash

# Log web server
docker container logs -n 1000 -f $(docker container list | grep skychat_backend | cut -d' ' -f1) | pino-pretty
