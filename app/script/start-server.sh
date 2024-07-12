#!/bin/sh

node build/server/server.js | npx pino-pretty
