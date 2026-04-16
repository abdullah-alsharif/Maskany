#!/usr/bin/env bash
set -euo pipefail

# ─── Maskany Development Setup ─────────────────────────
# Bootstraps the full local development environment.
# Run once after cloning, or anytime you want a clean start.

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

info()  { echo -e "${GREEN}✓${NC} $1"; }
warn()  { echo -e "${YELLOW}!${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; exit 1; }
step()  { echo -e "\n${BOLD}→ $1${NC}"; }

# ─── Prerequisites ──────────────────────────────────────
step "Checking prerequisites"

command -v node >/dev/null 2>&1 || error "Node.js is required. Install from https://nodejs.org"
NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
[ "$NODE_VERSION" -ge 20 ] || error "Node.js >= 20 required (found v$NODE_VERSION)"
info "Node.js v$(node -v | sed 's/v//')"

command -v pnpm >/dev/null 2>&1 || error "pnpm is required. Install: npm install -g pnpm"
info "pnpm $(pnpm -v)"

command -v docker >/dev/null 2>&1 || error "Docker is required. Install from https://docker.com"
docker info >/dev/null 2>&1 || error "Docker daemon is not running"
info "Docker $(docker --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')"

# ─── Install Dependencies ──────────────────────────────
step "Installing dependencies"
pnpm install
info "Dependencies installed"

# ─── Environment Files ──────────────────────────────────
step "Setting up environment files"

if [ ! -f .env ]; then
  cp .env.example .env
  info "Created .env from .env.example"
else
  warn ".env already exists — skipping"
fi

if [ ! -f apps/api/.env.test ]; then
  cat > apps/api/.env.test << 'EOF'
NODE_ENV=test
PORT=3002
DATABASE_URL="postgresql://maskany_test:maskany_test_pass@localhost:5433/maskany_test?schema=public"
JWT_SECRET=maskany-test-jwt-secret
EOF
  info "Created apps/api/.env.test"
else
  warn "apps/api/.env.test already exists — skipping"
fi

# ─── Start Docker Services ──────────────────────────────
step "Starting PostgreSQL (dev)"

docker compose up -d
info "Dev database container started"

# ─── Wait for PostgreSQL ────────────────────────────────
step "Waiting for PostgreSQL to be ready"

MAX_RETRIES=30
RETRY_COUNT=0

until docker exec maskany-postgres pg_isready -U maskany -d maskany >/dev/null 2>&1; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    error "PostgreSQL did not become ready in ${MAX_RETRIES}s"
  fi
  sleep 1
done
info "Dev database ready (port 5432)"

# ─── Database Migrations ───────────────────────────────
step "Running database migrations"

DATABASE_URL="postgresql://maskany:maskany_pass@localhost:5432/maskany" pnpm db:migrate
info "Dev database migrated"

# ─── Seed Development Data ──────────────────────────────
step "Seeding development database"
pnpm db:seed
info "Development data seeded (16 properties, 5 users, 24 reviews)"

# ─── Done ───────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}Setup complete!${NC}"
echo ""
echo "  Start all services:     pnpm dev"
echo "  Start API only:         pnpm dev:api"
echo "  Start web only:         pnpm dev:web"
echo "  Run tests:              pnpm check"
echo "  Run E2E tests:          pnpm test:e2e"
echo ""
echo "  API:  http://localhost:3001"
echo "  Web:  http://localhost:5173"
echo ""
