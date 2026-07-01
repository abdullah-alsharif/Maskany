# Maskany

Mobile-first property listing platform with WhatsApp contact integration.

[![CI](https://github.com/abdullah-alsharif/maskany/actions/workflows/ci.yml/badge.svg)](https://github.com/abdullah-alsharif/maskany/actions/workflows/ci.yml)

## Quick start

```bash
cp .env.example .env          # fill in real values
docker compose up -d          # start dev postgres
pnpm bootstrap                # install deps + run migrations
pnpm dev                      # api :3001, web :3000
```

## Scripts

| Command              | Description                                       |
| -------------------- | ------------------------------------------------- |
| `pnpm dev`           | Start API + web in parallel                       |
| `pnpm check`         | Lint, format, typecheck, build, test              |
| `pnpm test`          | Run unit/integration tests (auto-manages test DB) |
| `pnpm test:e2e`      | Run Playwright E2E tests                          |
| `pnpm test:coverage` | Run tests with coverage report                    |
| `pnpm db:migrate`    | Apply schema-flow migrations                      |
| `pnpm db:seed`       | Seed database with fixture data                   |
