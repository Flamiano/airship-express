/**
 * PICKUP WORKFLOW SERVICE
 * 
 * Core business logic for:
 * - Route plan creation and management
 * - Vehicle/driver assignment
 * - Parcel tracking and status updates
 * - Handling remaining parcels
 * - Replanning functionality
 */

import type {
  RoutePlan,
  RoutePlanStatus,
  ParcelPickupStatus,
  PickupEvent,
  ParcelForPickup,
} from "./pickupWorkflowTypes";

// ============================================================================
// ROUTE PLAN SERVICE
// ============================================================================

export class PickupWorkflowService {
  /**
   * Create a new Route Plan
   * 
   * @param parcels - Parcels to include in the route
   * @param warehouseLocation - Pickup location details
   * @param pickupDate - Date for the pickup
   * @param plannedTime - Optional planned time
   * @returns New RoutePlan in DRAFT status
   */
  static createRoutePlan(
    parcels: ParcelForPickup[],
    warehouseLocation: RoutePlan["warehouseLocation"],
    pickupDate: string,
    plannedTime?: string
  ): RoutePlan {
    const routeNumber = this.generateRouteNumber();
    const now = new Date().toISOString();

    return {
      id: `route-${Date.now().toString(36)}`,
      routeNumber,
      status: "DRAFT",
      pickupDate,
      plannedPickupTime: plannedTime,
      warehouseLocation,
      assignedParcelIds: parcels.map((p) => p.id),
      actuallyPickedUpParcelIds: [],
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Get available vehicles for a route
   * Filters by capacity and current availability
   */
  static getAvailableVehicles(
    vehicles: Array<{ id: string; plate: string; capacityKg: number; status: string }>,
    requiredCapacityKg: number
  ) {
    return vehicles.filter(
      (v) => v.status === "Available" && v.capacityKg >= requiredCapacityKg
    );
  }

  /**
   * Get available drivers
   */
  static getAvailableDrivers(
    drivers: Array<{ id: string; name: string; status: string }>
  ) {
    return drivers.filter((d) => d.status === "Available");
  }

  /**
   * Assign vehicle to route plan
   */
  static assignVehicleToRoutePlan(
    routePlan: RoutePlan,
    vehicleId: string,
    vehiclePlate: string
  ): RoutePlan {
    return {
      ...routePlan,
      assignedVehicleId: vehicleId,
      assignedVehiclePlate: vehiclePlate,
      status: "VEHICLE_ASSIGNED",
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Assign driver to route plan
   */
  static assignDriverToRoutePlan(
    routePlan: RoutePlan,
    driverId: string,
    driverName: string
  ): RoutePlan {
    return {
      ...routePlan,
      assignedDriverId: driverId,
      assignedDriverName: driverName,
      status: "DRIVER_ASSIGNED",
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Mark route plan as ready for execution
   */
  static markRoutePlanReady(routePlan: RoutePlan): RoutePlan {
    if (
      !routePlan.assignedVehicleId ||
      !routePlan.assignedDriverId
    ) {
      throw new Error(
        "Cannot mark route ready: vehicle and driver must be assigned"
      );
    }

    return {
      ...routePlan,
      status: "READY",
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Start pickup operations
   */
  static startPickup(routePlan: RoutePlan): RoutePlan {
    return {
      ...routePlan,
      status: "IN_PROGRESS",
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Record a parcel as picked up
   */
  static recordParcelPickup(
    routePlan: RoutePlan,
    parcelId: string
  ): RoutePlan {
    if (!routePlan.assignedParcelIds.includes(parcelId)) {
      throw new Error("Parcel not assigned to this route plan");
    }

    const updatedPicked = Array.from(
      new Set([...routePlan.actuallyPickedUpParcelIds, parcelId])
    );

    return {
      ...routePlan,
      actuallyPickedUpParcelIds: updatedPicked,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Complete the pickup operation
   * 
   * Determines if all parcels were picked up or if there are remaining
   */
  static completePickup(
    routePlan: RoutePlan
  ): RoutePlan {
    const allAssigned = routePlan.assignedParcelIds.length;
    const actuallyPicked = routePlan.actuallyPickedUpParcelIds.length;
    const hasRemaining = actuallyPicked < allAssigned;

    return {
      ...routePlan,
      status: hasRemaining
        ? "COMPLETED_WITH_REMAINING"
        : "COMPLETED",
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Get remaining parcels that were not picked up
   */
  static getUnpickedParcelIds(routePlan: RoutePlan): string[] {
    return routePlan.assignedParcelIds.filter(
      (id) => !routePlan.actuallyPickedUpParcelIds.includes(id)
    );
  }

  /**
   * Create a follow-up route plan for remaining parcels
   */
  static createFollowUpRoutePlan(
    originalRoute: RoutePlan,
    remainingParcels: ParcelForPickup[],
    warehouseLocation: RoutePlan["warehouseLocation"],
    pickupDate: string
  ): RoutePlan {
    const newRoute = this.createRoutePlan(
      remainingParcels,
      warehouseLocation,
      pickupDate
    );

    // Link the routes together
    return {
      ...newRoute,
      notes: `Follow-up for Route ${originalRoute.routeNumber} with ${remainingParcels.length} remaining parcels`,
    };
  }

  /**
   * Mark route plan as failed
   */
  static markRouteFailed(
    routePlan: RoutePlan,
    failureReason: string
  ): RoutePlan {
    return {
      ...routePlan,
      status: "FAILED",
      failureReason,
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Get metrics for a route plan
   */
  static getRouteMetrics(routePlan: RoutePlan) {
    const assigned = routePlan.assignedParcelIds.length;
    const pickedUp = routePlan.actuallyPickedUpParcelIds.length;
    const remaining = assigned - pickedUp;
    const successRate =
      assigned === 0 ? 0 : Math.round((pickedUp / assigned) * 100);

    return {
      assigned,
      pickedUp,
      remaining,
      successRate,
      percentage: `${successRate}%`,
    };
  }

  /**
   * Generate human-readable route number
   */
  private static generateRouteNumber(): string {
    const now = new Date();
    const timestamp = Math.floor(Date.now() / 1000);
    const sequence = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, "0");
    return `RP-${now.toISOString().split("T")[0]}-${sequence}`;
  }
}

// ============================================================================
// PARCEL STATUS MANAGEMENT
// ============================================================================

export class ParcelStatusService {
  /**
   * Transition parcel to assigned status
   */
  static assignToRoute(
    parcel: ParcelForPickup,
    routePlanId: string
  ): ParcelForPickup {
    if (parcel.status !== "READY_FOR_PICKUP") {
      throw new Error(
        `Cannot assign parcel in ${parcel.status} status. Must be READY_FOR_PICKUP`
      );
    }

    return {
      ...parcel,
      status: "ASSIGNED_TO_ROUTE",
      assignedRoutePlanId: routePlanId,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Mark parcel as picked up
   */
  static markPickedUp(parcel: ParcelForPickup): ParcelForPickup {
    if (parcel.status !== "OUT_FOR_PICKUP" && parcel.status !== "ASSIGNED_TO_ROUTE") {
      throw new Error(`Cannot pick up parcel in ${parcel.status} status`);
    }

    return {
      ...parcel,
      status: "PICKED_UP",
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Mark pickup as failed and return parcel to available
   */
  static markPickupFailed(
    parcel: ParcelForPickup,
    failureReason?: string
  ): ParcelForPickup {
    return {
      ...parcel,
      status: "PICKUP_FAILED",
      lastPickupAttempt: new Date().toISOString(),
      notes: failureReason ? `${parcel.notes || ""}\nPickup failed: ${failureReason}` : parcel.notes,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Release parcel back to available pool (after failed pickup or replan)
   */
  static releaseFromRoute(
    parcel: ParcelForPickup
  ): ParcelForPickup {
    return {
      ...parcel,
      status: "READY_FOR_PICKUP",
      previousRoutePlanIds: [
        ...(parcel.previousRoutePlanIds || []),
        ...(parcel.assignedRoutePlanId ? [parcel.assignedRoutePlanId] : []),
      ],
      assignedRoutePlanId: undefined,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Start pickup for a parcel (driver en route)
   */
  static startPickupProcess(parcel: ParcelForPickup): ParcelForPickup {
    if (parcel.status !== "ASSIGNED_TO_ROUTE") {
      throw new Error(
        `Cannot start pickup for parcel in ${parcel.status} status`
      );
    }

    return {
      ...parcel,
      status: "OUT_FOR_PICKUP",
      updatedAt: new Date().toISOString(),
    };
  }
}

// ============================================================================
// PREVENTING DUPLICATE ASSIGNMENTS
// ============================================================================

export class AssignmentValidationService {
  /**
   * Check if a parcel is already assigned to an active route
   */
  static isParcelActivelyAssigned(
    parcel: ParcelForPickup,
    activeRoutePlans: RoutePlan[]
  ): boolean {
    if (!parcel.assignedRoutePlanId) return false;

    const assignedRoute = activeRoutePlans.find(
      (r) => r.id === parcel.assignedRoutePlanId
    );

    if (!assignedRoute) return false;

    // Parcel is actively assigned if route is in active status
    const activeStatuses: RoutePlanStatus[] = [
      "PLANNED",
      "VEHICLE_ASSIGNED",
      "DRIVER_ASSIGNED",
      "READY",
      "IN_PROGRESS",
    ];

    return activeStatuses.includes(assignedRoute.status);
  }

  /**
   * Validate that a parcel can be assigned to a new route
   */
  static validateParcelAssignmentEligibility(
    parcel: ParcelForPickup,
    activeRoutePlans: RoutePlan[]
  ): { eligible: boolean; reason?: string } {
    // Parcel must be in READY_FOR_PICKUP or PICKUP_FAILED status
    if (
      parcel.status !== "READY_FOR_PICKUP" &&
      parcel.status !== "PICKUP_FAILED"
    ) {
      return {
        eligible: false,
        reason: `Parcel status is ${parcel.status}, must be READY_FOR_PICKUP or PICKUP_FAILED`,
      };
    }

    // Parcel must not be actively assigned
    if (this.isParcelActivelyAssigned(parcel, activeRoutePlans)) {
      return {
        eligible: false,
        reason: `Parcel is already assigned to active Route ${parcel.assignedRoutePlanId}`,
      };
    }

    return { eligible: true };
  }

  /**
   * Validate that no parcel appears in multiple active routes
   */
  static validateRouteIntegrity(
    route: RoutePlan,
    allRoutePlans: RoutePlan[]
  ): { valid: boolean; conflicts?: string[] } {
    const activeRoutes = allRoutePlans.filter(
      (r) =>
        r.status !== "CANCELLED" &&
        r.status !== "COMPLETED" &&
        r.status !== "COMPLETED_WITH_REMAINING" &&
        r.status !== "FAILED"
    );

    const conflicts: string[] = [];

    for (const parcelId of route.assignedParcelIds) {
      const otherRoutes = activeRoutes.filter(
        (r) =>
          r.id !== route.id && r.assignedParcelIds.includes(parcelId)
      );

      if (otherRoutes.length > 0) {
        conflicts.push(
          `Parcel ${parcelId} is also in routes: ${otherRoutes.map((r) => r.routeNumber).join(", ")}`
        );
      }
    }

    return {
      valid: conflicts.length === 0,
      conflicts: conflicts.length > 0 ? conflicts : undefined,
    };
  }
}

// ============================================================================
// EVENT LOGGING
// ============================================================================

export class PickupEventLogger {
  static createEvent(
    routePlanId: string,
    eventType: string,
    parcelId?: string,
    driverId?: string,
    notes?: string
  ): PickupEvent {
    return {
      id: `evt-${Date.now().toString(36)}`,
      routePlanId,
      eventType: eventType as any,
      timestamp: new Date().toISOString(),
      parcelId,
      driverId,
      notes,
    };
  }
}
