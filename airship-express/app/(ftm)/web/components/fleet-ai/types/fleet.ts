export interface FleetVehicle {
  id: string;
  plate_number?: string;
  vehicle_type?: string;
  manufacturer?: string;
  model?: string;
  status?: string;
  availability?: string;
  location?: string;
  driver?: string;
  mileage?: number;
  next_service?: string;
}

export interface FleetTrip {
  id: string;
  status?: string;
  progress?: number;
  driver_id?: string;
  driver_name?: string;
  vehicle_id?: string;
  vehicle_plate?: string;
  estimated_departure?: string;
  estimated_arrival?: string;
  delay_reason?: string;
}

export interface FleetDriver {
  id: string;
  full_name?: string;
  phone?: string;
  role?: string;
}

export interface FleetSummary {
  vehicles: { total: number; available: number; inMaintenance: number; assignedOrInUse: number };
  trips: { total: number; inTransit: number; completed: number };
  drivers: { total: number | null };
}

export interface FuelSummary {
  periodDays: number;
  entryCount: number;
  totalLiters: number;
  totalCost: number;
  recentEntries: Array<{ vehicle_id: string; liters: number; cost: number; logged_at: string }>;
}
