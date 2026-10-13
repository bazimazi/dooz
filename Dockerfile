# syntax=docker/dockerfile:1
#
# The multiplayer server: Hono + ws + SQLite, run straight from TypeScript with
# tsx, exactly as `npm run start:server` runs it. The web client is a static
# build served separately (any CDN or static host, or the same reverse proxy);
# see "Deploying the server" in README.md.
#
#   docker build -t dooz-server .
#   docker run -p 8787:8787 -v dooz-data:/data --env-file server/.env dooz-server
#
# Everything that must survive a redeploy - the database, its backups - lives
# under /data, which is a volume.

ARG NODE_VERSION=22

# ---------------------------------------------------------------------------
# Production dependencies. better-sqlite3 downloads a prebuilt binary for the
# common platforms; the compiler toolchain is here for the ones it has none
# for, and stays in this stage.
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# ---------------------------------------------------------------------------
# Runtime.
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim

# tsx is a dev dependency of the repository, so it is installed here on its
# own at the locked version rather than pulling in the whole dev toolchain.
ARG TSX_VERSION=4.23.12

# tini is PID 1: it forwards SIGTERM to the server, which uses it to write live
# games down for the next process, and it reaps anything left behind.
RUN apt-get update \
  && apt-get install -y --no-install-recommends tini \
  && rm -rf /var/lib/apt/lists/* \
  && npm install -g --no-audit --no-fund "tsx@${TSX_VERSION}"

WORKDIR /app
ENV NODE_ENV=production \
  PORT=8787 \
  HOST=0.0.0.0 \
  DATA_FILE=/data/dooz.sqlite \
  BACKUP_DIR=/data/backups

COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
# The server imports the shared rules and wire protocol from src/.
COPY src ./src
COPY server ./server

RUN mkdir -p /data && chown node:node /data
USER node
VOLUME ["/data"]
EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 8787) + '/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"

# Docker's default stop timeout (10 s) covers the server's 5 s shutdown grace.
STOPSIGNAL SIGTERM
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["tsx", "server/main.ts"]
