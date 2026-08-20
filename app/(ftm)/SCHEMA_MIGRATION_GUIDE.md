# Schema Normalization - Implementation Guide

## Quick Start

### Phase 1: Run This First in Supabase

Go to **Supabase SQL Editor** → Copy & Paste:

**File:** `backend/migrations/20260814_normalize_schema_step_1_2.sql`

This migration:
- ✅ Creates `route_plan_bookings` junction table
- ✅ Adds deprecated columns to bookings (backward compatible)
- ✅ Ensures all tables have required columns
- ✅ Creates convenience view & functions
- ✅ Adds performance indexes

**Status:** Safe to run - no data loss, fully reversible

---

## Phase 2: Update Application Code

After Phase 1 is running in production (1-2 weeks), update your code:

### Changes in `backend/models/Booking.js`

**OLD (reading deprecated columns):**
```javascript
const booking = {
  courier: record.courier,                    // ❌ Will be NULL
  driverId: record.driver_id,                 // ❌ Will be NULL
  driverName: record.driver_name,             // ❌ Will be NULL
  vehicleId: record.vehicle_id,               // ❌ Will be NULL
  vehiclePlate: record.vehicle_plate,         // ❌ Will be NULL
};
```

**NEW (reading from source tables):**
```javascript
// Option A: Use convenience functions
async function getBookingWithAssignment(bookingId) {
  const booking = await db.bookings.findById(bookingId);
  const routePlan = booking.route_plan_id 
    ? await db.route_plans.findById(booking.route_plan_id) 
    : null;
  const trip = routePlan?.trip_id 
    ? await db.trips.findById(routePlan.trip_id) 
    : null;
  
  return {
    ...booking,
    courier: routePlan?.courier,              // ✅ From route_plans
    driverId: trip?.driver_id,                 // ✅ From trips
    driverName: trip?.driver_name,             // ✅ From trips
    vehicleId: trip?.vehicle_id,               // ✅ From trips
    vehiclePlate: trip?.vehicle_plate,         // ✅ From trips
  };
}

// Option B: Use materialized view (simpler)
async function getBookingComplete(bookingId) {
  const result = await db.query(`
    SELECT * FROM v_booking_with_route_trip 
    WHERE booking_id = $1
  `, [bookingId]);
  
  return result.rows[0];
}

// Option C: Use SQL functions
async function getCourierForBooking(bookingId) {
  const result = await db.query(
    'SELECT public.fn_get_booking_courier($1) as courier',
    [bookingId]
  );
  return result.rows[0].courier;
}
```

---

### Changes in `web/app/vrds/missions/page.tsx`

**OLD (reading from bookings):**
```typescript
// Line ~330-340
const courierFromParcels = bookingParcels.find((p) => p.courier)?.courier;
const courierFromRoutePlan = routePlan?.courier;
const courierFromBooking = booking?.courier;  // ❌ Will be NULL after Phase 2

const courier = courierFromParcels 
  || courierFromRoutePlan 
  || courierFromBooking 
  || `Route-${bookingId.substring(0, 6)}`;
```

**NEW (correct source table):**
```typescript
// After Phase 2 migration
const courierFromParcels = bookingParcels.find((p) => p.courier)?.courier;
const courierFromRoutePlan = routePlan?.courier;

const courier = courierFromParcels 
  || courierFromRoutePlan 
  || `Route-${bookingId.substring(0, 6)}`;
```

---

## Query Examples

### Get All Data for a Booking

**Option 1: Use the View** (Simplest)
```sql
SELECT * FROM v_booking_with_route_trip 
WHERE booking_id = 'abc-123-def';
```

**Option 2: Use Functions** (Most Flexible)
```sql
SELECT 
  b.id,
  b.status,
  b.pickup_location,
  public.fn_get_booking_courier(b.id) as courier,
  public.fn_get_booking_driver(b.id).driver_id,
  public.fn_get_booking_driver(b.id).driver_name,
  public.fn_get_booking_vehicle(b.id).vehicle_id,
  public.fn_get_booking_vehicle(b.id).vehicle_plate
FROM bookings b
WHERE b.id = 'abc-123-def';
```

**Option 3: Explicit Joins** (Most Control)
```sql
SELECT 
  b.id as booking_id,
  b.status,
  rp.courier,
  rp.pickup_location,
  t.driver_id,
  t.driver_name,
  t.vehicle_id,
  t.vehicle_plate
FROM bookings b
LEFT JOIN route_plans rp ON b.route_plan_id = rp.id
LEFT JOIN trips t ON rp.trip_id = t.id OR t.booking_id = b.id
WHERE b.id = 'abc-123-def';
```

---

## Testing Checklist

After Phase 1 migration, verify:

- [ ] View works: `SELECT COUNT(*) FROM v_booking_with_route_trip;`
- [ ] Functions work: `SELECT public.fn_get_booking_courier('test-id');`
- [ ] Existing data migrated: Bookings with route_plans should show in view
- [ ] Junction table populated: `SELECT COUNT(*) FROM route_plan_bookings;`
- [ ] No NULL data loss: Compare booking counts before/after

After updating application code (Phase 2):

- [ ] App still retrieves bookings correctly
- [ ] Courier info appears on missions page
- [ ] Driver/vehicle info shows on delivery cards
- [ ] No errors in browser console
- [ ] No errors in server logs

---

## Rollback Plan

If you need to rollback before Phase 2:

```sql
-- Re-populate deprecated columns from source tables
UPDATE bookings b
SET _deprecated_courier = (
  SELECT courier FROM route_plans 
  WHERE id = b.route_plan_id
);

UPDATE bookings b
SET _deprecated_driver_id = (
  SELECT driver_id FROM trips WHERE booking_id = b.id
);

-- Your old code will work again
```

If you need to rollback after Phase 2 (removal):

```bash
# Restore database from backup made before cleanup
psql -h [host] -U [user] -d [database] < backup-before-cleanup.sql
```

---

## Timeline

| Phase | Duration | Status | Action |
|-------|----------|--------|--------|
| Phase 1 | Day 1 | Ready | Run `20260814_normalize_schema_step_1_2.sql` |
| Testing | 1-2 weeks | In Progress | Verify app works with new schema |
| Phase 2 | Day 14+ | Not Started | Update application code |
| Validation | 1 week | Not Started | Test in production |
| Cleanup | Day 21+ | Not Started | Run `20260814_normalize_schema_final_cleanup.sql` |

---

## Support Queries

Check the status of migration:

```sql
-- See deprecated columns usage
SELECT 
  COUNT(*) as total_bookings,
  COUNT(CASE WHEN _deprecated_courier IS NOT NULL THEN 1 END) as with_deprecated_courier,
  COUNT(CASE WHEN _deprecated_driver_id IS NOT NULL THEN 1 END) as with_deprecated_driver_id
FROM bookings;

-- See junction table
SELECT COUNT(*) as route_plan_booking_links FROM route_plan_bookings;

-- See foreign key relationships
SELECT COUNT(*) as bookings_with_route_plans FROM bookings WHERE route_plan_id IS NOT NULL;
SELECT COUNT(*) as route_plans_with_trips FROM route_plans WHERE trip_id IS NOT NULL;
SELECT COUNT(*) as trips_with_bookings FROM trips WHERE booking_id IS NOT NULL;
```

---

## Files Modified

- ✅ `backend/migrations/20260814_normalize_schema_step_1_2.sql` - Run first
- ✅ `backend/migrations/20260814_normalize_schema_final_cleanup.sql` - Run after Phase 2 (optional)
- 📝 `backend/models/Booking.js` - Update after Phase 1
- 📝 `web/app/vrds/missions/page.tsx` - Update after Phase 1

---

## Questions?

Refer to `SCHEMA_ANALYSIS.md` for the detailed design rationale.
