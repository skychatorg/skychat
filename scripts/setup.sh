#!/usr/bin/env bash

# Initialize db
if [[ ! -e database/main.db ]]; then
    sqlite3 database/main.db < database/install.sql;
fi

# Initialize .env.json
if [[ ! -e .env.json ]]; then
    cp .env.json.template .env.json;

    # Generate random salts
    generate_salt() {
        RDM=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1);
        sed -i "0,/\$RANDOM/{s/\$RANDOM/$RDM/}" .env.json
    }

    # We call the function twice to replace the two salts
    generate_salt;
    generate_salt;
fi

# Initialize stickers.json
if [[ ! -e stickers.json ]]; then
    cp stickers.json.template stickers.json;
fi

# Initialize config.json
if [[ ! -e config.json ]]; then
    cp config.json.template config.json;
fi
