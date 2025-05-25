#!/bin/sh

# Refuse to start if enabled but without http auth (ADMIN_FILEBROWSER_AUTH is empty)
if [ -n "$ADMIN_FILEBROWSER_ENABLED" ] && [ -z "$ADMIN_FILEBROWSER_AUTH" ]; then
    echo "⚠️ Filebrowser is enabled but no authentication method is set. Please set ADMIN_FILEBROWSER_AUTH."
    exit 1
fi

filebrowser config set --auth.method=noauth
filebrowser -a 0.0.0.0 -p 80 -b /filebrowser -r files -c /config/settings.json
