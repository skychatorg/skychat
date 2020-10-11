#!/usr/bin/env bash

# Initialize db
if [[ ! -e database/main.db ]]; then
    sqlite3 database/main.db < database/install.sql;
fi

# Initialize .env.json
if [[ ! -e .env.json ]]; then
    cp .env.json.template .env.json;
fi

# Initialize stickers.json
if [[ ! -e stickers.json ]]; then
    cp stickers.json.template stickers.json;
fi

# Initialize config.json
if [[ ! -e config.json ]]; then
    cp config.json.template config.json;
fi
