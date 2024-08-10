#!/bin/bash

source .env

DOCKER_CONTAINER_ID=$(docker ps | grep skychat_db | awk '{print $1}')

docker exec -it "$DOCKER_CONTAINER_ID" /usr/local/bin/psql "--user=$POSTGRES_USER" "$POSTGRES_DB"
