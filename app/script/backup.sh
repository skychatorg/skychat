#!/usr/bin/env bash


# Constants
BACKUP_DIRS="config storage uploads/avatars uploads/stickers"
BACKUP_LOCATION="backups"


# Do backup
BACKUP_FILENAME=$(date +%F-%H-%M-%S-%N)
BACKUP_FILEPATH="$BACKUP_LOCATION/$BACKUP_FILENAME.zip"

# Create file dir & make backup
zip -r $BACKUP_FILEPATH $BACKUP_DIRS > /dev/null

# Echo new backup filepath
echo $BACKUP_FILEPATH
