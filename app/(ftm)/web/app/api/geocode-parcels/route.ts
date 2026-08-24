import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Geocoding helper that maps Manila Metro cities to coordinates
const CITY_COORDINATES: Record<string, { lat: number; lng: number }> = {
  'Caloocan': { lat: 14.675, lng: 121.01 },
  'Quezon City': { lat: 14.63, lng: 121.045 },
  'Manila': { lat: 14.59, lng: 120.99 },
  'Makati': { lat: 14.54, lng: 121.03 },
  'Pasig': { lat: 14.57, lng: 121.075 },
  'Mandaluyong': { lat: 14.575, lng: 121.04 },
  'San Juan': { lat: 14.605, lng: 121.035 },
  'Marikina': { lat: 14.65, lng: 121.1 },
  'Pasay': { lat: 14.525, lng: 120.995 },
  'Taguig': { lat: 14.525, lng: 121.055 },
  'Parañaque': { lat: 14.485, lng: 121.015 },
  'Valenzuela': { lat: 14.705, lng: 120.99 },
};

function geocodeAddress(address: string): { lat: number; lng: number } | null {
  const haystack = (address || "").toLowerCase();
  
  // Find a known city in the address
  for (const [city, coords] of Object.entries(CITY_COORDINATES)) {
    if (haystack.includes(city.toLowerCase())) {
      // Add slight random variation for visual distinction
      const latVar = (Math.random() - 0.5) * 0.01;
      const lngVar = (Math.random() - 0.5) * 0.01;
      return {
        lat: Number((coords.lat + latVar).toFixed(6)),
        lng: Number((coords.lng + lngVar).toFixed(6))
      };
    }
  }
  
  // Default to Manila area
  const latVar = (Math.random() - 0.5) * 0.01;
  const lngVar = (Math.random() - 0.5) * 0.01;
  return {
    lat: Number((14.59 + latVar).toFixed(6)),
    lng: Number((120.99 + lngVar).toFixed(6))
  };
}

export async function POST(req: NextRequest) {
  try {
    const { action } = await req.json();

    if (action === "geocode-all") {
      // Get all parcels and geocode their destinations
      const supabaseUrl = process.env.PARCELS_SUPABASE_URL || process.env.SUPABASE_URL;
      const supabaseKey = process.env.PARCELS_SUPABASE_SERVICE_ROLE_KEY || 
                          process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseKey) {
        return NextResponse.json(
          { error: "Supabase credentials not configured" },
          { status: 500 }
        );
      }

      const supabase = createClient(supabaseUrl, supabaseKey);

      // Fetch all parcels
      const { data: parcels, error: fetchError } = await supabase
        .from("parcels")
        .select("id, tracking_number, destination");

      if (fetchError) {
        return NextResponse.json(
          { error: `Failed to fetch parcels: ${fetchError.message}` },
          { status: 500 }
        );
      }

      if (!parcels || parcels.length === 0) {
        return NextResponse.json({ updated: 0, skipped: 0, errors: [] });
      }

      // Store geocoding results in memory (won't persist but will be used for this session)
      // For persistence, you'd need to add dest_lat/dest_lng columns to the parcels table
      const geocodedParcels = parcels.map((parcel: any) => ({
        id: parcel.id,
        tracking_number: parcel.tracking_number,
        destination: parcel.destination,
        coordinates: geocodeAddress(parcel.destination)
      }));

      return NextResponse.json({
        success: true,
        total: geocodedParcels.length,
        parcels: geocodedParcels
      });
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("[geocode-parcels] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
