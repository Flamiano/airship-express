const express = require('express');
const { getServiceSupabase } = require('../config/db');

const router = express.Router();
const BUCKET_NAME = 'ftm-avatars';
const MAX_AVATAR_BYTES = 700 * 1024;
const IMAGE_TYPES = {
  jpeg: { extension: 'jpg', contentType: 'image/jpeg' },
  jpg: { extension: 'jpg', contentType: 'image/jpeg' },
  png: { extension: 'png', contentType: 'image/png' },
  webp: { extension: 'webp', contentType: 'image/webp' },
};

function isImageFile(file, type) {
  if (type === 'jpeg' || type === 'jpg') return file.length > 3 && file[0] === 0xff && file[1] === 0xd8 && file[2] === 0xff;
  if (type === 'png') return file.length > 8 && file.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  return file.length > 12 && file.subarray(0, 4).toString() === 'RIFF' && file.subarray(8, 12).toString() === 'WEBP';
}

async function ensureAvatarBucket(supabase) {
  // Avatars are intentionally readable in staff directories. Clients never
  // receive direct write credentials: the authenticated API owns all writes.
  const { data: existingBucket, error: lookupError } = await supabase.storage.getBucket(BUCKET_NAME);
  if (!lookupError && existingBucket) return;

  const { error } = await supabase.storage.createBucket(BUCKET_NAME, {
    public: true,
    fileSizeLimit: String(MAX_AVATAR_BYTES),
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  });
  if (error && !/already exists|duplicate/i.test(error.message || '')) throw error;
}

function publicAvatarUrl(supabase, path) {
  const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path);
  return data?.publicUrl ? `${data.publicUrl}?v=${Date.now()}` : null;
}

async function migrateLegacyAvatar(supabase, userId, value) {
  if (!/^data:image\/(jpeg|jpg|png|webp);base64,/.test(String(value || ''))) return value || null;
  const match = String(value).match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/);
  const image = IMAGE_TYPES[match[1]];
  const file = Buffer.from(match[2], 'base64');
  if (!file.length || file.length > MAX_AVATAR_BYTES || !isImageFile(file, match[1])) return null;
  try { await ensureAvatarBucket(supabase); } catch { return null; }
  const path = `${userId}/avatar.${image.extension}`;
  const { error: uploadError } = await supabase.storage.from(BUCKET_NAME).upload(path, file, { contentType: image.contentType, upsert: true });
  if (uploadError) return null;
  const avatarUrl = publicAvatarUrl(supabase, path);
  if (!avatarUrl) return null;
  await supabase.auth.admin.updateUserById(userId, { data: { avatar_url: avatarUrl } });
  await supabase.from('users').update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() }).eq('id', userId);
  return avatarUrl;
}

router.get('/', async (req, res) => {
  const user = req.fleetUser;
  if (!user) return res.status(401).json({ error: 'Authenticated user not found' });

  const supabase = getServiceSupabase();
  if (!supabase) return res.status(503).json({ error: 'Supabase service role is not configured' });
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('avatar_url, full_name, email')
    .eq('id', user.id)
    .maybeSingle();
  const legacyOrStoredAvatar = profileError ? user.user_metadata?.avatar_url || null : profile?.avatar_url || null;
  const avatarUrl = await migrateLegacyAvatar(supabase, user.id, legacyOrStoredAvatar);

  return res.json({
    id: user.id,
    email: user.email || profile?.email || null,
    full_name: user.user_metadata?.full_name || profile?.full_name || null,
    avatar_url: avatarUrl,
  });
});

router.post('/avatar', async (req, res) => {
  const user = req.fleetUser;
  const supabase = getServiceSupabase();
  const content = String(req.body?.content || '');
  if (!user) return res.status(401).json({ error: 'Authenticated user not found' });
  if (!supabase) return res.status(503).json({ error: 'Supabase service role is not configured' });
  if (!/^data:image\/(jpeg|jpg|png|webp);base64,/.test(content)) return res.status(400).json({ error: 'A supported image is required' });

  const match = content.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/);
  const image = IMAGE_TYPES[match[1]];
  const file = Buffer.from(match[2], 'base64');
  if (!file.length || file.length > MAX_AVATAR_BYTES) return res.status(413).json({ error: 'Avatar image is too large after compression' });
  if (!isImageFile(file, match[1])) return res.status(400).json({ error: 'The uploaded file does not match a supported image format' });

  try {
    await ensureAvatarBucket(supabase);
  } catch (bucketError) {
    return res.status(503).json({ error: `Unable to initialize avatar storage: ${bucketError.message}` });
  }

  const path = `${user.id}/avatar.${image.extension}`;
  const { error: uploadError } = await supabase.storage.from(BUCKET_NAME).upload(path, file, {
    contentType: image.contentType,
    upsert: true,
  });
  if (uploadError) return res.status(500).json({ error: uploadError.message || 'Unable to upload avatar' });

  const avatarUrl = publicAvatarUrl(supabase, path);
  if (!avatarUrl) return res.status(500).json({ error: 'Unable to create an avatar URL' });
  const { error: profileError } = await supabase.from('users').update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() }).eq('id', user.id);
  if (profileError) return res.status(500).json({ error: profileError.message || 'Unable to save avatar profile data' });
  const { error: authError } = await supabase.auth.admin.updateUserById(user.id, { data: { avatar_url: avatarUrl } });
  if (authError) console.warn('Avatar saved to profile but not Auth metadata:', authError.message || authError);
  // The web client always produces JPEG, but clean up files from older clients.
  await supabase.storage.from(BUCKET_NAME).remove([
    `${user.id}/avatar.png`,
    `${user.id}/avatar.webp`,
  ]);

  return res.json({ avatar_url: avatarUrl });
});

router.delete('/avatar', async (req, res) => {
  const user = req.fleetUser;
  const supabase = getServiceSupabase();
  if (!user) return res.status(401).json({ error: 'Authenticated user not found' });
  if (!supabase) return res.status(503).json({ error: 'Supabase service role is not configured' });
  const { error: profileError } = await supabase.from('users').update({ avatar_url: null, updated_at: new Date().toISOString() }).eq('id', user.id);
  if (profileError) return res.status(500).json({ error: profileError.message || 'Unable to remove avatar' });
  const { error } = await supabase.auth.admin.updateUserById(user.id, { data: { avatar_url: null } });
  if (error) console.warn('Avatar removed from profile but not Auth metadata:', error.message || error);
  await supabase.storage.from(BUCKET_NAME).remove([
    `${user.id}/avatar.jpg`,
    `${user.id}/avatar.png`,
    `${user.id}/avatar.webp`,
  ]);
  return res.json({ avatar_url: null });
});

module.exports = router;
