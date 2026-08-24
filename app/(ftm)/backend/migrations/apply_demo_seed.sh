#!/bin/bash
# Apply demo drivers and vehicles migration
# Run: bash backend/migrations/apply_demo_seed.sh

set -e

MIGRATION_FILE="backend/migrations/20260817_seed_demo_drivers_vehicles.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
  echo "Error: Migration file not found: $MIGRATION_FILE"
  exit 1
fi

echo "📋 Applying demo drivers and vehicles migration..."
echo "ℹ️  You can also run this SQL directly in Supabase Studio Console"
echo ""
echo "SQL content:"
echo "---"
cat "$MIGRATION_FILE"
echo "---"
echo ""
echo "✅ To apply this migration:"
echo "   1. Go to Supabase Studio Console"
echo "   2. Open the SQL Editor"
echo "   3. Paste the SQL from $MIGRATION_FILE"
echo "   4. Click 'Execute'"
echo ""
echo "Or use the Node script:"
echo "   node backend/scripts/apply_migration.js $MIGRATION_FILE"
