# syntax=docker/dockerfile:1

# ── Stage 1: install all dependencies ─────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.15.1 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
# Stub the web package so the workspace graph resolves without its full source
RUN mkdir -p apps/web && echo '{"name":"@maskany/web","version":"0.0.1","private":true}' > apps/web/package.json

RUN pnpm install --no-frozen-lockfile --filter @maskany/api...

# ── Stage 2: compile TypeScript ────────────────────────────────────────────────
FROM deps AS builder
WORKDIR /app

COPY apps/api ./apps/api
COPY tsconfig.base.json ./

RUN pnpm --filter @maskany/api build

# ── Stage 3: slim runtime image ────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.15.1 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
RUN mkdir -p apps/web && echo '{"name":"@maskany/web","version":"0.0.1","private":true}' > apps/web/package.json

RUN pnpm install --no-frozen-lockfile --filter @maskany/api... --prod

# Copy compiled output and migrations
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Entrypoint script runs migrations then starts the server
COPY apps/api/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Uploads directory (mount a volume over this path in production)
RUN mkdir -p uploads

ENV NODE_ENV=production
ENV PORT=3001
ENV UPLOADS_DIR=/app/uploads

EXPOSE 3001

ENTRYPOINT ["sh", "/app/docker-entrypoint.sh"]
