#!/usr/bin/env bash


# Create empty directories if they do not exist
if [[ ! -e backups ]]; then
    mkdir backups;
fi
if [[ ! -e uploads ]]; then
    mkdir -p uploads/{all,avatars,gallery,stickers};
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

# Create config directory if it does not exist
if [[ ! -e config ]]; then
    mkdir config;
fi

# Initialize plugins.txt
if [[ ! -e config/plugins.txt ]]; then
    cp app/template/plugins.txt.template config/plugins.txt;
fi

# Initialize ranks.json
if [[ ! -e config/ranks.json ]]; then
    cp app/template/ranks.json.template config/ranks.json;
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
