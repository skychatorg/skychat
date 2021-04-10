FROM node:12

# Create app dir
WORKDIR /app/skychat/

# Mount volumes
RUN ln -s /var/skychat/avatars  ./avatars
RUN ln -s /var/skychat/database ./database
RUN ln -s /var/skychat/scripts  ./scripts
RUN ln -s /var/skychat/stickers ./stickers
RUN ln -s /var/skychat/storage  ./storage
RUN ln -s /var/skychat/uploads  ./uploads

# Copy env/conf files
COPY package*.json .env.json config.json fakemessages.txt guestnames.txt gulpfile.js stickers.json tsconfig.*.json webpack.config.js ./

# Copy source files
COPY ./app ./app

# Copy dependencies first
RUN npm install

# Expose app port
EXPOSE 8080

# Run app
CMD [ "npm", "start" ]
