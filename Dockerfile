FROM node:16

# Arguments
ARG UNAME=skychat
ARG UID=1000
ARG GID=1000
ARG DOCKER_PORT=8080
ARG DOCKER_TZ=America/Denver

# Install zip (required for managing backups)
RUN apt-get update -y && apt-get -y install zip ffmpeg

# Set timezone
RUN ln -snf /usr/share/zoneinfo/$DOCKER_TZ /etc/localtime
RUN echo $DOCKER_TZ > /etc/timezone

# Create a local user corresponding to the host one
RUN groupadd -g $GID -o $UNAME
RUN useradd -m -u $UID -g $GID -o -s /bin/bash $UNAME

# Create app dir 
WORKDIR /app/skychat/

# Mount volumes
RUN ln -s /var/skychat/config   ./config
RUN ln -s /var/skychat/backups  ./backups
RUN ln -s /var/skychat/storage  ./storage
RUN ln -s /var/skychat/gallery  ./gallery
RUN ln -s /var/skychat/uploads  ./uploads

# Copy build configuration
COPY .env.json package*.json *config.* ./

# Copy source files
COPY ./app ./app

# Change files permissions
RUN chown -R $UNAME:$UNAME ./

# Change to non-root privilege
USER $UNAME

# Install dependencies
RUN npm install

# Expose app port
EXPOSE $DOCKER_PORT

# Build app
ENV GENERATE_SOURCEMAP false
RUN NODE_OPTIONS="--max-old-space-size=8192" npm run build

# Run app
CMD [ "node", "build/server/server.js" ]
