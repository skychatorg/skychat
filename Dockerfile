FROM alpine:latest

# Arguments passed by docker-compose
ARG DOCKER_UNAME
ARG DOCKER_UID
ARG DOCKER_GID
ARG DOCKER_PORT
ARG DOCKER_TZ

# Workdir
WORKDIR /app/skychat/

# 1. Set timezone
# 2. Create a local user
# 3. Mount storage
# 4. Install SkyChat dependencies
RUN ln -snf /usr/share/zoneinfo/$DOCKER_TZ /etc/localtime && \
    echo $DOCKER_TZ > /etc/timezone && \
    addgroup -g $DOCKER_GID $DOCKER_UNAME && \
    adduser -u $DOCKER_UID -G $DOCKER_UNAME -D $DOCKER_UNAME && \
    ln -s /var/skychat/config ./config && \
    ln -s /var/skychat/backups ./backups && \
    ln -s /var/skychat/storage ./storage && \
    ln -s /var/skychat/gallery ./gallery && \
    ln -s /var/skychat/uploads ./uploads && \
    apk add --update nodejs npm zip ffmpeg sqlite

# Copy build configuration
COPY .env.json package*.json *config\.* ./

# Copy source files
COPY ./app ./app

# Change files permissions
RUN chown -R $DOCKER_UNAME:$DOCKER_UNAME ./

# Install dependencies
RUN npm ci && \
    npm run build

# Expose app port
EXPOSE $DOCKER_PORT

# Change to non-root privilege
USER $DOCKER_UNAME

# Run app
CMD [ "node", "build/server/server.js" ]
