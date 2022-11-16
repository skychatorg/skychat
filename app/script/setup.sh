#!/usr/bin/env bash

# Create empty directories if they do not exist
if [[ ! -e backups ]]; then
    mkdir backups;
fi
if [[ ! -e uploads ]]; then
    mkdir -p uploads/{all,avatars,stickers};
fi
if [[ ! -e gallery ]]; then
    mkdir -p gallery;
fi
if [[ ! -e storage ]]; then
    mkdir -p storage/{plugins,rooms};
fi

# Initialize .env.json
if [[ ! -e .env.json ]]; then
    cp app/template/.env.json.template .env.json;

    # Generate random salts
    generate_salt() {
        RDM=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1);
        sed -i "0,/\$SALT/{s/\$SALT/$RDM/}" .env.json
    }

    # Generate passcodes
    generate_passcode() {
        RDM=$(cat /dev/urandom | tr -dc '0-9' | fold -w 4 | head -n 1);
        sed -i "0,/\$PASSCODE/{s/\$PASSCODE/$RDM/}" .env.json
    }

    # Generate the two salts
    generate_salt
    generate_salt

    # Generate passcode (op_passcode)
    generate_passcode
fi

# Initialize .env
if [[ ! -e .env ]]; then
    cp app/template/.env.template .env;

    DOCKER_USER="$USER"
    sed -i "0,/\$DOCKER_USER/{s/\$DOCKER_USER/$DOCKER_USER/}" .env

    DOCKER_UID="$(id -u)"
    sed -i "0,/\$DOCKER_UID/{s/\$DOCKER_UID/$DOCKER_UID/}" .env

    DOCKER_GID="$(id -g)"
    sed -i "0,/\$DOCKER_GID/{s/\$DOCKER_GID/$DOCKER_GID/}" .env
fi

# Create config directory if it does not exist
if [[ ! -e config ]]; then
    mkdir config;
fi

# Initialize stickers.json
if [[ ! -e config/stickers.json ]]; then
    cp app/template/stickers.json.template config/stickers.json;
fi

# Initialize preferences.json
if [[ ! -e config/preferences.json ]]; then
    cp app/template/preferences.json.template config/preferences.json;
fi

# Initialize guest names list file
if [[ ! -e config/guestnames.txt ]]; then
    cp app/template/guestnames.txt.template config/guestnames.txt;
fi

# Initialize fake messages list file
if [[ ! -e config/fakemessages.txt ]]; then
    cp app/template/fakemessages.txt.template config/fakemessages.txt;
fi
