#!/bin/bash
# Apply Supabase RLS policies to enable real trip data access

SUPABASE_URL="https://nrchfdwqthqfrxtmvjjy.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5yY2hmZHdxdGhxZnJ4dG12amp5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzY4NTIxNywiZXhwIjoyMDk5MjYxMjE3fQ.ZyV2ZJSlBeVa59lKSoXiSqClduAKjQcdjjSGwioHR8Q"
DB_URL="postgresql://postgres:fuentesrage06@db.nrchfdwqthqfrxtmvjjy.supabase.co:5432/postgres"

echo "Applying RLS policies to enable real trip data access..."
echo "This will allow the service role to read trips and bookings tables."
echo ""
echo "Option 1: Using Supabase Dashboard"
echo "  1. Go to https://app.supabase.com/project/nrchfdwqthqfrxtmvjjy/sql/new"
echo "  2. Copy the contents of: 20260715_enable_service_role_trips_bookings.sql"
echo "  3. Paste into the SQL editor"
echo "  4. Click 'Execute'"
echo ""
echo "Option 2: Using psql (if installed)"
echo "  psql \"${DB_URL}\" -f 20260715_enable_service_role_trips_bookings.sql"
echo ""
echo "After applying, the backend will automatically use real trip data with accurate coordinates!"
