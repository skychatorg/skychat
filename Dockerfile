FROM node:10

# Create app dir
WORKDIR /usr/src/app

# Copy dependencies first
COPY package*.json ./
RUN npm install

# Copy all project
COPY . .

# Run app
EXPOSE 8080
CMD [ "npm", "start" ]
