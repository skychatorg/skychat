FROM alpine:latest
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
    addgroup -g "$DOCKER_GID" "$DOCKER_USER" && \
    adduser -u "$DOCKER_UID" -G "$DOCKER_USER" -D "$DOCKER_USER" && \
    apk add --no-cache --update ffmpeg nodejs npm zip

COPY package*.json *config\.* ./

# We need to chown the workdir so we can create node_modules in the last step
RUN chown "$DOCKER_UID:$DOCKER_GID" /workdir

USER $DOCKER_UID:$DOCKER_GID

COPY app app

RUN npm ci --ignore-scripts

RUN npm run build
