#!/usr/bin/env sh

docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build

