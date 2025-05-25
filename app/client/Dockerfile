FROM node:24-alpine3.20 AS build

WORKDIR /workdir

ENV NODE_OPTIONS="--max-old-space-size=8192"

COPY package*.json *config\.* ./
COPY app ./app

RUN npm ci --ignore-scripts
RUN npm run build

FROM nginxinc/nginx-unprivileged:alpine3.21-perl AS production

EXPOSE 80

COPY --from=build /workdir/dist /usr/share/nginx/html

COPY app/client/nginx.default.conf /etc/nginx/conf.d/default.conf

CMD ["nginx", "-g", "daemon off;"]
