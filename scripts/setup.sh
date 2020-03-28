#!/usr/bin/env bash

sqlite3 database.db < db/install.sql;

ENV_FILE=".env.json";
if [[ ! -e "$ENV_FILE" ]]; then
    echo '{"users_passwords_salt": ""}' > "$ENV_FILE";
fi
