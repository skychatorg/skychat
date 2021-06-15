#!/usr/bin/env bash


# 1. Clone the repository
git clone https://github.com/skychatorg/skychat.git
cd skychat

# 2. Generates the .env.json and config files in config/
bash scripts/setup.sh
