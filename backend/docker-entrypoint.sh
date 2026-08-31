#!/bin/sh
# Applies pending migrations and refreshes the seed data, then hands off to the app.
set -e

echo "[entrypoint] Applying database migrations..."
# A failed migration must stop the container: serving traffic against a schema the
# code does not expect is worse than not starting.
npx prisma migrate deploy

echo "[entrypoint] Seeding..."
# Upsert-based and idempotent, so this is safe on every boot. It also restores the
# three demo pins if someone deleted them through the public API.
# Seeding is best-effort: a seed failure should not keep a working API offline.
node prisma/seed/seed.js || echo "[entrypoint] WARNING: seed failed, continuing"

echo "[entrypoint] Starting PinBoard API on port ${PORT:-3001}..."
exec "$@"
