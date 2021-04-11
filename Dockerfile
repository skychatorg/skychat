FROM node:10

# Create app dir
WORKDIR /app/skychat/

# Create local user
RUN useradd -m skychat

# Mount volumes
RUN ln -s /var/skychat/config   ./config
RUN ln -s /var/skychat/avatars  ./avatars
RUN ln -s /var/skychat/database ./database
RUN ln -s /var/skychat/scripts  ./scripts
RUN ln -s /var/skychat/stickers ./stickers
RUN ln -s /var/skychat/storage  ./storage
RUN ln -s /var/skychat/uploads  ./uploads

# Copy build configuration
COPY package*.json gulpfile.js tsconfig.*.json webpack.config.js ./

# Copy application .env file
COPY .env.json ./

# Copy source files
COPY ./app ./app

# Change files permissions
RUN chown -R skychat:skychat ./

# Change to non-root privilege
USER skychat

# Copy dependencies first
RUN npm install

# Expose app port
EXPOSE 8080

# Build app
ENV GENERATE_SOURCEMAP false
RUN NODE_OPTIONS="--max-old-space-size=8192" npm run build

# Run app
CMD [ "node", "build/server.js" ]
