FROM alpine:latest


# User definition to use to modify host folders
ARG DOCKER_USER
ARG DOCKER_UID
ARG DOCKER_GID

# Port to use to communicate with the container
ARG DOCKER_PORT

# Container timezone
ARG DOCKER_TZ

# Workdir
WORKDIR /app/skychat/

# 1. Set timezone
# 2. Add symlings to storage in workdir
# 3. Install SkyChat dependencies
RUN ln -snf /usr/share/zoneinfo/$DOCKER_TZ /etc/localtime && \
    echo $DOCKER_TZ > /etc/timezone && \
    addgroup -g $DOCKER_GID $DOCKER_USER && \
    adduser -u $DOCKER_UID -G $DOCKER_USER -D $DOCKER_USER && \
    ln -s /mnt/skychat/config ./config && \
    ln -s /mnt/skychat/backups ./backups && \
    ln -s /mnt/skychat/storage ./storage && \
    ln -s /mnt/skychat/gallery ./gallery && \
    ln -s /mnt/skychat/uploads ./uploads && \
    apk add --update nodejs npm zip ffmpeg sqlite

# Copy build configuration
COPY .env.json package*.json *config\.* ./

# Copy source files
COPY ./app ./app

# Change files permissions
RUN chown -R $DOCKER_UID:$DOCKER_GID ./

# Change to non-root privilege
USER $DOCKER_UID:$DOCKER_GID

# Install dependencies
RUN npm ci && \
    npm run build

# Expose app port
EXPOSE $DOCKER_PORT

# Run app
CMD [ "node", "build/server/server.js" ]
