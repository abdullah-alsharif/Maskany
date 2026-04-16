# Milestones

> **Auto-generated** by `ralph milestones` — do not edit manually.

## 1 — Project Bootstrap ($4.89)

- [x] T-000: Project bootstrap
- [x] T-001: Set up pnpm monorepo with shared tooling — $1.82
- [x] T-002: Scaffold Express API server with health endpoint — $2.23
- [x] T-003: Scaffold React + Vite frontend with Tailwind and routing — $0.84

## 2 — Database and Models ($3.84)

- [x] T-004: Apply schema-flow YAML schema and set up Kysely query layer — $1.88
- [x] T-005: Create database seed script with sample data — $1.96

## 3 — Authentication ($4.91)

- [x] T-006: Implement OTP generation and verification service — $0.85
- [x] T-007: Integrate Twilio for SMS OTP delivery — $0.86
- [x] T-008: Implement email OTP delivery with Nodemailer — $0.92
- [x] T-009: Build auth API endpoints (register, login, verify, refresh, logout) — $2.28
- [x] T-026: Build authentication UI (login, register, OTP verification pages)

## 4 — Property Listings ($15.82)

- [x] T-010: Build property CRUD API endpoints — $2.09
- [x] T-011: Build media upload pipeline (photos + videos) — $3.74
- [x] T-012: Build property listing page with grid layout — $2.08
- [x] T-013: Build property detail page with image gallery — $1.99
- [x] T-027: Build favorites page with local storage persistence — $2.24
- [x] T-028: Build property creation and management UI for owners — $3.68

## 5 — Search and Filters ($7.00)

- [x] T-014: Implement search API with full-text search — $1.33
- [x] T-015: Implement filter API with all filter parameters — $2.86
- [x] T-016: Build frontend filter UI and search bar — $2.81

## 6 — Reviews and Ratings ($5.20)

- [x] T-017: Build review and rating API endpoints — $1.72
- [x] T-018: Build star rating component — $0.90
- [x] T-019: Build comments section UI with review form — $2.58

## 7 — WhatsApp and Contact ($1.62)

- [x] T-020: Implement WhatsApp deep link service — $0.50
- [x] T-021: Build WhatsApp contact button UI — $1.12

## 8 — Mobile and Polish ($5.38)

- [x] T-022: Polish responsive layout and mobile navigation
- [x] T-023: Configure Capacitor for mobile deployment — $0.96
- [x] T-024: Performance optimization (lazy loading, image optimization, virtual scroll) — $2.40
- [x] T-025: Add SEO meta tags, structured data, and accessibility — $2.02

## 9 — Security and Bug Fixes ($9.74)

- [x] T-029: Fix critical security issues (refresh token, OTP logging, CORS) — $1.61
- [x] T-030: Fix PropertyDetailPage currentUser and email uniqueness — $2.01
- [x] T-031: Fix image gallery UX and implement search page — $1.37
- [x] T-032: Code quality fixes (deduplicate parseOrThrow, env validation, file size check) — $1.39
- [x] T-034: Fix Property type mismatch between API response and frontend types — $3.36

## 10 — E2E Testing ($6.71)

- [x] T-033: Add Playwright E2E tests for critical user flows — $6.71

## 11 — Production Readiness

- [ ] T-035: Set up CI/CD pipeline with GitHub Actions
- [ ] T-036: Add test coverage reporting with c8
- [ ] T-037: Production Docker image and deployment configuration
- [ ] T-038: Configure production Twilio and SMTP credentials

## 12 — Cloud and Scaling

- [ ] T-039: Migrate media storage to S3-compatible cloud storage
- [ ] T-040: Add push notifications via Capacitor
- [ ] T-041: Add offline-first support with service worker

## 13 — Localization

- [ ] T-042: Add internationalization (Arabic/English)

## 14 — Architecture Restructure ($8.85)

- [x] T-043: Move to single root .env and restructure packages/ to apps/ — $2.42
- [x] T-044: Migrate frontend from React SPA to Next.js App Router — $6.43
- [ ] T-045: Rewrite web tests to remove all react-router-dom dependencies

**Grand Total: $73.96**
