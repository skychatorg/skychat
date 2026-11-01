#!/bin/sh

# Same check as the traefik routing in dynamic.yml
if [ "$ADMIN_FILEBROWSER_ENABLED" != "true" ]; then
    echo "Filebrowser is disabled."
    exit 0
fi

# Refuse to start without http auth
if [ -z "$ADMIN_FILEBROWSER_AUTH" ]; then
    echo "⚠️ Filebrowser is enabled but no authentication method is set. Please set ADMIN_FILEBROWSER_AUTH."
    exit 1
fi

filebrowser config set --auth.method=noauth
filebrowser -a 0.0.0.0 -p 80 -b /filebrowser -r files -c /config/settings.json
