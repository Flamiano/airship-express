BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vehicles'
      AND column_name = 'plate'
  ) THEN
    UPDATE public.vehicles
    SET plate_number = plate
    WHERE (plate_number IS NULL OR btrim(plate_number) = '')
      AND plate IS NOT NULL;

    ALTER TABLE public.vehicles
      DROP COLUMN plate;
  END IF;
END $$;

COMMIT;
