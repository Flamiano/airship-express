/**
 * Pickup Planning & Route Management API Routes
 * Implements warehouse parcel pickup workflow with route planning and assignment
 * 
 * Endpoints (A-L):
 * A. GET /api/pickup/parcels - Get parcels available for pickup
 * B. POST /api/pickup/route-plans - Create route plan
 * C. POST /api/pickup/route-plans/{id}/assign-vehicle - Assign vehicle
 * D. POST /api/pickup/route-plans/{id}/assign-driver - Assign driver
 * E. GET /api/pickup/resources/available - Get available vehicles and drivers
 * F. POST /api/pickup/route-plans/{id}/start - Start pickup
 * G. POST /api/pickup/route-plans/{id}/parcel-pickup - Record parcel pickup
 * H. POST /api/pickup/route-plans/{id}/complete - Complete route
 * I. GET /api/pickup/route-plans/{id}/remaining-parcels - Get unpicked parcels
 * J. POST /api/pickup/replan - Create follow-up route
 * K. GET /api/pickup/route-plans - List route plans
 * L. GET /api/pickup/audit-trail/{id} - Get audit log
 */

const express = require('express');
const router = express.Router();
const { getSupabase, getServiceSupabase } = require('../config/db');

// Helper to get Supabase client
function getClient() {
  return getServiceSupabase() || getSupabase();
}

// ============================================================================
// A. GET /api/pickup/parcels
// Get parcels available for pickup planning
// ============================================================================
router.get('/parcels', async (req, res) => {
  try {
    const supabase = getClient();
    const { status = 'ready_for_pickup', limit = 100, offset = 0 } = req.query;

    // Query parcels with the specified status
    let query = supabase
      .from('parcels_for_pickup')
      .select('*')
      .eq('status', status || 'ready_for_pickup')
      .range(offset, offset + limit - 1);

    const { data: parcels, error: parcelsError, count } = await query;

    if (parcelsError) {
      return res.status(400).json({ success: false, error: parcelsError.message });
    }

    // Get total count
    const { count: totalCount, error: countError } = await supabase
      .from('parcels_for_pickup')
      .select('*', { count: 'exact', head: true })
      .eq('status', status || 'ready_for_pickup');

    const available = (parcels || []).length;
    const total = totalCount || 0;

    res.json({
      success: true,
      data: {
        parcels: parcels || [],
        total,
        available
      }
    });
  } catch (error) {
    console.error('Error fetching parcels:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// B. POST /api/pickup/route-plans
// Create a new route plan
// ============================================================================
router.post('/route-plans', async (req, res) => {
  try {
    const supabase = getClient();
    const { parcelIds, pickupDate, plannedPickupTime, warehouseLocationId, notes } = req.body;

    // Validate input
    if (!parcelIds || !Array.isArray(parcelIds) || parcelIds.length === 0) {
      return res.status(400).json({ success: false, error: 'parcelIds must be a non-empty array' });
    }
    if (!pickupDate) {
      return res.status(400).json({ success: false, error: 'pickupDate is required' });
    }

    // Validate all parcels exist and are in READY_FOR_PICKUP status
    const { data: parcels, error: parcelsError } = await supabase
      .from('parcels_for_pickup')
      .select('id, status')
      .in('id', parcelIds);

    if (parcelsError) {
      return res.status(400).json({ success: false, error: parcelsError.message });
    }

    if (parcels.length !== parcelIds.length) {
      return res.status(400).json({ success: false, error: 'Some parcel IDs do not exist' });
    }

    // Check for invalid status
    const invalidParcels = parcels.filter(
      p => !['ready_for_pickup', 'pickup_failed'].includes(p.status)
    );
    if (invalidParcels.length > 0) {
      return res.status(400).json({
        success: false,
        error: `${invalidParcels.length} parcels are not in READY_FOR_PICKUP or PICKUP_FAILED status`
      });
    }

    // Check for duplicate assignments
    const { data: assignedParcels, error: assignError } = await supabase
      .from('route_plan_parcels')
      .select('parcel_id')
      .in('parcel_id', parcelIds);

    if (assignError) {
      console.error('Error checking parcel assignments:', assignError);
    } else if (assignedParcels && assignedParcels.length > 0) {
      return res.status(400).json({
        success: false,
        error: `${assignedParcels.length} parcels are already assigned to active routes`
      });
    }

    // Generate route number
    const dateStr = pickupDate.replace(/-/g, '');
    const routeNumber = `RP-${dateStr}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

    // Create route plan
    const { data: routePlan, error: routeError } = await supabase
      .from('route_plans')
      .insert({
        route_number: routeNumber,
        status: 'draft',
        pickup_date: pickupDate,
        planned_pickup_time: plannedPickupTime,
        warehouse_location_id: warehouseLocationId,
        notes,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (routeError) {
      return res.status(400).json({ success: false, error: routeError.message });
    }

    // Assign parcels to route
    const parcelAssignments = parcelIds.map((parcelId, idx) => ({
      route_plan_id: routePlan.id,
      parcel_id: parcelId,
      assignment_order: idx + 1,
      assigned_at: new Date().toISOString(),
      status: 'pending'
    }));

    const { error: assignmentError } = await supabase
      .from('route_plan_parcels')
      .insert(parcelAssignments);

    if (assignmentError) {
      return res.status(400).json({ success: false, error: assignmentError.message });
    }

    // Update parcel status to ASSIGNED_TO_ROUTE
    const { error: updateError } = await supabase
      .from('parcels_for_pickup')
      .update({
        status: 'assigned_to_route',
        assigned_route_plan_id: routePlan.id,
        updated_at: new Date().toISOString()
      })
      .in('id', parcelIds);

    if (updateError) {
      console.error('Error updating parcel status:', updateError);
    }

    // Calculate total weight
    const totalWeightKg = parcels.reduce((sum, p) => sum + (p.weight_kg || 0), 0);

    // Log event
    await supabase.from('pickup_events').insert({
      route_plan_id: routePlan.id,
      event_type: 'route_created',
      timestamp: new Date().toISOString(),
      notes: `Route created with ${parcelIds.length} parcels`
    });

    res.status(201).json({
      success: true,
      data: {
        id: routePlan.id,
        routeNumber: routePlan.route_number,
        status: routePlan.status,
        assignedParcelIds: parcelIds,
        actuallyPickedUpParcelIds: [],
        totalWeightKg,
        createdAt: routePlan.created_at
      }
    });
  } catch (error) {
    console.error('Error creating route plan:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// C. POST /api/pickup/route-plans/{id}/assign-vehicle
// Assign a vehicle to route plan
// ============================================================================
router.post('/route-plans/:id/assign-vehicle', async (req, res) => {
  try {
    const supabase = getClient();
    const { id } = req.params;
    const { vehicleId } = req.body;

    if (!vehicleId) {
      return res.status(400).json({ success: false, error: 'vehicleId is required' });
    }

    // Get route plan
    const { data: routePlan, error: routeError } = await supabase
      .from('route_plans')
      .select('*')
      .eq('id', id)
      .single();

    if (routeError || !routePlan) {
      return res.status(404).json({ success: false, error: 'Route plan not found' });
    }

    // Get vehicle
    const { data: vehicle, error: vehicleError } = await supabase
      .from('vehicles')
      .select('*')
      .eq('id', vehicleId)
      .single();

    if (vehicleError || !vehicle) {
      return res.status(404).json({ success: false, error: 'Vehicle not found' });
    }

    // Check vehicle capacity
    const { data: parcels } = await supabase
      .from('route_plan_parcels')
      .select('parcel_id')
      .eq('route_plan_id', id);

    if (parcels && parcels.length > 0) {
      const parcelIds = parcels.map(p => p.parcel_id);
      const { data: parcelDetails } = await supabase
        .from('parcels_for_pickup')
        .select('weight_kg')
        .in('id', parcelIds);

      const totalWeight = parcelDetails?.reduce((sum, p) => sum + (p.weight_kg || 0), 0) || 0;

      if (vehicle.capacity_kg && totalWeight > vehicle.capacity_kg) {
        return res.status(400).json({
          success: false,
          error: `Vehicle capacity (${vehicle.capacity_kg}kg) insufficient for route weight (${totalWeight}kg)`
        });
      }
    }

    // Update route plan
    const { data: updated, error: updateError } = await supabase
      .from('route_plans')
      .update({
        assigned_vehicle_id: vehicleId,
        status: 'vehicle_assigned',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return res.status(400).json({ success: false, error: updateError.message });
    }

    // Log event
    await supabase.from('pickup_events').insert({
      route_plan_id: id,
      event_type: 'vehicle_assigned',
      timestamp: new Date().toISOString(),
      notes: `Vehicle ${vehicle.plate} assigned`
    });

    res.json({
      success: true,
      data: {
        id: updated.id,
        status: updated.status,
        assignedVehicleId: updated.assigned_vehicle_id,
        assignedVehiclePlate: vehicle.plate
      }
    });
  } catch (error) {
    console.error('Error assigning vehicle:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// D. POST /api/pickup/route-plans/{id}/assign-driver
// Assign a driver to route plan
// ============================================================================
router.post('/route-plans/:id/assign-driver', async (req, res) => {
  try {
    const supabase = getClient();
    const { id } = req.params;
    const { driverId } = req.body;

    if (!driverId) {
      return res.status(400).json({ success: false, error: 'driverId is required' });
    }

    // Get route plan
    const { data: routePlan, error: routeError } = await supabase
      .from('route_plans')
      .select('*')
      .eq('id', id)
      .single();

    if (routeError || !routePlan) {
      return res.status(404).json({ success: false, error: 'Route plan not found' });
    }

    // Get driver (handle missing drivers table gracefully)
    let driver = { id: driverId, name: 'Driver' };
    const { data: driverData, error: driverError } = await supabase
      .from('drivers')
      .select('*')
      .eq('id', driverId)
      .single();

    // If drivers table exists and driver found, use it; otherwise use placeholder
    if (driverData && !driverError) {
      driver = driverData;
    } else if (driverError && !driverError.message.includes('schema cache')) {
      // Only fail if it's a real "not found" error, not a table-doesn't-exist error
      return res.status(404).json({ success: false, error: 'Driver not found' });
    }
    // If table doesn't exist (schema cache error), continue with placeholder driver

    // Check if driver is already assigned to another active route (skip if table doesn't exist)
    try {
      const { data: activeRoutes } = await supabase
        .from('route_plans')
        .select('id')
        .eq('assigned_driver_id', driverId)
        .in('status', ['planned', 'vehicle_assigned', 'driver_assigned', 'ready', 'in_progress']);

      if (activeRoutes && activeRoutes.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Driver is already assigned to another active route'
        });
      }
    } catch (e) {
      console.log('Could not check active routes, proceeding');
    }

    // Update route plan
    const { data: updated, error: updateError } = await supabase
      .from('route_plans')
      .update({
        assigned_driver_id: driverId,
        status: 'driver_assigned',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return res.status(400).json({ success: false, error: updateError.message });
    }

    // Log event
    await supabase.from('pickup_events').insert({
      route_plan_id: id,
      driver_id: driverId,
      event_type: 'driver_assigned',
      timestamp: new Date().toISOString(),
      notes: `Driver ${driver.name} assigned`
    });

    res.json({
      success: true,
      data: {
        id: updated.id,
        status: updated.status,
        assignedDriverId: updated.assigned_driver_id,
        assignedDriverName: driver.name
      }
    });
  } catch (error) {
    console.error('Error assigning driver:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// E. GET /api/pickup/resources/available
// Get available vehicles and drivers
// ============================================================================
router.get('/resources/available', async (req, res) => {
  try {
    const supabase = getClient();
    const { requiredCapacityKg } = req.query;

    // Get available vehicles
    let vehicleQuery = supabase
      .from('vehicles')
      .select('id, plate, capacity_kg, status')
      .eq('status', 'available');

    if (requiredCapacityKg) {
      vehicleQuery = vehicleQuery.gte('capacity_kg', requiredCapacityKg);
    }

    const { data: vehicles, error: vehicleError } = await vehicleQuery;

    // Get available drivers (handle missing drivers table gracefully)
    let drivers = [];
    try {
      const { data: driversData, error: driverError } = await supabase
        .from('drivers')
        .select('id, name, status')
        .eq('status', 'available');
      
      if (!driverError) {
        drivers = driversData || [];
      }
    } catch (e) {
      // Drivers table doesn't exist, skip it
      console.log('Drivers table not available, using empty driver list');
    }

    // Only fail on vehicle errors
    if (vehicleError) {
      return res.status(400).json({
        success: false,
        error: vehicleError?.message
      });
    }

    res.json({
      success: true,
      data: {
        vehicles: vehicles || [],
        drivers: drivers || []
      }
    });
  } catch (error) {
    console.error('Error fetching available resources:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// F. POST /api/pickup/route-plans/{id}/start
// Start pickup operations for a route
// ============================================================================
router.post('/route-plans/:id/start', async (req, res) => {
  try {
    const supabase = getClient();
    const { id } = req.params;
    const { driverId } = req.body;

    // Get route plan
    const { data: routePlan, error: routeError } = await supabase
      .from('route_plans')
      .select('*')
      .eq('id', id)
      .single();

    if (routeError || !routePlan) {
      return res.status(404).json({ success: false, error: 'Route plan not found' });
    }

    if (routePlan.status !== 'driver_assigned' && routePlan.status !== 'ready') {
      return res.status(400).json({
        success: false,
        error: `Cannot start pickup from status: ${routePlan.status}`
      });
    }

    const now = new Date().toISOString();

    // Update route plan status
    const { data: updated, error: updateError } = await supabase
      .from('route_plans')
      .update({
        status: 'in_progress',
        started_at: now,
        updated_at: now
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return res.status(400).json({ success: false, error: updateError.message });
    }

    // Update parcel status to OUT_FOR_PICKUP
    const { data: parcels } = await supabase
      .from('route_plan_parcels')
      .select('parcel_id')
      .eq('route_plan_id', id);

    if (parcels && parcels.length > 0) {
      const parcelIds = parcels.map(p => p.parcel_id);
      await supabase
        .from('parcels_for_pickup')
        .update({
          status: 'out_for_pickup',
          updated_at: now
        })
        .in('id', parcelIds);
    }

    // Log event
    await supabase.from('pickup_events').insert({
      route_plan_id: id,
      driver_id: driverId || routePlan.assigned_driver_id,
      event_type: 'pickup_started',
      timestamp: now
    });

    res.json({
      success: true,
      data: {
        id: updated.id,
        status: updated.status,
        startedAt: updated.started_at
      }
    });
  } catch (error) {
    console.error('Error starting pickup:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// G. POST /api/pickup/route-plans/{id}/parcel-pickup
// Record a parcel as picked up
// ============================================================================
router.post('/route-plans/:id/parcel-pickup', async (req, res) => {
  try {
    const supabase = getClient();
    const { id } = req.params;
    const { parcelId, confirmedByDriverId } = req.body;

    if (!parcelId) {
      return res.status(400).json({ success: false, error: 'parcelId is required' });
    }

    // Get route plan
    const { data: routePlan, error: routeError } = await supabase
      .from('route_plans')
      .select('*')
      .eq('id', id)
      .single();

    if (routeError || !routePlan) {
      return res.status(404).json({ success: false, error: 'Route plan not found' });
    }

    if (routePlan.status !== 'in_progress') {
      return res.status(400).json({
        success: false,
        error: `Cannot record pickup from route status: ${routePlan.status}`
      });
    }

    const now = new Date().toISOString();

    // Check if parcel already picked up
    const { data: existingPickup } = await supabase
      .from('route_plan_parcels')
      .select('*')
      .eq('route_plan_id', id)
      .eq('parcel_id', parcelId)
      .eq('status', 'picked_up');

    if (existingPickup && existingPickup.length > 0) {
      return res.json({
        success: true,
        data: { message: 'Parcel already picked up' }
      });
    }

    // Update route_plan_parcels
    const { error: updateParcelError } = await supabase
      .from('route_plan_parcels')
      .update({
        status: 'picked_up',
        picked_up_at: now,
        pickup_confirmed_by: confirmedByDriverId
      })
      .eq('route_plan_id', id)
      .eq('parcel_id', parcelId);

    if (updateParcelError) {
      return res.status(400).json({ success: false, error: updateParcelError.message });
    }

    // Update parcel status
    const { error: updateParcelStatusError } = await supabase
      .from('parcels_for_pickup')
      .update({
        status: 'picked_up',
        updated_at: now
      })
      .eq('id', parcelId);

    if (updateParcelStatusError) {
      console.error('Error updating parcel status:', updateParcelStatusError);
    }

    // Log event
    await supabase.from('pickup_events').insert({
      route_plan_id: id,
      parcel_id: parcelId,
      driver_id: confirmedByDriverId,
      event_type: 'parcel_picked_up',
      timestamp: now
    });

    res.json({
      success: true,
      data: {
        routePlan: { id, actuallyPickedUpParcelIds: [parcelId] },
        parcel: { id: parcelId, status: 'picked_up' }
      }
    });
  } catch (error) {
    console.error('Error recording parcel pickup:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// H. POST /api/pickup/route-plans/{id}/complete
// Complete route operations
// ============================================================================
router.post('/route-plans/:id/complete', async (req, res) => {
  try {
    const supabase = getClient();
    const { id } = req.params;
    const { failedParcelIds = [], notes } = req.body;

    // Get route plan
    const { data: routePlan, error: routeError } = await supabase
      .from('route_plans')
      .select('*')
      .eq('id', id)
      .single();

    if (routeError || !routePlan) {
      return res.status(404).json({ success: false, error: 'Route plan not found' });
    }

    // Get all parcels for this route
    const { data: routeParcels } = await supabase
      .from('route_plan_parcels')
      .select('parcel_id, status')
      .eq('route_plan_id', id);

    const assignedParcels = routeParcels?.map(p => p.parcel_id) || [];
    const pickedUpParcels = routeParcels?.filter(p => p.status === 'picked_up').map(p => p.parcel_id) || [];
    const unpickedParcels = assignedParcels.filter(p => !pickedUpParcels.includes(p));

    const assigned = assignedParcels.length;
    const pickedUp = pickedUpParcels.length;
    const remaining = unpickedParcels.length;
    const successRate = assigned > 0 ? Math.round((pickedUp / assigned) * 100) : 0;

    const now = new Date().toISOString();
    const newStatus = pickedUp === assigned ? 'completed' : 'completed_with_remaining';

    // Update route plan
    const { data: updated, error: updateError } = await supabase
      .from('route_plans')
      .update({
        status: newStatus,
        completed_at: now,
        updated_at: now,
        failure_reason: notes || null
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return res.status(400).json({ success: false, error: updateError.message });
    }

    // Release unpicked parcels
    if (unpickedParcels.length > 0) {
      // Update parcel status based on whether they're in failedParcelIds
      const failedSet = new Set(failedParcelIds);

      for (const parcelId of unpickedParcels) {
        if (failedSet.has(parcelId)) {
          // Mark as PICKUP_FAILED
          await supabase
            .from('parcels_for_pickup')
            .update({
              status: 'pickup_failed',
              assigned_route_plan_id: null,
              last_pickup_attempt: now,
              updated_at: now
            })
            .eq('id', parcelId);

          // Log failure
          await supabase.from('pickup_events').insert({
            route_plan_id: id,
            parcel_id: parcelId,
            event_type: 'parcel_not_picked_up',
            timestamp: now
          });
        } else {
          // Mark as READY_FOR_PICKUP (shouldn't happen, but handle it)
          await supabase
            .from('parcels_for_pickup')
            .update({
              status: 'ready_for_pickup',
              assigned_route_plan_id: null,
              updated_at: now
            })
            .eq('id', parcelId);
        }
      }
    }

    // Get failed parcel details
    const { data: failedDetails } = await supabase
      .from('parcels_for_pickup')
      .select('id, tracking_number, status')
      .in('id', failedParcelIds);

    // Log completion event
    await supabase.from('pickup_events').insert({
      route_plan_id: id,
      event_type: 'pickup_completed',
      timestamp: now,
      notes: `Completed with ${pickedUp}/${assigned} parcels picked (${successRate}%)`
    });

    res.json({
      success: true,
      data: {
        routePlan: {
          id: updated.id,
          status: updated.status,
          assignedParcelIds: assigned,
          actuallyPickedUpParcelIds: pickedUp,
          completedAt: updated.completed_at
        },
        metrics: {
          assigned,
          pickedUp,
          remaining,
          successRate: `${successRate}%`
        },
        remainingParcels: failedDetails || [],
        nextActions: {
          canReplan: remaining > 0,
          message: remaining > 0
            ? `${remaining} parcels remain. Click 'Create Next Route Plan' to continue.`
            : 'All parcels have been picked up!'
        }
      }
    });
  } catch (error) {
    console.error('Error completing route:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// I. GET /api/pickup/route-plans/{id}/remaining-parcels
// Get parcels that were not picked up
// ============================================================================
router.get('/route-plans/:id/remaining-parcels', async (req, res) => {
  try {
    const supabase = getClient();
    const { id } = req.params;

    // Get all parcels for route
    const { data: routeParcels } = await supabase
      .from('route_plan_parcels')
      .select('parcel_id, status')
      .eq('route_plan_id', id);

    const failedParcelIds = routeParcels
      ?.filter(p => p.status !== 'picked_up')
      .map(p => p.parcel_id) || [];

    // Get parcel details
    const { data: parcels } = await supabase
      .from('parcels_for_pickup')
      .select('id, tracking_number, status')
      .in('id', failedParcelIds);

    res.json({
      success: true,
      data: {
        routePlanId: id,
        remaining: failedParcelIds.length,
        parcels: parcels || []
      }
    });
  } catch (error) {
    console.error('Error fetching remaining parcels:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// J. POST /api/pickup/replan
// Create a follow-up route plan for remaining parcels
// ============================================================================
router.post('/replan', async (req, res) => {
  try {
    const supabase = getClient();
    const { previousRoutePlanId, pickupDate, plannedPickupTime } = req.body;

    if (!previousRoutePlanId) {
      return res.status(400).json({ success: false, error: 'previousRoutePlanId is required' });
    }

    // Get previous route plan
    const { data: previousRoute, error: prevError } = await supabase
      .from('route_plans')
      .select('*')
      .eq('id', previousRoutePlanId)
      .single();

    if (prevError || !previousRoute) {
      return res.status(404).json({ success: false, error: 'Previous route plan not found' });
    }

    // Get remaining parcels from previous route
    const { data: failedRouteParcels } = await supabase
      .from('route_plan_parcels')
      .select('parcel_id')
      .eq('route_plan_id', previousRoutePlanId)
      .neq('status', 'picked_up');

    const remainingParcelIds = failedRouteParcels?.map(p => p.parcel_id) || [];

    if (remainingParcelIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No remaining parcels to replan'
      });
    }

    // Create new route plan
    const dateStr = (pickupDate || previousRoute.pickup_date).replace(/-/g, '');
    const routeNumber = `RP-${dateStr}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

    const { data: newRoute, error: createError } = await supabase
      .from('route_plans')
      .insert({
        route_number: routeNumber,
        status: 'planned',
        pickup_date: pickupDate || previousRoute.pickup_date,
        planned_pickup_time: plannedPickupTime || previousRoute.planned_pickup_time,
        warehouse_location_id: previousRoute.warehouse_location_id,
        notes: `Follow-up for Route ${previousRoute.route_number} with ${remainingParcelIds.length} remaining parcels`,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (createError) {
      return res.status(400).json({ success: false, error: createError.message });
    }

    // Assign remaining parcels to new route
    const assignments = remainingParcelIds.map((parcelId, idx) => ({
      route_plan_id: newRoute.id,
      parcel_id: parcelId,
      assignment_order: idx + 1,
      assigned_at: new Date().toISOString(),
      status: 'pending'
    }));

    const { error: assignError } = await supabase
      .from('route_plan_parcels')
      .insert(assignments);

    if (assignError) {
      return res.status(400).json({ success: false, error: assignError.message });
    }

    // Update parcel statuses
    await supabase
      .from('parcels_for_pickup')
      .update({
        status: 'assigned_to_route',
        assigned_route_plan_id: newRoute.id,
        updated_at: new Date().toISOString()
      })
      .in('id', remainingParcelIds);

    // Link the routes
    await supabase
      .from('route_plans')
      .update({ next_route_plan_id: newRoute.id })
      .eq('id', previousRoutePlanId);

    // Log event
    await supabase.from('pickup_events').insert({
      route_plan_id: newRoute.id,
      event_type: 'route_replanned',
      timestamp: new Date().toISOString(),
      notes: `Replanned from ${previousRoute.route_number}`
    });

    res.status(201).json({
      success: true,
      data: {
        newRoutePlan: {
          id: newRoute.id,
          routeNumber: newRoute.route_number,
          status: newRoute.status,
          assignedParcelIds: remainingParcelIds,
          notes: newRoute.notes
        },
        previousRoutePlan: {
          id: previousRoute.id,
          nextRoutePlanId: newRoute.id
        }
      }
    });
  } catch (error) {
    console.error('Error creating replan:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// K. GET /api/pickup/route-plans
// List route plans with optional filtering
// ============================================================================
router.get('/route-plans', async (req, res) => {
  try {
    const supabase = getClient();
    const { status, pickupDate, driverId, limit = 100, offset = 0 } = req.query;

    let query = supabase
      .from('route_plans')
      .select(`
        id,
        route_number,
        status,
        pickup_date,
        assigned_driver_id,
        assigned_vehicle_id
      `);

    if (status) query = query.eq('status', status);
    if (pickupDate) query = query.eq('pickup_date', pickupDate);
    if (driverId) query = query.eq('assigned_driver_id', driverId);

    query = query.range(offset, offset + parseInt(limit) - 1);

    const { data: routePlans, error, count } = await query;

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    // Fetch driver and vehicle details
    const enriched = await Promise.all(
      (routePlans || []).map(async (route) => {
        let driverName = '';
        let vehiclePlate = '';

        if (route.assigned_driver_id) {
          const { data: driver } = await supabase
            .from('drivers')
            .select('name')
            .eq('id', route.assigned_driver_id)
            .single();
          driverName = driver?.name || '';
        }

        if (route.assigned_vehicle_id) {
          const { data: vehicle } = await supabase
            .from('vehicles')
            .select('plate')
            .eq('id', route.assigned_vehicle_id)
            .single();
          vehiclePlate = vehicle?.plate || '';
        }

        // Get parcel counts
        const { data: parcels } = await supabase
          .from('route_plan_parcels')
          .select('status')
          .eq('route_plan_id', route.id);

        const assigned = parcels?.length || 0;
        const pickedUp = parcels?.filter(p => p.status === 'picked_up').length || 0;
        const remaining = assigned - pickedUp;

        return {
          id: route.id,
          routeNumber: route.route_number,
          status: route.status,
          assignedDriverName: driverName,
          assignedVehiclePlate: vehiclePlate,
          metrics: {
            assigned,
            pickedUp,
            remaining,
            successRate: assigned > 0 ? `${Math.round((pickedUp / assigned) * 100)}%` : '0%'
          }
        };
      })
    );

    res.json({
      success: true,
      data: {
        routePlans: enriched,
        total: count || 0
      }
    });
  } catch (error) {
    console.error('Error fetching route plans:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// L. GET /api/pickup/audit-trail/{id}
// Get complete audit trail for a route plan
// ============================================================================
router.get('/audit-trail/:id', async (req, res) => {
  try {
    const supabase = getClient();
    const { id } = req.params;

    const { data: events, error } = await supabase
      .from('pickup_events')
      .select('*')
      .eq('route_plan_id', id)
      .order('timestamp', { ascending: true });

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    res.json({
      success: true,
      data: {
        routePlanId: id,
        events: events || []
      }
    });
  } catch (error) {
    console.error('Error fetching audit trail:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
