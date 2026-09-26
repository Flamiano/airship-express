// Auto-generated minimal TypeScript interfaces to match key database tables
// Keep these in sync with the backend schema (backend/supabase_schema.sql).

export interface User {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  role: 'admin' | 'dispatcher' | 'driver' | 'customer';
  isActive?: boolean;
  createdAt?: string; // ISO timestamp
  updatedAt?: string;
}

export interface Vehicle {
  id: string;
  plateNumber: string;
  vehicleType: string;
  manufacturer?: string;
  model?: string;
  year?: number;
  fuelType?: string;
  capacityKg?: number;
  mileage?: number;
  locationLat?: number;
  locationLng?: number;
  status?: string;
}

export interface Booking {
  id: string;
  customerId?: string;
  pickupLocation: string;
  pickupLatitude?: number;
  pickupLongitude?: number;
  dropoffLocation: string;
  dropoffLatitude?: number;
  dropoffLongitude?: number;
  cargoType?: string;
  cargoWeight?: number;
  priority?: 'Low' | 'Normal' | 'High' | 'Urgent';
  status?: 'Pending' | 'Approved' | 'Dispatched' | 'Completed' | 'Cancelled';
}

export interface Trip {
  id: string;
  bookingId?: string;
  vehicleId?: string;
  driverId?: string;
  status?: string;
  progress?: number;
  estimatedDeparture?: string;
  estimatedArrival?: string;
  actualDeparture?: string;
  actualArrival?: string;
}

export interface CostEntry {
  id: string;
  vehicleId?: string;
  tripId?: string;
  category: 'Fuel' | 'Maintenance' | 'Toll' | 'Salary' | 'Insurance' | 'Other' | 'Driver' | 'Parking' | 'Revenue';
  amount: number;
  entryDate?: string;
  remarks?: string;
}

export interface FuelLog {
  id: string;
  vehicleId: string;
  driverId?: string;
  tripId?: string;
  liters: number;
  cost?: number;
  loggedAt?: string;
}

export default {};
