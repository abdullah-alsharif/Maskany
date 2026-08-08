# Maskany

Mobile-first property listing platform with WhatsApp contact integration.

[![CI](https://github.com/abdullah-alsharif/maskany/actions/workflows/ci.yml/badge.svg)](https://github.com/abdullah-alsharif/maskany/actions/workflows/ci.yml)

> ## AI Features
>
> Maskany is **AI-powered end to end**: write or polish listing copy, translate
> to Arabic, generate highlights, and get an AI quality review — all with
> automatic provider failover (NVIDIA → OpenRouter → paid fallback), circuit
> breaker, caching, PII scrubbing, and usage tracking.
>
> - **Semantic search** — natural-language property search powered by pgvector
>   embeddings
> - **Enhance** — rewrite titles, summaries, descriptions (streaming or one-shot)
> - **Generate** — titles, neighborhood descriptions, and highlights from keywords
> - **Translate** — full listing translation between English and Arabic
> - **AI review** — quality score + categorized issues for every listing
> - **Similar properties** — vector-based recommendations

## Features

**Property listings**

- Create, edit, and manage property listings with images, pricing, rooms, amenities, and photos
- Rich filters: type, city, price range, rooms, bathrooms, min rating, and amenities
- Listing status management and owner dashboard for "my properties"

**Search**

- Keyword search across title, summary, description, city, and area with relevance ranking
- **Semantic search** — natural-language property search via pgvector embeddings
  (OpenRouter embeddings), auto-fallback to keyword search when embeddings are
  unavailable or the vector provider is down
- **Similar properties** — vector-based "find similar listings" on the detail page

**AI writing tools** (NVIDIA / OpenRouter providers with automatic fallback + circuit breaker)

- **Enhance** — rewrite property titles, summaries, and descriptions (streaming SSE or one-shot)
- **Generate** — create titles, summaries, neighborhood descriptions, and highlights from keywords
- **Translate** — AI translation of listing fields between English and Arabic
- **AI listing review** — quality score plus categorized, actionable issues (combined with
  deterministic validation rules)
- **Amenity suggestions** — recommend valid amenities for a listing
- Production hardening: idempotency, rate limits, request caching, PII scrubbing,
  prompt template registry, usage logging

**Insights dashboard**

- Analytics: view counts, and enquiry tracking from WhatsApp contact clicks
- Health/quality scores for listings driven by the AI review system

**Reviews** — ratings with star distribution and per-property review threads

**Favorites** — server-synced favorites with merge-on-login

**Auth** — phone OTP (SMS with email fallback) + email identity, JWT sessions

**Notifications** — Web Push subscriptions for property updates

**Registration** — WhatsApp contact integration with inquiry tracking

**Internationalization** — Arabic (ar) and English (en) with translation editor

**Progressive Web App** — offline support and installable mobile-first UI

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
| `pnpm db:migrate`    | Apply Kysely migrations                           |
| `pnpm db:seed`       | Seed database with fixture data                   |
