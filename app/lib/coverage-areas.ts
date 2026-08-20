export interface CoverageArea {
  name: string;
  lat: number;
  lng: number;
  color: string;
}

// Airship Express HQ — 352 Escolta St., Tomas Pinpin, Binondo, Manila
export const HQ = { lat: 14.6017, lng: 120.9721 };

export const coverageAreas: CoverageArea[] = [
  { name: "Caloocan", lat: 14.6488, lng: 120.9673, color: "#F59E0B" },
  { name: "Quezon City", lat: 14.676, lng: 121.0437, color: "#3B82F6" },
  { name: "Manila", lat: 14.5995, lng: 120.9842, color: "#E5167E" },
  { name: "Makati", lat: 14.5547, lng: 121.0244, color: "#10B981" },
  { name: "Pasig", lat: 14.5764, lng: 121.0851, color: "#8B5CF6" },
  { name: "Mandaluyong", lat: 14.5794, lng: 121.0359, color: "#F97316" },
  { name: "San Juan", lat: 14.6019, lng: 121.0355, color: "#06B6D4" },
  { name: "Marikina", lat: 14.6507, lng: 121.1029, color: "#84CC16" },
  { name: "Pasay", lat: 14.5378, lng: 121.0014, color: "#D946EF" },
  { name: "Taguig", lat: 14.5176, lng: 121.0509, color: "#14B8A6" },
  { name: "Valenzuela", lat: 14.7011, lng: 120.983, color: "#F43F5E" },
  { name: "Malabon", lat: 14.6681, lng: 120.9567, color: "#6366F1" },
];
