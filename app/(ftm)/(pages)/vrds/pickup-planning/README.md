# 📦 Parcel Pickup Route Planning & Driver/Vehicle Assignment System

Complete workflow for managing warehouse parcel pickups with route planning, resource assignment, and remaining parcel handling.

## 📋 System Overview

This system handles the complete lifecycle of parcel pickup from warehouse:

```
150 Parcels Received
    ↓
Route Plan #001 (90 parcels)
    ├─ Vehicle: Van A (1000 kg)
    ├─ Driver: Driver A
    └─ Status: IN_PROGRESS
        ├─ 85 parcels picked up ✓
        └─ 5 parcels failed ✗
    ↓
Route Plan #002 (60 remaining parcels)
    ├─ Vehicle: Van B (1500 kg)
    ├─ Driver: Driver B
    └─ Status: IN_PROGRESS
        └─ 60 parcels picked up ✓
    ↓
Total: 145/150 parcels picked up (96% success)
```

## 📂 File Structure

```
app/(ftm)/web/app/
├── lib/
│   ├── pickupWorkflowTypes.ts         # Type definitions & state machines
│   └── pickupWorkflowService.ts       # Business logic & services
└── vrds/
    └── pickup-planning/
        ├── page.tsx                   # Main UI component
        ├── API_DESIGN.ts              # API specifications & examples
        ├── BUSINESS_RULES.ts          # Constraints & validation rules
        └── README.md                  # This file
```

## 🔄 Parcel Status Machine

```
RECEIVED
   ↓
READY_FOR_PICKUP ←─────────┐
   ↓                       │
ASSIGNED_TO_ROUTE          │
   ├→ OUT_FOR_PICKUP       │
   │   ├→ PICKED_UP ✓      │
   │   └→ PICKUP_FAILED ───┤
   └→ PICKUP_FAILED ───────┤
                           │
                      [Release]
                           ↓
                    READY_FOR_PICKUP
```

**Key Points:**
- Parcels start in `READY_FOR_PICKUP` status
- Only ONE active route can claim a parcel
- Failed pickups are automatically released for replanning
- Successfully picked parcels are never reassigned

## 🛣️ Route Plan Status Machine

```
DRAFT
  ↓
PLANNED (parcels selected)
  ↓
VEHICLE_ASSIGNED (capacity validated)
  ↓
DRIVER_ASSIGNED (availability checked)
  ↓
READY (ready to start)
  ↓
IN_PROGRESS (driver started)
  ├→ COMPLETED (all picked up) [100% success]
  ├→ COMPLETED_WITH_REMAINING (some picked) [can replan]
  └→ FAILED (operation failed) [needs retry]
```

## 💾 Database Schema

### `parcels_for_pickup`
```sql
CREATE TABLE parcels_for_pickup (
  id UUID PRIMARY KEY,
  tracking_number VARCHAR(50) UNIQUE NOT NULL,
  sender_name VARCHAR(255) NOT NULL,
  pickup_address TEXT NOT NULL,
  weight_kg DECIMAL(10, 2),
  status ENUM(...) DEFAULT 'RECEIVED',
  assigned_route_plan_id UUID REFERENCES route_plans(id),
  received_at TIMESTAMP,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### `route_plans`
```sql
CREATE TABLE route_plans (
  id UUID PRIMARY KEY,
  route_number VARCHAR(50) UNIQUE NOT NULL,
  status ENUM(...) DEFAULT 'DRAFT',
  pickup_date DATE NOT NULL,
  assigned_vehicle_id UUID REFERENCES vehicles(id),
  assigned_driver_id UUID REFERENCES drivers(id),
  created_at TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP
);
```

### `route_plan_parcels` (Junction Table)
```sql
CREATE TABLE route_plan_parcels (
  id UUID PRIMARY KEY,
  route_plan_id UUID REFERENCES route_plans(id),
  parcel_id UUID REFERENCES parcels_for_pickup(id),
  assignment_order INT,
  picked_up_at TIMESTAMP,
  status ENUM('PENDING', 'PICKED_UP', 'FAILED')
);
```

### `pickup_events` (Audit Trail)
```sql
CREATE TABLE pickup_events (
  id UUID PRIMARY KEY,
  route_plan_id UUID REFERENCES route_plans(id),
  event_type ENUM(...),
  parcel_id UUID,
  driver_id UUID,
  timestamp TIMESTAMP
);
```

## 🔑 Critical Business Rules

### Rule 1: Single Active Assignment
A parcel can ONLY be assigned to ONE active route plan at a time.

```typescript
// INVALID: Same parcel in two active routes
Route #1: ASSIGNED_TO_ROUTE, parcels: [P1, P2, P3]
Route #2: VEHICLE_ASSIGNED, parcels: [P2, P4, P5]  // P2 is duplicated!

// VALID: Parcel released from completed route can be assigned to new route
Route #1: COMPLETED, parcels: [P1, P2, P3], pickedUp: [P1, P2]
Route #2: PLANNED, parcels: [P3, P4, P5]  // P3 was released
```

### Rule 2: Parcel Status Must Match Assignment
```typescript
// INVALID states:
- status: PICKED_UP, assignedRoutePlanId: null
- status: READY_FOR_PICKUP, assignedRoutePlanId: route-123
- status: OUT_FOR_PICKUP, assignedRoutePlanId: null

// VALID states:
- status: READY_FOR_PICKUP, assignedRoutePlanId: null
- status: ASSIGNED_TO_ROUTE, assignedRoutePlanId: route-123
- status: PICKED_UP, assignedRoutePlanId: null (after completion)
```

### Rule 3: Vehicle Capacity Validation
```typescript
// Reject assignment if:
total_weight_of_parcels > vehicle.capacity_kg

// Example:
Route: 100 parcels × 2.5 kg = 250 kg total
Vehicle A: 200 kg capacity → REJECT
Vehicle B: 300 kg capacity → ACCEPT (smallest sufficient)
```

### Rule 4: Driver Can Only Have ONE Active Route
```typescript
// INVALID:
Driver A → Route #1 (IN_PROGRESS)
Driver A → Route #2 (VEHICLE_ASSIGNED)  // Can't be in two at once

// VALID:
Driver A → Route #1 (COMPLETED)
Driver A → Route #2 (PLANNED)  // Can take new route after current is done
```

## 🚀 Workflow Example

### Morning (8:00 AM)
```typescript
// 150 parcels arrive
parcels: [P1...P150]
status: READY_FOR_PICKUP
```

### Route Planning #1 (9:00 AM)
```typescript
// Create route for 90 parcels
route1 = createRoutePlan([P1...P90], warehouse, "2025-01-15")
// Status: DRAFT

// Select vehicle
assignVehicleToRoutePlan(route1, vehicle_van_a)
// Status: VEHICLE_ASSIGNED
// Capacity check: 90 parcels × 2.5kg = 225kg < 1000kg ✓

// Assign driver
assignDriverToRoutePlan(route1, driver_a)
// Status: DRIVER_ASSIGNED

// Mark as ready
route1.status = READY
parcels[P1...P90].status = ASSIGNED_TO_ROUTE
```

### Pickup #1 (10:00 AM)
```typescript
// Driver starts pickup
startPickup(route1)
// Status: IN_PROGRESS
// Parcels[P1...P90].status = OUT_FOR_PICKUP

// Confirm pickups one by one
for (let i = 0; i < 85; i++) {
  recordParcelPickup(route1, parcels[i])
  // Parcel status: PICKED_UP
}

// 5 parcels not found
failedParcels = [P86, P87, P88, P89, P90]
```

### Completing Route #1 (11:00 AM)
```typescript
completePickup(route1, failedParcels)
// Status: COMPLETED_WITH_REMAINING
// Metrics: 85/90 picked (94% success)
// Remaining: 5 parcels

// System automatically:
// 1. Release failed parcels to READY_FOR_PICKUP
// 2. Keep unselected 60 parcels in READY_FOR_PICKUP
// 3. Total available: 65 parcels (5 + 60)
```

### Route Planning #2 (12:00 PM)
```typescript
// Get remaining parcels
remaining = getParcels({ status: READY_FOR_PICKUP })
// Returns: 65 parcels (5 failed + 60 unselected)

// Create follow-up route
route2 = createRoutePlan(remaining, warehouse, "2025-01-15")
// Automatically assigns all 65 remaining parcels
// Link: route1.nextRoutePlanId = route2.id

// Assign resources
assignVehicleToRoutePlan(route2, vehicle_van_b)
assignDriverToRoutePlan(route2, driver_b)
route2.status = READY
```

### Pickup #2 (2:00 PM)
```typescript
startPickup(route2)
// Driver B picks up all 65 parcels
for (let i = 0; i < 65; i++) {
  recordParcelPickup(route2, remaining[i])
}

completePickup(route2)
// Status: COMPLETED
// Metrics: 65/65 picked (100% success)
```

### Final Result (3:30 PM)
```typescript
// All 150 parcels picked up
// Route #1: 85/90 (94%)
// Route #2: 65/65 (100%)
// Duplicate risk: ZERO (each parcel assigned once)
// System integrity: MAINTAINED

// Audit trail available for every event
auditTrail = getAuditTrail(route1)
// Shows: creation, assignments, all pickups, completion, release events
```

## 📡 API Endpoints

### Create Route Plan
```
POST /api/pickup/route-plans
{
  "parcelIds": ["p-1", "p-2", ..., "p-90"],
  "pickupDate": "2025-01-15",
  "plannedPickupTime": "09:00",
  "warehouseLocationId": "loc-1"
}
```

### Assign Vehicle & Driver
```
POST /api/pickup/route-plans/{routeId}/assign-vehicle
{ "vehicleId": "veh-1" }

POST /api/pickup/route-plans/{routeId}/assign-driver
{ "driverId": "drv-1" }
```

### Start & Complete Pickup
```
POST /api/pickup/route-plans/{routeId}/start

POST /api/pickup/route-plans/{routeId}/parcel-pickup
{ "parcelId": "p-1", "confirmedByDriverId": "drv-1" }

POST /api/pickup/route-plans/{routeId}/complete
{ "failedParcelIds": ["p-5", "p-10"], "notes": "..." }
```

### Get Remaining Parcels & Replan
```
GET /api/pickup/route-plans/{routeId}/remaining-parcels

POST /api/pickup/replan
{ "previousRoutePlanId": "route-1", "pickupDate": "2025-01-15" }
```

See `API_DESIGN.ts` for complete API documentation with request/response examples.

## ✅ Data Integrity Guarantees

1. **No Duplicate Assignments**: Database UNIQUE constraints + application validation
2. **Status Consistency**: Parcel status always matches assignment state
3. **Audit Trail**: Every event logged and immutable
4. **Idempotency**: Retried calls produce identical results
5. **Release Management**: Unpicked parcels automatically returned to pool
6. **Cascade Safety**: Can't delete route while parcels assigned

## 🛡️ Error Handling

System REJECTS and returns error if:

```
✗ Parcel already assigned to active route
✗ Vehicle capacity insufficient
✗ Driver already has active route
✗ Parcel not in READY_FOR_PICKUP status
✗ Route not in correct status for operation
✗ Invalid parcel or resource IDs
✗ Duplicate parcel in request
```

## 📊 Monitoring & Alerts

System should monitor:

- Parcels stuck in ASSIGNED_TO_ROUTE for > 24 hours
- High failure rate (>50%) on single route
- Parcels with > 3 failed pickup attempts
- Routes running > 8 hours
- Data integrity violations

## 🔧 Implementation Notes

### Service Classes

**PickupWorkflowService**
- `createRoutePlan()` - Create new route
- `assignVehicleToRoutePlan()` - Assign vehicle
- `assignDriverToRoutePlan()` - Assign driver
- `startPickup()` - Begin pickup operation
- `recordParcelPickup()` - Mark parcel picked
- `completePickup()` - Finish and analyze
- `getRouteMetrics()` - Calculate success rate

**ParcelStatusService**
- `assignToRoute()` - Transition parcel to assigned
- `markPickedUp()` - Mark successfully picked
- `markPickupFailed()` - Mark failed pickup
- `releaseFromRoute()` - Return to available
- `startPickupProcess()` - Transition to out-for-pickup

**AssignmentValidationService**
- `isParcelActivelyAssigned()` - Check if in active route
- `validateParcelAssignmentEligibility()` - Validate before assign
- `validateRouteIntegrity()` - Check for duplicates

## 🎯 Success Criteria

A well-functioning system demonstrates:

✓ Zero duplicate parcel assignments
✓ All released parcels available for next route
✓ 100% audit trail for compliance
✓ <5 min latency for route operations
✓ Automatic handling of remaining parcels
✓ Clear visibility into pickup success rates
✓ Reliable resource allocation
✓ No data integrity violations

## 📞 Support & Questions

For detailed rules, see: `BUSINESS_RULES.ts`
For API specs, see: `API_DESIGN.ts`
For implementation, see: `pickupWorkflowTypes.ts` and `pickupWorkflowService.ts`
