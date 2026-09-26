-- Add destination coordinates to parcels table
ALTER TABLE public.parcels
ADD COLUMN IF NOT EXISTS dest_lat NUMERIC(10, 6),
ADD COLUMN IF NOT EXISTS dest_lng NUMERIC(10, 6);

-- Create index for coordinate-based queries
CREATE INDEX IF NOT EXISTS idx_parcels_dest_coords 
ON public.parcels(dest_lat, dest_lng) 
WHERE dest_lat IS NOT NULL AND dest_lng IS NOT NULL;

COMMENT ON COLUMN public.parcels.dest_lat IS 'Delivery destination latitude';
COMMENT ON COLUMN public.parcels.dest_lng IS 'Delivery destination longitude';
