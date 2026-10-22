# syntax=docker/dockerfile:1

FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
# "staging" shows the STAGING chip (docker-compose.staging.yml); empty = production.
ARG VITE_APP_ENV=
ENV VITE_APP_ENV=$VITE_APP_ENV
# TURA's app, linked from the platform admin's TURA panel; empty hides the link.
ARG VITE_TURA_APP_URL=
ENV VITE_TURA_APP_URL=$VITE_TURA_APP_URL
# Google Maps browser key (Domicilios: map, routes, address search). Empty: the map shows a notice.
ARG VITE_GOOGLE_MAPS_API_KEY=
ENV VITE_GOOGLE_MAPS_API_KEY=$VITE_GOOGLE_MAPS_API_KEY
RUN npm run build

FROM nginx:1.27-alpine AS production
COPY --from=builder /app/dist /usr/share/nginx/html
# Production's config by default; staging builds with its own (docker-compose.staging.yml).
ARG NGINX_CONF=nginx.conf
COPY ${NGINX_CONF} /etc/nginx/conf.d/default.conf
EXPOSE 80 443
