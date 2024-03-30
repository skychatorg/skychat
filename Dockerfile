FROM alpine:latest


# User definition to use to modify host folders
ARG DOCKER_USER
ARG DOCKER_UID
ARG DOCKER_GID

# Port to use to communicate with the container
ARG PUBLIC_PORT

# Container timezone
ARG DOCKER_TZ

# Workdir
WORKDIR /app/skychat/

# Needed to avoid "JavaScript heap out of memory" error
ENV NODE_OPTIONS="--max-old-space-size=8192"

# 1. Set timezone
# 2. Add symlings to storage in workdir
# 3. Install SkyChat dependencies
RUN ln -snf "/usr/share/zoneinfo/$DOCKER_TZ" /etc/localtime && \
    echo $DOCKER_TZ > /etc/timezone && \
    addgroup -g "$DOCKER_GID" "$DOCKER_USER" && \
    adduser -u "$DOCKER_UID" -G "$DOCKER_USER" -D "$DOCKER_USER" && \
    ln -s /mnt/skychat/config ./config && \
    ln -s /mnt/skychat/backups ./backups && \
    ln -s /mnt/skychat/storage ./storage && \
    ln -s /mnt/skychat/gallery ./gallery && \
    ln -s /mnt/skychat/uploads ./uploads && \
    apk add --no-cache --update nodejs npm zip ffmpeg

# Copy build configuration
COPY .env.json package*.json *config\.* ./

# Install dependencies
RUN npm ci --ignore-scripts

# Change files permissions
RUN chown "$DOCKER_UID:$DOCKER_GID" /app/skychat

# Change to non-root privilege
USER $DOCKER_UID:$DOCKER_GID

# Copy source files
COPY ./app ./app

# Build
RUN npm run build

# Expose app port
EXPOSE $PUBLIC_PORT

# Run app
CMD [ "node", "build/server/server.js" ]
