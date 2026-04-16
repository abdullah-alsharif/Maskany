#!/bin/sh
set -e

echo "[api] running database migrations..."
schema-flow run --dir /app/schema

echo "[api] starting server..."
exec node apps/api/dist/src/server.js
