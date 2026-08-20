# Database Schema Analysis: Bookings, Route Plans, and Trips

## Current Problem: Duplicate Attributes

### Duplicated Across Bookings & Route Plans
```
bookings.courier          ← route_plans.courier
bookings.pickup_location  ← route_plans.pickup_location
bookings.pickup_latitude  ← route_plans.pickup_latitude
bookings.pickup_longitude ← route_plans.pickup_longitude
bookings.delivery_destinations ← route_plans.delivery_destinations
```

### Duplicated Across Bookings & Trips
```
bookings.driver_id         ← trips.driver_id
bookings.driver_name       ← trips.driver_name
bookings.vehicle_id        ← trips.vehicle_id
bookings.vehicle_plate     ← trips.vehicle_plate
```

### Duplicated Across Route Plans & Trips
```
route_plans.distance_km              ← trips.distance_km (potentially)
route_plans.estimated_duration_min   ← trips.duration_minutes (potentially)
```

## Current Relationships
```
bookings (1) ─── route_plans (N)  [One booking can have multiple route plans - WRONG]
  ↓                   ↓
  └─── trips (N) ──── route_plans (1) [Foreign key: route_plans.trip_id]
  
Problems:
1. Booking has route_plan_id (one route plan per booking)
2. Route_plan has trip_id (one trip per route plan)
3. Trip has booking_id (one booking per trip)
4. Circular: Booking → RoutePlan → Trip → Booking
```

## Proposed Normalized Schema

### Option A: Single Direction Hierarchy (Recommended)

```
booking (user request)
   ↓ (when route-planned)
route_plan (optimized multi-stop path via OR-Tools)
   ↓ (when assigned to driver)
trip (execution/tracking record)

Cardinality:
- 1 Booking → 0..1 RoutePlan (booking can exist without routing)
- 1 RoutePlan → 0..1 Trip (route can exist without assignment)
- 1 Booking → 0..1 Trip (when trip is assigned, it links to its booking)
```

### Table Structure

#### BOOKINGS Table (REQUEST)
Stores: What customer needs to ship
```sql
CREATE TABLE bookings (
  id uuid PRIMARY KEY,
  customer_id uuid NOT NULL,
  -- Core request data
  status text CHECK (status IN ('pending', 'quoted', 'accepted', 'dispatched', 'completed', 'cancelled')),
  
  -- Pickup point (fixed for this booking)
  pickup_location text,
  pickup_latitude numeric,
  pickup_longitude numeric,
  
  -- Delivery point(s) (fixed for this booking)
  delivery_destinations jsonb NOT NULL DEFAULT '[]',
  
  -- Assignment (references other tables, not duplicated)
  route_plan_id uuid REFERENCES route_plans(id) ON DELETE SET NULL,
  trip_id uuid REFERENCES trips(id) ON DELETE SET NULL,
  
  -- Metadata
  booking_date timestamp,
  notes text,
  created_at timestamp,
  updated_at timestamp
);
```

**Remove from bookings:**
- ~~driver_id~~ (belongs to trip)
- ~~driver_name~~ (belongs to trip)
- ~~vehicle_id~~ (belongs to trip)
- ~~vehicle_plate~~ (belongs to trip)
- ~~courier~~ (belongs to route_plan)

#### ROUTE_PLANS Table (OPTIMIZATION)
Stores: Optimized multi-stop routing for fulfilling bookings
```sql
CREATE TABLE route_plans (
  id uuid PRIMARY KEY,
  
  -- Which bookings are in this plan (array or separate junction table)
  booking_ids uuid[] NOT NULL DEFAULT '{}',
  
  -- Pickup point (from first booking or consolidated)
  pickup_location text,
  pickup_latitude numeric,
  pickup_longitude numeric,
  
  -- Optimized stops (from multiple bookings)
  delivery_destinations jsonb NOT NULL DEFAULT '[]',
  
  -- Courier info
  courier text,
  
  -- Optimization results
  route_geojson jsonb,
  distance_km numeric,
  estimated_duration_min numeric,
  
  -- When assigned to a trip
  trip_id uuid REFERENCES trips(id) ON DELETE SET NULL,
  
  -- Metadata
  status text CHECK (status IN ('draft', 'assigned', 'in_progress', 'completed', 'cancelled')),
  planned_delivery_date date,
  generated_by text DEFAULT 'OR-Tools',
  created_by uuid,
  created_at timestamp,
  updated_at timestamp
);
```

**Remove from route_plans:**
- ~~courier~~ (move to route_plan level - keep but clarify relationship)

#### TRIPS Table (EXECUTION)
Stores: Driver assignment, vehicle, actual execution tracking
```sql
CREATE TABLE trips (
  id uuid PRIMARY KEY,
  
  -- Which route plan is being executed
  route_plan_id uuid NOT NULL REFERENCES route_plans(id) ON DELETE RESTRICT,
  
  -- Driver assignment
  driver_id uuid NOT NULL,
  driver_name text NOT NULL,
  
  -- Vehicle assignment
  vehicle_id uuid NOT NULL,
  vehicle_plate text NOT NULL,
  
  -- Current position/progress
  from_location text,
  from_latitude numeric,
  from_longitude numeric,
  to_location text,
  to_latitude numeric,
  to_longitude numeric,
  
  -- Execution tracking
  status text,
  progress numeric,
  
  -- Timing (captured during execution)
  estimated_departure timestamp,
  estimated_arrival timestamp,
  actual_departure timestamp,
  actual_arrival timestamp,
  
  -- Metadata
  scheduled_at timestamp,
  notes text,
  created_at timestamp,
  updated_at timestamp
);
```

**Remove from trips:**
- ~~distance_km~~ (belongs to route_plan)
- ~~duration_minutes~~ (belongs to route_plan)

## Migration Strategy

### Step 1: Create Junction Table (Backward Compatible)
```sql
-- Allow multiple bookings per route plan without changing existing structure
CREATE TABLE IF NOT EXISTS route_plan_bookings (
  route_plan_id uuid REFERENCES route_plans(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES bookings(id) ON DELETE CASCADE,
  PRIMARY KEY (route_plan_id, booking_id)
);

-- Migrate existing data
INSERT INTO route_plan_bookings (route_plan_id, booking_id)
SELECT route_plans.id, bookings.id
FROM bookings
JOIN route_plans ON bookings.route_plan_id = route_plans.id
WHERE bookings.route_plan_id IS NOT NULL
ON CONFLICT DO NOTHING;
```

### Step 2: Add Nullable Columns (Deprecation)
```sql
-- Keep old columns but mark as deprecated
ALTER TABLE bookings 
  ADD COLUMN IF NOT EXISTS _deprecated_courier text,
  ADD COLUMN IF NOT EXISTS _deprecated_driver_id uuid,
  ADD COLUMN IF NOT EXISTS _deprecated_driver_name text,
  ADD COLUMN IF NOT EXISTS _deprecated_vehicle_id uuid,
  ADD COLUMN IF NOT EXISTS _deprecated_vehicle_plate text;

-- Copy data before removing
UPDATE bookings
SET _deprecated_courier = (
  SELECT courier FROM route_plans 
  WHERE route_plans.id = bookings.route_plan_id
)
WHERE route_plan_id IS NOT NULL;

UPDATE bookings
SET _deprecated_driver_id = (
  SELECT driver_id FROM trips 
  WHERE trips.id = (
    SELECT id FROM trips 
    WHERE route_plan_id = (
      SELECT route_plan_id FROM bookings b2 
      WHERE b2.id = bookings.id
    )
  )
)
WHERE route_plan_id IS NOT NULL;
```

### Step 3: Update Application Layer
- Read driver/vehicle from trips table instead of bookings
- Read courier from route_plan instead of bookings
- Join: `bookings → route_plan → trip` to get all info

### Step 4: Remove Deprecated Columns (Final Cleanup)
```sql
ALTER TABLE bookings 
  DROP COLUMN IF EXISTS _deprecated_courier,
  DROP COLUMN IF EXISTS _deprecated_driver_id,
  DROP COLUMN IF EXISTS _deprecated_driver_name,
  DROP COLUMN IF EXISTS _deprecated_vehicle_id,
  DROP COLUMN IF EXISTS _deprecated_vehicle_plate;
```

## Application Impact

### Current Flow (Inefficient)
```javascript
// Today: Get booking, need to access driver info scattered across tables
const booking = await db.bookings.findById(id);
const routePlan = await db.route_plans.findById(booking.route_plan_id);
const trip = await db.trips.findById(routePlan.trip_id);

// Data scattered across 3 places
console.log(booking.courier);        // Could be here
console.log(routePlan.courier);      // Or here
console.log(booking.driver_name);    // Or here
console.log(trip.driver_name);       // Or here
```

### Optimized Flow
```javascript
// After normalization: Single source of truth for each concern
const booking = await db.bookings.findById(id);
const routePlan = booking.route_plan_id ? await db.route_plans.findById(booking.route_plan_id) : null;
const trip = routePlan?.trip_id ? await db.trips.findById(routePlan.trip_id) : null;

// Clear separation of concerns
console.log(routePlan?.courier);     // Always here, if route exists
console.log(trip?.driver_name);      // Always here, if trip exists
console.log(trip?.vehicle_plate);    // Always here, if trip exists
```

## Benefits

1. **Single Source of Truth**: Each attribute lives in exactly one table
2. **No Data Inconsistency**: Can't have booking.driver_id ≠ trip.driver_id
3. **Cleaner Queries**: No confusion about which field to use
4. **Easier Maintenance**: Changes to courier info only affect route_plans table
5. **Better Integrity**: Foreign key constraints enforce data consistency
6. **Scalability**: Easier to add parallel routes for same booking later

## Current Code Issues to Address

Files using duplicated attributes:
- `web/app/vrds/missions/page.tsx` - Reads courier from multiple places
- `backend/models/Booking.js` - Normalizes driver fields from booking
- `backend/models/RoutePlan.js` - Contains duplicated location fields
- `backend/models/Trip.js` - Contains duplicated distance fields

## Recommendation

1. **Immediate (Low Risk)**: Implement Step 1-2 (junction table + deprecation markers)
2. **Short Term (Medium Risk)**: Update app layer to prefer correct source tables
3. **Future (High Impact)**: Remove deprecated columns and consolidate schema

This approach:
- ✅ Backward compatible during migration
- ✅ Reduces redundancy
- ✅ Improves data integrity
- ✅ Clarifies business logic (booking → routing → execution)
