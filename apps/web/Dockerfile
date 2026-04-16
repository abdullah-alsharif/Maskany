# syntax=docker/dockerfile:1

# ── Stage 1: install all dependencies ─────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.15.1 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
# Stub the api package so the workspace graph resolves without its full source
RUN mkdir -p apps/api && echo '{"name":"@maskany/api","version":"0.0.1","private":true}' > apps/api/package.json

RUN pnpm install --no-frozen-lockfile --filter @maskany/web...

# ── Stage 2: build Next.js ─────────────────────────────────────────────────────
FROM deps AS builder
WORKDIR /app

COPY apps/web ./apps/web
COPY tsconfig.base.json ./

# NEXT_TELEMETRY_DISABLED prevents outbound calls during build
ENV NEXT_TELEMETRY_DISABLED=1

# API_BASE_URL is consumed by next.config.ts rewrites at build time
ARG API_BASE_URL=http://api:3001
ENV API_BASE_URL=${API_BASE_URL}

RUN pnpm --filter @maskany/web build

# ── Stage 3: slim runtime image ────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# standalone output bundles only the files needed to run the server
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000

CMD ["node", "apps/web/server.js"]
