FROM nginxinc/nginx-unprivileged:alpine3.21-perl
EXPOSE 80

COPY app/static/nginx.default.conf /etc/nginx/conf.d/default.conf

CMD ["nginx", "-g", "daemon off;"]
