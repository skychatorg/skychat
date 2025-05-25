FROM nginxinc/nginx-unprivileged:alpine3.21-perl
EXPOSE 80

COPY gallery /usr/share/nginx/html/gallery
COPY uploads /usr/share/nginx/html/uploads

COPY app/static/nginx.default.conf /etc/nginx/conf.d/default.conf

CMD ["nginx", "-g", "daemon off;"]
