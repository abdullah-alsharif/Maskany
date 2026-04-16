#!/usr/bin/env bash
set -euo pipefail

# ─── Test Runner ────────────────────────────────────────
# Starts the test PostgreSQL container, runs migrations,
# executes tests, then tears down the container.

BOLD='\033[1m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

info()  { echo -e "${GREEN}✓${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; }

cleanup() {
  echo -e "\n${BOLD}→ Tearing down test database${NC}"
  docker compose -f docker-compose.test.yml down -v --remove-orphans >/dev/null 2>&1
  info "Test database stopped"
}

trap cleanup EXIT

# ─── Start test DB ──────────────────────────────────────
echo -e "${BOLD}→ Starting test database${NC}"
docker compose -f docker-compose.test.yml up -d --wait >/dev/null 2>&1
info "Test database ready (port 5433)"

# ─── Migrate ────────────────────────────────────────────
echo -e "${BOLD}→ Running migrations on test database${NC}"
DATABASE_URL="postgresql://maskany_test:maskany_test_pass@localhost:5433/maskany_test" \
  pnpm db:migrate >/dev/null 2>&1
info "Test database migrated"

# ─── Run tests ──────────────────────────────────────────
echo -e "${BOLD}→ Running tests${NC}\n"

EXIT_CODE=0
pnpm -r --if-present test || EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  echo -e "\n${GREEN}${BOLD}All tests passed!${NC}"
else
  echo -e "\n${RED}${BOLD}Tests failed (exit code $EXIT_CODE)${NC}"
fi

exit $EXIT_CODE
