# Maskany Project Rules

## Architecture

- This is a pnpm monorepo with two apps: `apps/api` (Express backend) and `apps/web` (React frontend)
- All TypeScript code uses strict mode with the base tsconfig at project root
- Use named exports, not default exports
- File naming: kebab-case (e.g., `property-service.ts`, `home-page.tsx`)
- Component naming: PascalCase (e.g., `PropertyCard`, `SearchBar`)

## Database Infrastructure

- PostgreSQL runs via Docker Compose:
  - `docker-compose.yml` — development database on port **5432** (user: `maskany`, db: `maskany`)
  - `docker-compose.test.yml` — test database on port **5433** (user: `maskany_test`, db: `maskany_test`)
  - `docker-compose.prod.yml` — production (API + Web + PostgreSQL)
- Bootstrap: `pnpm bootstrap` runs `scripts/setup.sh` (installs deps, starts Docker, migrates, seeds)
- Development DATABASE_URL: `postgresql://maskany:maskany_pass@localhost:5432/maskany?schema=public`
- Test DATABASE_URL: `postgresql://maskany_test:maskany_test_pass@localhost:5433/maskany_test?schema=public`
- Master quality check: `pnpm check` (lint + format + typecheck + build + test)
- Root `.env` contains all development env vars; `apps/api/.env.test` contains test-specific overrides
- Load `apps/api/.env.test` in vitest config for API tests
- Always use `DATABASE_URL` from environment — never hardcode connection strings in code

## Testing — CRITICAL

- **NO MOCKS**: All tests must run against real infrastructure. Do not use jest.mock(), vi.mock(), or any mocking library
- **Real database**: Integration tests use the real PostgreSQL test database via `docker-compose.test.yml` on port 5433. The test DATABASE_URL is in `apps/api/.env.test`
- **Test database setup**: Each test file should use `beforeAll` to migrate/reset the test database and `afterAll` to disconnect. Use `beforeEach` to clean relevant tables
- **API tests**: Use `supertest` against the real Express `app` instance (imported from `apps/api/src/index.ts`)
- **Frontend tests**: Use `@testing-library/react` with `jsdom` or `happy-dom` environment
- **E2E tests**: Use Playwright with a real running API server and real database. Start both servers in `globalSetup`
- **Test file location**: Tests go in `apps/api/tests/` and `apps/web/tests/` respectively. E2E tests go in `apps/web/e2e/`
- **Test naming**: `*.test.ts` for unit/integration, `*.spec.ts` for E2E

## Frontend Rules

- Mobile-first design: write mobile styles first, use Tailwind `sm:`, `md:`, `lg:` for larger screens
- Tailwind CSS 4: import as `@import "tailwindcss"` in CSS, use `@tailwindcss/vite` plugin
- Use TanStack Query (`@tanstack/react-query`) for all API data fetching — no raw `fetch` or `axios` in components
- Use axios for the API client, configured in `apps/web/src/services/api.ts`
- Use React Router v7 for routing with `createBrowserRouter`
- Components are functional components with hooks only — no class components
- UI inspiration: Airbnb's clean card layouts, generous whitespace, professional typography
- Touch targets: minimum 44x44px on all interactive elements
- All images must have `alt` text
- Use `lucide-react` for icons

## Database Schema Management — schema-flow

- **Schema tool**: `@smplcty/schema-flow` — declarative YAML-based PostgreSQL schema management (NO migration files)
- **Schema location**: `schema/` at project root (tables, functions, enums as YAML files)
- **Commands**:
  - `pnpm db:migrate` — apply schema changes to database (`schema-flow run`)
  - `pnpm db:migrate:plan` — preview SQL without executing (`schema-flow plan`)
  - `pnpm db:migrate:status` — show current state
  - `pnpm db:migrate:drift` — compare YAML to live DB
  - `pnpm db:migrate:lint` — static analysis
- **Query layer**: Use `Kysely` (type-safe SQL query builder) for all database queries — no raw `pg` calls
- **Database client**: Kysely instance in `apps/api/src/lib/db.ts` with typed schema from `apps/api/src/lib/db-types.ts`
- **Table naming**: snake_case (e.g., `property_media`, `otp_codes`, `refresh_tokens`)
- **Column naming**: snake_case (e.g., `full_name`, `created_at`, `property_type`)
- **ID columns**: UUID with `gen_random_uuid()` default
- **Timestamps**: All tables have `created_at` (timestamptz, default now()), most have `updated_at` with trigger
- For tests: run `schema-flow run` against the test DATABASE_URL in `beforeAll`

## Media Handling (Photos + Videos)

- Media stored in `property_media` table — supports both IMAGE and VIDEO types
- **Photos**: processed via `sharp` — resize to max 1920px, WebP conversion, thumbnail at 400px
- **Videos**: accept mp4, mov, webm — max 50MB per file, stored as-is (no transcoding in v1)
- **Video thumbnails**: extract poster frame using `ffmpeg` (via `fluent-ffmpeg` package) at 1-second mark, save as WebP
- Media stored on disk at `uploads/properties/{propertyId}/` with UUID filenames
- Max 10 images + 3 videos per property
- Static file serving via Express for `/uploads` path
- `property_media.media_type` column distinguishes IMAGE vs VIDEO
- `property_media.duration` column stores video length in seconds
- `property_media.mime_type` stores the MIME type (image/webp, video/mp4, etc.)
- `property_media.file_size` stores size in bytes

## Backend Rules

- Express routes organized in `apps/api/src/routes/` — one file per resource
- Business logic in `apps/api/src/services/` — routes are thin, services are thick
- Input validation with `zod` on all endpoints that accept data
- Consistent error response format: `{ error: { message: string, code: string } }`
- HTTP status codes: 200 (OK), 201 (created), 204 (no content), 400 (validation), 401 (unauthorized), 403 (forbidden), 404 (not found), 409 (conflict), 500 (server error)
- Use Kysely for all database queries — parameterized by default, no raw string concatenation
- Database client singleton in `apps/api/src/lib/db.ts`
- Environment variables loaded from root `.env` via `dotenv-cli` — never hardcode secrets

## Business Rules

- **No payment functionality**: Price is display-only, no transactions, no payment gateway
- **No in-app chat**: All communication happens via WhatsApp deep links
- **WhatsApp only contact**: Every property must have a WhatsApp number
- **OTP authentication**: No passwords — login via SMS or email OTP only
- **Property ownership**: Only users with OWNER type can create/manage properties
- **One review per user per property**: Enforced at database and application level
- **Owners cannot review their own properties**
- **Soft delete for properties**: Set status to INACTIVE, never hard delete

## Security

- Validate and sanitize all user input
- Use parameterized queries only (Kysely handles this)
- Rate limit authentication endpoints
- JWT tokens for auth with short expiry (15 min access, 7 day refresh)
- CORS restricted to known origins
- Helmet.js for security headers
- No secrets in code — use environment variables
