#!/usr/bin/env sh

# Create empty directories if they do not exist
if [ ! -e backups ]; then
    mkdir backups;
fi
if [ ! -e uploads ]; then
    mkdir -p uploads/{all,avatars,stickers};
fi
if [ ! -e gallery ]; then
    mkdir -p gallery;
fi
if [ ! -e storage ]; then
    mkdir -p storage;
fi
if [ ! -e storage/plugins ]; then
    mkdir -p storage/plugins;
fi
if [ ! -e storage/rooms ]; then
    mkdir -p storage/rooms;
fi
if [ ! -e app/database/data ]; then
    mkdir -p app/database/data;
fi
if [ ! -e app/filebrowser/data ]; then
    mkdir -p app/filebrowser/data;
    touch app/filebrowser/data/filebrowser.db;
fi

# Initialize .env
if [ ! -e .env ]; then
    cp app/template/.env.template .env;

    DOCKER_USER="$USER"
    sed -i "0,/\$DOCKER_USER/{s/\$DOCKER_USER/$DOCKER_USER/}" .env

    DOCKER_UID="$(id -u)"
    sed -i "0,/\$DOCKER_UID/{s/\$DOCKER_UID/$DOCKER_UID/}" .env

    DOCKER_GID="$(id -g)"
    sed -i "0,/\$DOCKER_GID/{s/\$DOCKER_GID/$DOCKER_GID/}" .env
fi

# Create config directory if it does not exist
if [ ! -e config ]; then
    mkdir config;
fi

# Initialize stickers.json
if [ ! -e config/stickers.json ]; then
    cp app/template/stickers.json.template config/stickers.json;
fi

# Initialize preferences.json
if [ ! -e config/preferences.json ]; then
    cp app/template/preferences.json.template config/preferences.json;
fi

# Initialize guest names list file
if [ ! -e config/guestnames.txt ]; then
    cp app/template/guestnames.txt.template config/guestnames.txt;
fi

# Initialize fake messages list file
if [ ! -e config/fakemessages.txt ]; then
    cp app/template/fakemessages.txt.template config/fakemessages.txt;
fi

# Initialize welcome.txt.template
if [ ! -e config/welcome.txt.template ]; then
    cp app/template/welcome.txt.template config/welcome.txt;
fi
