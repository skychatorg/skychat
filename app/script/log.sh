# Log web server
docker container logs -n 1000 -f $(docker container list | grep skychat_app | cut -d' ' -f1) | pino-pretty
