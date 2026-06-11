# Pin Node 22 (mediasoup requires >= 22). The base image provides node+npm, so we
# drop `nodejs npm` from apk below and add the C++ toolchain for mediasoup-worker.
FROM node:22-alpine
EXPOSE $PUBLIC_PORT
CMD ["sh", "app/script/start-server.sh"]


ARG DOCKER_USER
ARG DOCKER_UID
ARG DOCKER_GID
ARG DOCKER_TZ

ARG PUBLIC_PORT

WORKDIR /workdir

# Needed to avoid "JavaScript heap out of memory" error
ENV NODE_OPTIONS="--max-old-space-size=8192"

# 1. Set timezone
# 2. Create local user matching the host user
# 3. Install SkyChat dependencies
RUN ln -snf "/usr/share/zoneinfo/$DOCKER_TZ" /etc/localtime && \
    echo "$DOCKER_TZ" > /etc/timezone && \
    (deluser node 2>/dev/null || true) && \
    (delgroup node 2>/dev/null || true) && \
    addgroup -g "$DOCKER_GID" "$DOCKER_USER" && \
    adduser -u "$DOCKER_UID" -G "$DOCKER_USER" -D "$DOCKER_USER" && \
    apk add --no-cache --update ffmpeg zip imagemagick python3 py3-pip make g++ linux-headers

COPY package*.json *config\.* ./

# We need to chown the workdir so we can create node_modules in the last step
RUN chown "$DOCKER_UID:$DOCKER_GID" /workdir

USER $DOCKER_UID:$DOCKER_GID

COPY app app

# --ignore-scripts skips mediasoup's postinstall worker build, so build it explicitly.
RUN npm ci --ignore-scripts && \
    npm rebuild mediasoup

RUN npm run build:server
