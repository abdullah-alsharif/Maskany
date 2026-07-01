# Contributing

## Architecture

- pnpm monorepo: `apps/api` (Express), `apps/web` (Next.js)
- TypeScript strict mode, tsconfig.base.json at root
- Named exports only, kebab-case file names, PascalCase components

## Dev setup

| Service       | Port | User         | DB           |
| ------------- | ---- | ------------ | ------------ |
| Dev Postgres  | 5432 | maskany      | maskany      |
| Test Postgres | 5433 | maskany_test | maskany_test |

```bash
docker compose up -d          # start dev DB
docker compose -f docker-compose.test.yml up -d  # start test DB
pnpm bootstrap                # install + migrate + seed
pnpm dev                      # api:3001, web:3000
```

## Code rules

- **Frontend:** TanStack Query for data fetching, axios client, lucide-react icons, Tailwind 4
- **Backend:** Thin routes in `routes/`, logic in `services/`, zod validation on all inputs
- **DB:** Kysely for queries, schema-flow for migrations (`pnpm db:migrate`), snake_case everywhere
- **Testing:** Real DB only, no mocks. Use `supertest` for API, `@testing-library/react` for frontend
- **Media:** sharp for images (WebP, thumbnails), ffmpeg for video poster frames, max 10 images + 3 videos per property

## Business rules

- OTP-only auth (no passwords), JWT access (15m) + refresh (7d)
- WhatsApp-only contact via `wa.me` deep links
- Only OWNER user type can create/manage properties
- One review per user per property, owners can't review their own
- Soft delete properties (status = inactive)
- Price is display-only — no payments, no bookings
