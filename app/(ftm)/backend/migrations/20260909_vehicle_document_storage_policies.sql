BEGIN;

DROP POLICY IF EXISTS "Vehicle managers upload vehicle documents" ON storage.objects;
CREATE POLICY "Vehicle managers upload vehicle documents" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'vehicle-documents');

DROP POLICY IF EXISTS "Vehicle managers read vehicle documents" ON storage.objects;
CREATE POLICY "Vehicle managers read vehicle documents" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'vehicle-documents');

DROP POLICY IF EXISTS "Vehicle managers update vehicle documents" ON storage.objects;
CREATE POLICY "Vehicle managers update vehicle documents" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'vehicle-documents')
  WITH CHECK (bucket_id = 'vehicle-documents');

DROP POLICY IF EXISTS "Vehicle managers delete vehicle documents" ON storage.objects;
CREATE POLICY "Vehicle managers delete vehicle documents" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'vehicle-documents');

COMMIT;
