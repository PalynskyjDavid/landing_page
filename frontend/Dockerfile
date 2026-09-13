# Match .nvmrc. Pin the manifest, not just a movable tag.
FROM node:22.23.2-bookworm-slim@sha256:83f487e0a63425e5b4d146fb5e5be574bcbe1b7b843d3ebafdd95eaf7767a7e5 AS build
WORKDIR /app
ENV SCARF_ANALYTICS=false
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.js postcss.config.js ./
COPY scripts/apiDocsPlugin.js scripts/flowentoBudget.js ./scripts/
COPY src/ ./src/
COPY public/ ./public/
# Public build configuration, not a secret or a runtime Docker environment variable.
ENV VITE_API_URL=/api
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.30.4-alpine@sha256:442753882674b49ae2c1de83ed67896131c0777f56df5005e356e62bc3f7e7ce
# This app serves static files and proxies HTTP; it never loads these optional
# modules or uses curl. Removing them also removes unused TIFF/XML/image libraries.
# No package upgrade or network download: keep the pinned base reproducible.
USER root
RUN --network=none apk del nginx-module-image-filter nginx-module-xslt nginx-module-geoip nginx-module-njs curl
COPY nginx.conf /etc/nginx/nginx.conf
COPY proxy-trust.conf /etc/nginx/proxy-trust.conf
COPY --from=build /app/dist /usr/share/nginx/html
USER 101:101
EXPOSE 8080
STOPSIGNAL SIGQUIT
HEALTHCHECK --interval=5s --timeout=3s --start-period=5s --retries=12 CMD ["wget", "-q", "-O", "/dev/null", "http://127.0.0.1:8080/healthz"]
# Avoid entrypoint scripts that try to rewrite config on a read-only filesystem.
ENTRYPOINT ["nginx"]
CMD ["-g", "daemon off;"]
