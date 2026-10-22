# syntax=docker/dockerfile:1

FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS production
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
# Usage and audit logs (see config.ts). Mounted as a volume so they survive deploys.
RUN mkdir -p data && chown -R node:node data
EXPOSE 3100
USER node
CMD ["node", "dist/server.js"]
