# Log web server
docker container logs -f $(docker container list | grep skychat_app | cut -d' ' -f1) | pino-pretty
