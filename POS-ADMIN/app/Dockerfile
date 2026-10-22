# syntax=docker/dockerfile:1

FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# "staging" shows the STAGING chip; empty = production.
ARG VITE_APP_ENV=
ENV VITE_APP_ENV=$VITE_APP_ENV
# TURA's app, linked from a business's TURA panel; empty hides the link.
ARG VITE_TURA_APP_URL=
ENV VITE_TURA_APP_URL=$VITE_TURA_APP_URL
RUN npm run build

FROM nginx:1.27-alpine AS production
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
