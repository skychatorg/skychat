#!/usr/bin/env bash

sqlite3 database.db < db/install.sql;

ENV_FILE=".env.json";
if [[ ! -e "$ENV_FILE" ]]; then
    echo '{
        "location": "http://localhost:8080",
        "hostname": "localhost",
        "port": 8080,
        "ssl": {
            "certificate": "",
            "key": ""
        },
        "users_passwords_salt": "",
        "users_token_salt":"",
        "youtube_api_key":"",
        "op":[]
    }' > "$ENV_FILE";
fi
