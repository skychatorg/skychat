FROM postgres:16-alpine
CMD ["postgres"]

ARG DOCKER_USER
ARG DOCKER_UID
ARG DOCKER_GID

# Install pgloader (needed for migration from sqlite)
RUN apk --update add pgloader

# Change workdir
WORKDIR /app

# Create a non-root user and group with the specified UID and GID
RUN addgroup -g "$DOCKER_GID" "$DOCKER_USER" && \
    adduser -u "$DOCKER_UID" -G "$DOCKER_USER" -D "$DOCKER_USER" && \
    chown -R "$DOCKER_USER:$DOCKER_USER" .

USER $DOCKER_UID:$DOCKER_GID
