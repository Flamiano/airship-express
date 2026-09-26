-- Profile avatars are stored by the authenticated FTM backend only. The
-- bucket is public so staff directories can render an avatar URL, while no
-- browser storage write/update/delete policy is granted.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('ftm-avatars', 'ftm-avatars', true, 716800, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "FTM clients write profile avatars" ON storage.objects;
DROP POLICY IF EXISTS "FTM clients update profile avatars" ON storage.objects;
DROP POLICY IF EXISTS "FTM clients delete profile avatars" ON storage.objects;
