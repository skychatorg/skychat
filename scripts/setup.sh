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
if [[ ! -e config/stickers.json ]]; then
    cp config/stickers.json.template config/stickers.json;
fi

# Initialize preferences.json
if [[ ! -e config/preferences.json ]]; then
    cp config/preferences.json.template config/preferences.json;
fi

# Initialize guest names list file
if [[ ! -e config/guestnames.txt ]]; then
    cp config/guestnames.txt.template config/guestnames.txt;
fi

# Initialize fake messages list file
if [[ ! -e config/fakemessages.txt ]]; then
    cp config/fakemessages.txt.template config/fakemessages.txt;
fi
