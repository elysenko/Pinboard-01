# syntax=docker/dockerfile:1
# PinBoard backend — NestJS + Prisma.
# Debian slim (not alpine) so the glibc Prisma engines named in
# prisma/schema.prisma binaryTargets are the ones actually used at runtime.

FROM node:20-slim AS builder
WORKDIR /app
# Prisma's CLI parses DATABASE_URL at generate time but never connects, so a dummy
# value is enough to build without a live database.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN npx prisma generate
# nest build exits 0 even when it emits nothing (a stale tsbuildinfo will do it),
# so fail loudly here rather than with MODULE_NOT_FOUND at container start.
RUN npm run build && test -f dist/main.js

FROM node:20-slim AS production
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

# node_modules is copied whole rather than reinstalled with --omit=dev: the
# entrypoint runs `prisma migrate deploy`, and the Prisma CLI is a devDependency.
# Pruning it would make the container depend on a network fetch at boot.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY package*.json ./
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 3001
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
