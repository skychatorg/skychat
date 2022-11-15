#!/usr/bin/env bash

# Initial build (so nodemon can start)
babel -x .ts app/api -d build/api
babel -x .ts app/server -d build/server

# Start babel watch, nodemon & vite
concurrently \
    "babel --watch --skip-initial-build -x .ts app/api -d build/api" \
    "babel --watch --skip-initial-build -x .ts app/server -d build/server" \
    "nodemon --watch build/server build/server/server.js" \
    "vite"
