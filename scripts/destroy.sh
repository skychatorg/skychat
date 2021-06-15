#!/usr/bin/env bash

# Remove all configuration files
rm config/*.{txt,json} .env.json

# Clear storage
rm -r storage uploads
