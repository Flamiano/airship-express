/**
 * PICKUP ROUTE PLANNING & ASSIGNMENT WORKFLOW
 * 
 * Comprehensive types for managing parcel pickup routes,
 * vehicle/driver assignments, and handling remaining parcels.
 */

// ============================================================================
// PARCEL STATUS MACHINE (Pickup Workflow)
// ============================================================================

export type ParcelPickupStatus = 
  | "RECEIVED"                  // Parcel arrived at warehouse
  | "READY_FOR_PICKUP"          // Parcel ready to be picked up
  | "ASSIGNED_TO_ROUTE"         // Parcel assigned to a Route Plan
  | "OUT_FOR_PICKUP"            // Driver is en route to pick up
  | "PICKED_UP"                 // Parcel successfully picked up
  | "PICKUP_FAILED"             // Attempted pickup failed
  | "CANCELLED";

export const PARCEL_PICKUP_STATUS_FLOW: Record<ParcelPickupStatus, ParcelPickupStatus[]> = {
  RECEIVED: ["READY_FOR_PICKUP", "CANCELLED"],
  READY_FOR_PICKUP: ["ASSIGNED_TO_ROUTE", "CANCELLED"],
  ASSIGNED_TO_ROUTE: ["OUT_FOR_PICKUP", "PICKUP_FAILED", "CANCELLED"],
  OUT_FOR_PICKUP: ["PICKED_UP", "PICKUP_FAILED"],
  PICKED_UP: [],
  PICKUP_FAILED: ["READY_FOR_PICKUP", "CANCELLED"],
  CANCELLED: [],
};

// ============================================================================
// ROUTE PLAN STATUS MACHINE
// ============================================================================

export type RoutePlanStatus =
  | "DRAFT"                     // Initial creation
  | "PLANNED"                   // Parcels selected, not yet assigned
  | "VEHICLE_ASSIGNED"          // Vehicle selected
  | "DRIVER_ASSIGNED"           // Driver selected
  | "READY"                     // Ready for execution
  | "IN_PROGRESS"               // Driver has started pickup
  | "COMPLETED"                 // All parcels picked up
  | "COMPLETED_WITH_REMAINING"  // Some parcels picked, rest remain
  | "FAILED"                    // Pickup operation failed
  | "CANCELLED";

export const ROUTE_PLAN_STATUS_FLOW: Record<RoutePlanStatus, RoutePlanStatus[]> = {
  DRAFT: ["PLANNED", "CANCELLED"],
  PLANNED: ["VEHICLE_ASSIGNED", "CANCELLED"],
  VEHICLE_ASSIGNED: ["DRIVER_ASSIGNED", "PLANNED", "CANCELLED"],
  DRIVER_ASSIGNED: ["READY", "VEHICLE_ASSIGNED", "CANCELLED"],
  READY: ["IN_PROGRESS", "DRIVER_ASSIGNED", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "COMPLETED_WITH_REMAINING", "FAILED"],
  COMPLETED: [],
  COMPLETED_WITH_REMAINING: [],
  FAILED: ["PLANNED", "CANCELLED"],
  CANCELLED: [],
};

// ============================================================================
// ROUTE PLAN TYPE
// ============================================================================

export type RoutePlan = {
  id: string;
  routeNumber: string;                    // Human-readable route number (e.g., "RP-001")
  status: RoutePlanStatus;
  pickupDate: string;                     // ISO date string
  plannedPickupTime?: string;             // HH:mm format
  warehouseLocation: {
    name: string;
    address: string;
    lat: number;
    lng: number;
  };
  
  // Parcels
  assignedParcelIds: string[];            // All parcels assigned to this route
  actuallyPickedUpParcelIds: string[];    // Parcels confirmed picked up
  
  // Vehicle & Driver
  assignedVehicleId?: string;
  assignedVehiclePlate?: string;
  assignedDriverId?: string;
  assignedDriverName?: string;
  
  // Tracking
  createdAt: string;
  updatedAt: string;
  startedAt?: string;                     // When driver started pickup
  completedAt?: string;                   // When pickup completed
  
  // Notes & Metadata
  notes?: string;
  failureReason?: string;                 // Why pickup failed
  nextRoutePlanId?: string;               // Link to follow-up route if COMPLETED_WITH_REMAINING
};

// ============================================================================
// PICKUP EVENT / TRANSACTION
// ============================================================================

export type PickupEventType = 
  | "ROUTE_CREATED"
  | "VEHICLE_ASSIGNED"
  | "DRIVER_ASSIGNED"
  | "PICKUP_STARTED"
  | "PARCEL_PICKED_UP"
  | "PARCEL_NOT_PICKED_UP"
  | "PICKUP_COMPLETED"
  | "PICKUP_FAILED"
  | "ROUTE_REPLANNED";

export type PickupEvent = {
  id: string;
  routePlanId: string;
  eventType: PickupEventType;
  timestamp: string;
  parcelId?: string;                      // If specific to a parcel
  driverId?: string;
  notes?: string;
};

// ============================================================================
// ENHANCED PARCEL TYPE (for pickup workflow)
// ============================================================================

export type ParcelForPickup = {
  id: string;
  trackingNumber: string;
  senderName: string;
  senderPhone: string;
  recipientName: string;
  recipientPhone: string;
  pickupAddress: string;                  // Where to pick it up
  pickupLat: number;
  pickupLng: number;
  parcelType: string;
  courier?: string;
  weightKg: number;
  notes?: string;
  
  // Pickup workflow
  status: ParcelPickupStatus;
  receivedAt: string;
  updatedAt?: string;
  
  // Route assignment
  assignedRoutePlanId?: string;           // Current route plan
  previousRoutePlanIds?: string[];        // History of route plans
  lastPickupAttempt?: string;             // ISO timestamp
  
  // Metadata
  handlingInstructions?: string;
};

// ============================================================================
// DATABASE SCHEMA PROPOSALS
// ============================================================================

/**
 * TABLE: parcels_for_pickup
 * 
 * id (PK)
 * tracking_number (UNIQUE)
 * sender_name
 * sender_phone
 * recipient_name
 * recipient_phone
 * pickup_address
 * pickup_lat
 * pickup_lng
 * parcel_type
 * courier
 * weight_kg
 * notes
 * status (ENUM: RECEIVED, READY_FOR_PICKUP, ASSIGNED_TO_ROUTE, OUT_FOR_PICKUP, PICKED_UP, PICKUP_FAILED, CANCELLED)
 * received_at
 * assigned_route_plan_id (FK → route_plans.id, nullable)
 * last_pickup_attempt
 * created_at
 * updated_at
 * 
 * INDEXES:
 *   - status
 *   - assigned_route_plan_id
 *   - received_at
 * 
 * CONSTRAINT:
 *   - A parcel can only be assigned to ONE ACTIVE route plan at a time
 *   - UNIQUE constraint: (assigned_route_plan_id) where status IN ('ASSIGNED_TO_ROUTE', 'OUT_FOR_PICKUP')
 */

/**
 * TABLE: route_plans
 * 
 * id (PK)
 * route_number (UNIQUE)
 * status (ENUM: DRAFT, PLANNED, VEHICLE_ASSIGNED, DRIVER_ASSIGNED, READY, IN_PROGRESS, COMPLETED, COMPLETED_WITH_REMAINING, FAILED, CANCELLED)
 * pickup_date (DATE)
 * planned_pickup_time (TIME, nullable)
 * warehouse_location_id (FK → locations.id)
 * assigned_vehicle_id (FK → vehicles.id, nullable)
 * assigned_driver_id (FK → drivers.id, nullable)
 * created_at
 * updated_at
 * started_at (nullable)
 * completed_at (nullable)
 * notes
 * failure_reason
 * next_route_plan_id (FK → route_plans.id, nullable - for replanning)
 * 
 * INDEXES:
 *   - status
 *   - pickup_date
 *   - assigned_driver_id
 *   - assigned_vehicle_id
 *   - created_at
 */

/**
 * TABLE: route_plan_parcels (junction table)
 * 
 * id (PK)
 * route_plan_id (FK → route_plans.id)
 * parcel_id (FK → parcels_for_pickup.id)
 * assignment_order (INT - order of pickup)
 * assigned_at
 * picked_up_at (nullable - when actually picked up)
 * pickup_confirmed_by (FK → drivers.id)
 * status (ENUM: PENDING, PICKED_UP, FAILED)
 * failure_note
 * 
 * CONSTRAINT:
 *   - UNIQUE(route_plan_id, parcel_id)
 *   - parcel_id must not exist in multiple active route plans
 */

/**
 * TABLE: pickup_events
 * 
 * id (PK)
 * route_plan_id (FK → route_plans.id)
 * event_type (ENUM: ROUTE_CREATED, VEHICLE_ASSIGNED, DRIVER_ASSIGNED, PICKUP_STARTED, PARCEL_PICKED_UP, PARCEL_NOT_PICKED_UP, PICKUP_COMPLETED, PICKUP_FAILED, ROUTE_REPLANNED)
 * parcel_id (FK → parcels_for_pickup.id, nullable)
 * driver_id (FK → drivers.id, nullable)
 * timestamp
 * notes
 * created_at
 * 
 * INDEXES:
 *   - route_plan_id
 *   - timestamp
 *   - event_type
 */

/**
 * TABLE: locations (warehouses)
 * 
 * id (PK)
 * name
 * address
 * latitude
 * longitude
 * is_active
 * created_at
 */
