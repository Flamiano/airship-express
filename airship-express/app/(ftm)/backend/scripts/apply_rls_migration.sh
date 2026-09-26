#!/bin/bash

# Apply RLS policies migration to Supabase via SQL Editor
# This script reads the migration file and provides instructions

echo "=== Supabase RLS Policies Setup ==="
echo ""
echo "To enable service-role access for the vehicles table and other tables,"
echo "follow these steps:"
echo ""
echo "1. Go to Supabase Dashboard: https://app.supabase.com"
echo "2. Select your project"
echo "3. Navigate to SQL Editor (left sidebar)"
echo "4. Click 'New Query'"
echo "5. Copy and paste the SQL below:"
echo ""
echo "------- START COPY HERE -------"
echo ""
cat ./20260814_enable_rls_service_role_access.sql
echo ""
echo "------- END COPY HERE -------"
echo ""
echo "6. Click 'Run' button"
echo "7. Check for success message"
echo ""
echo "Alternative: You can also paste this URL with the SQL encoded in it:"
echo "(requires being logged in to Supabase)"
echo ""
echo "For direct CLI execution (if you have psql installed):"
echo "psql -h your-project.supabase.co -U postgres -d postgres -f ./20260814_enable_rls_service_role_access.sql"
echo ""
