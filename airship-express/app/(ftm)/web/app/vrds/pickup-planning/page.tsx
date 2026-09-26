"use client";

import React, { useState, useMemo } from "react";
import type {
  RoutePlan,
  ParcelForPickup,
  RoutePlanStatus,
} from "../../lib/pickupWorkflowTypes";
import {
  PickupWorkflowService,
  ParcelStatusService,
  AssignmentValidationService,
  PickupEventLogger,
} from "../../lib/pickupWorkflowService";

const WAREHOUSE_LOCATION = {
  name: "Airship Express Hub - Binondo",
  address: "Binondo, Manila",
  lat: 14.5995,
  lng: 120.9745,
};

const STATUS_COLORS: Record<RoutePlanStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-700 border-slate-300",
  PLANNED: "bg-blue-100 text-blue-700 border-blue-300",
  VEHICLE_ASSIGNED: "bg-indigo-100 text-indigo-700 border-indigo-300",
  DRIVER_ASSIGNED: "bg-purple-100 text-purple-700 border-purple-300",
  READY: "bg-amber-100 text-amber-700 border-amber-300",
  IN_PROGRESS: "bg-cyan-100 text-cyan-700 border-cyan-300",
  COMPLETED: "bg-emerald-100 text-emerald-700 border-emerald-300",
  COMPLETED_WITH_REMAINING: "bg-orange-100 text-orange-700 border-orange-300",
  FAILED: "bg-rose-100 text-rose-700 border-rose-300",
  CANCELLED: "bg-gray-100 text-gray-700 border-gray-300",
};

export default function PickupPlanningPage() {
  // Mock data
  const [parcels, setParcels] = useState<ParcelForPickup[]>([
    {
      id: "p1",
      trackingNumber: "AXP-001",
      senderName: "Seller A",
      senderPhone: "09123456789",
      recipientName: "Customer A",
      recipientPhone: "09987654321",
      pickupAddress: "Binondo, Manila",
      pickupLat: 14.5995,
      pickupLng: 120.9745,
      parcelType: "E-commerce Package",
      weightKg: 2.5,
      status: "READY_FOR_PICKUP",
      receivedAt: new Date().toISOString(),
    },
    // Add more mock parcels as needed
  ]);

  const [routePlans, setRoutePlans] = useState<RoutePlan[]>([]);
  const [drivers] = useState([
    { id: "drv-001", name: "Driver A", status: "Available" },
    { id: "drv-002", name: "Driver B", status: "Available" },
  ]);
  const [vehicles] = useState([
    {
      id: "veh-001",
      plate: "ABC-1234",
      capacityKg: 500,
      status: "Available",
    },
    {
      id: "veh-002",
      plate: "DEF-5678",
      capacityKg: 1000,
      status: "Available",
    },
  ]);

  const [selectedParcels, setSelectedParcels] = useState<Set<string>>(
    new Set()
  );
  const [newRoutePlan, setNewRoutePlan] = useState<RoutePlan | null>(null);
  const [expandedRoute, setExpandedRoute] = useState<string | null>(null);

  // Metrics
  const availableParcels = useMemo(
    () => parcels.filter((p) => p.status === "READY_FOR_PICKUP"),
    [parcels]
  );

  const totalWeightKg = useMemo(
    () =>
      Array.from(selectedParcels).reduce((sum, id) => {
        const p = parcels.find((x) => x.id === id);
        return sum + (p?.weightKg || 0);
      }, 0),
    [selectedParcels, parcels]
  );

  const availableVehicles = useMemo(
    () => PickupWorkflowService.getAvailableVehicles(vehicles, totalWeightKg),
    [vehicles, totalWeightKg]
  );

  const availableDrivers = useMemo(
    () => PickupWorkflowService.getAvailableDrivers(drivers),
    [drivers]
  );

  // Handlers
  const handleCreateRoutePlan = () => {
    if (selectedParcels.size === 0) {
      alert("Select at least one parcel");
      return;
    }

    const selectedParcelObjs = parcels.filter((p) =>
      selectedParcels.has(p.id)
    );

    const route = PickupWorkflowService.createRoutePlan(
      selectedParcelObjs,
      WAREHOUSE_LOCATION,
      new Date().toISOString().split("T")[0]
    );

    setNewRoutePlan(route);
    setRoutePlans([...routePlans, route]);
    setSelectedParcels(new Set());
  };

  const handleAssignVehicle = (routeId: string, vehicleId: string) => {
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    if (!vehicle) return;

    setRoutePlans(
      routePlans.map((r) =>
        r.id === routeId
          ? PickupWorkflowService.assignVehicleToRoutePlan(
              r,
              vehicleId,
              vehicle.plate
            )
          : r
      )
    );
  };

  const handleAssignDriver = (routeId: string, driverId: string) => {
    const driver = drivers.find((d) => d.id === driverId);
    if (!driver) return;

    setRoutePlans(
      routePlans.map((r) =>
        r.id === routeId
          ? PickupWorkflowService.assignDriverToRoutePlan(
              r,
              driverId,
              driver.name
            )
          : r
      )
    );
  };

  const handleStartPickup = (routeId: string) => {
    setRoutePlans(
      routePlans.map((r) =>
        r.id === routeId ? PickupWorkflowService.startPickup(r) : r
      )
    );
  };

  const handleRecordPickup = (routeId: string, parcelId: string) => {
    setRoutePlans(
      routePlans.map((r) =>
        r.id === routeId
          ? PickupWorkflowService.recordParcelPickup(r, parcelId)
          : r
      )
    );
  };

  const handleCompletePickup = (routeId: string) => {
    const route = routePlans.find((r) => r.id === routeId);
    if (!route) return;

    const metrics = PickupWorkflowService.getRouteMetrics(route);
    const completedRoute = PickupWorkflowService.completePickup(route);

    setRoutePlans(
      routePlans.map((r) => (r.id === routeId ? completedRoute : r))
    );

    // Create follow-up route if there are remaining parcels
    if (metrics.remaining > 0) {
      const unpickedIds = PickupWorkflowService.getUnpickedParcelIds(
        completedRoute
      );
      const remainingParcels = parcels.filter((p) =>
        unpickedIds.includes(p.id)
      );

      // Release parcels back to available
      setParcels(
        parcels.map((p) =>
          unpickedIds.includes(p.id)
            ? ParcelStatusService.releaseFromRoute(p)
            : p
        )
      );

      alert(
        `Pickup completed with ${metrics.remaining} remaining parcels. Click "Create Route Plan" to continue.`
      );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <main className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-8">
          <h1 className="text-4xl font-black text-slate-900 mb-2">
            Parcel Pickup Route Planning
          </h1>
          <p className="text-slate-600">
            Create and manage route plans for warehouse parcel pickups
          </p>
        </div>

        {/* Metrics Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-4">
            <div className="text-sm font-semibold text-slate-500 uppercase">
              Available Parcels
            </div>
            <div className="text-3xl font-black text-slate-900 mt-1">
              {availableParcels.length}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-4">
            <div className="text-sm font-semibold text-slate-500 uppercase">
              Selected Weight
            </div>
            <div className="text-3xl font-black text-slate-900 mt-1">
              {totalWeightKg} kg
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-4">
            <div className="text-sm font-semibold text-slate-500 uppercase">
              Active Routes
            </div>
            <div className="text-3xl font-black text-slate-900 mt-1">
              {routePlans.filter((r) => r.status === "IN_PROGRESS").length}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-4">
            <div className="text-sm font-semibold text-slate-500 uppercase">
              Completed Routes
            </div>
            <div className="text-3xl font-black text-slate-900 mt-1">
              {routePlans.filter((r) =>
                [
                  "COMPLETED",
                  "COMPLETED_WITH_REMAINING",
                ].includes(r.status)
              ).length}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Parcels Selection */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6">
              <h2 className="text-xl font-bold text-slate-900 mb-4">
                📦 Available Parcels ({availableParcels.length})
              </h2>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {availableParcels.map((parcel) => (
                  <div
                    key={parcel.id}
                    className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition"
                  >
                    <input
                      type="checkbox"
                      checked={selectedParcels.has(parcel.id)}
                      onChange={(e) => {
                        const newSelected = new Set(selectedParcels);
                        if (e.target.checked) {
                          newSelected.add(parcel.id);
                        } else {
                          newSelected.delete(parcel.id);
                        }
                        setSelectedParcels(newSelected);
                      }}
                      className="w-4 h-4"
                    />
                    <div className="flex-1">
                      <div className="font-mono text-sm font-bold text-slate-900">
                        {parcel.trackingNumber}
                      </div>
                      <div className="text-xs text-slate-600">
                        {parcel.senderName} → {parcel.recipientName}
                      </div>
                    </div>
                    <div className="text-sm font-bold text-slate-700">
                      {parcel.weightKg} kg
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={handleCreateRoutePlan}
                disabled={selectedParcels.size === 0}
                className="w-full mt-4 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white font-bold py-3 rounded-xl transition"
              >
                Create Route Plan ({selectedParcels.size} parcels)
              </button>
            </div>
          </div>

          {/* Right: Route Plan Config */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-4">
                🚗 Resources
              </h3>

              {newRoutePlan && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-2">
                      Vehicle ({availableVehicles.length} available)
                    </label>
                    <select
                      onChange={(e) =>
                        handleAssignVehicle(newRoutePlan.id, e.target.value)
                      }
                      className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                    >
                      <option value="">Select vehicle...</option>
                      {availableVehicles.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.plate} ({v.capacityKg} kg)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-2">
                      Driver ({availableDrivers.length} available)
                    </label>
                    <select
                      onChange={(e) =>
                        handleAssignDriver(newRoutePlan.id, e.target.value)
                      }
                      className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                    >
                      <option value="">Select driver...</option>
                      {availableDrivers.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-2">
                      Pickup Date
                    </label>
                    <input
                      type="date"
                      defaultValue={
                        new Date().toISOString().split("T")[0]
                      }
                      className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                    />
                  </div>

                  <button
                    onClick={() =>
                      handleStartPickup(newRoutePlan.id)
                    }
                    disabled={
                      !newRoutePlan.assignedVehicleId ||
                      !newRoutePlan.assignedDriverId
                    }
                    className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold py-2 rounded-lg transition text-sm"
                  >
                    Start Pickup
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Route Plans List */}
        {routePlans.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">
              Route Plans ({routePlans.length})
            </h2>

            <div className="space-y-3">
              {routePlans.map((route) => {
                const metrics = PickupWorkflowService.getRouteMetrics(
                  route
                );
                const isExpanded = expandedRoute === route.id;

                return (
                  <div
                    key={route.id}
                    className={`border rounded-lg p-4 cursor-pointer ${
                      STATUS_COLORS[route.status]
                    }`}
                    onClick={() =>
                      setExpandedRoute(
                        isExpanded ? null : route.id
                      )
                    }
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-sm">
                          {route.routeNumber}
                        </div>
                        <div className="text-xs mt-1 opacity-75">
                          {metrics.assigned} parcels • {route.assignedDriverName || "No driver"} •{" "}
                          {route.assignedVehiclePlate || "No vehicle"}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold">
                          {route.status}
                        </div>
                        {route.status === "IN_PROGRESS" && (
                          <div className="text-xs mt-1">
                            {metrics.pickedUp} / {metrics.assigned}
                          </div>
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-current border-opacity-30 space-y-3">
                        <div className="grid grid-cols-3 gap-3 text-xs">
                          <div>
                            <div className="opacity-75">Assigned</div>
                            <div className="font-bold text-lg">
                              {metrics.assigned}
                            </div>
                          </div>
                          <div>
                            <div className="opacity-75">Picked Up</div>
                            <div className="font-bold text-lg">
                              {metrics.pickedUp}
                            </div>
                          </div>
                          <div>
                            <div className="opacity-75">Remaining</div>
                            <div className="font-bold text-lg">
                              {metrics.remaining}
                            </div>
                          </div>
                        </div>

                        {route.status === "IN_PROGRESS" && (
                          <div className="space-y-2">
                            <button
                              onClick={() =>
                                handleCompletePickup(route.id)
                              }
                              className="w-full bg-black/20 hover:bg-black/30 text-white font-bold py-2 rounded-lg transition text-sm"
                            >
                              Complete Pickup
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
