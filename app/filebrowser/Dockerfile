FROM alpine:3.21.3
EXPOSE 80
CMD ["filebrowser", "-a", "0.0.0.0", "-p", "80", "-b", "/filebrowser", "-r", "files"]

ARG DOCKER_USER
ARG DOCKER_UID
ARG DOCKER_GID

WORKDIR /app

# Install filebrowser
RUN apk add --no-cache --update curl bash && \
    curl -fsSL https://raw.githubusercontent.com/filebrowser/get/master/get.sh | bash && \
    addgroup -g "$DOCKER_GID" "$DOCKER_USER" && \
    adduser -u "$DOCKER_UID" -G "$DOCKER_USER" -D "$DOCKER_USER" && \
    mkdir files && \
    ln -s /mnt/skychat/gallery ./files/gallery && \
    ln -s /mnt/skychat/uploads ./files/uploads && \
    chown "$DOCKER_UID:$DOCKER_GID" /app

# Change user
USER $DOCKER_UID:$DOCKER_GID
