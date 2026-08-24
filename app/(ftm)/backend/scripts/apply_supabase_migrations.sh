#!/usr/bin/env bash
# Apply Supabase SQL migrations to the database referenced by DATABASE_URL
# Usage: ./apply_supabase_migrations.sh ../migrations/20260715_enable_service_role_trips_bookings.sql

set -euo pipefail

if [ -z "${1-}" ]; then
  echo "Usage: $0 <path-to-sql-file>" >&2
  exit 2
fi

SQL_FILE="$1"
if [ ! -f "$SQL_FILE" ]; then
  echo "SQL file not found: $SQL_FILE" >&2
  exit 2
fi

# Load .env if present
ENV_FILE="$(dirname "$0")/../.env"
if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  set -a
  . "$ENV_FILE"
  set +a
fi

if [ -z "${DATABASE_URL-}" ]; then
  echo "DATABASE_URL is not set. Export it or add it to backend/.env" >&2
  exit 2
fi

# Run the SQL via psql. psql must be installed and available in PATH.
echo "Applying migration: $SQL_FILE to $DATABASE_URL"
psql "$DATABASE_URL" -f "$SQL_FILE"

echo "Migration applied successfully."