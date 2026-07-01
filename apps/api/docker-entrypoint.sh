#!/bin/sh
set -e

echo "[api] running database migrations..."
node apps/api/dist/src/scripts/migrate.js

echo "[api] starting server..."
exec node apps/api/dist/src/server.js
