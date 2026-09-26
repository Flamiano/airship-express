const express = require('express');
const router = express.Router();
const { getServiceSupabase } = require('../config/db');

const VALID_ROLES = new Set(['admin', 'fleet_manager', 'dispatcher', 'driver', 'customer']);
const LEGACY_ROLE_ALIASES = {
  manager: 'fleet_manager',
  dispatcher: 'dispatcher',
  'fleet manager': 'fleet_manager',
  'fleet-manager': 'fleet_manager',
  'operations manager': 'fleet_manager',
  'dispatch manager': 'fleet_manager',
  'pickup manager': 'fleet_manager',
  'dispatch': 'dispatcher',
  operations: 'dispatcher',
  pickup: 'dispatcher',
};
const hasServiceRoleKey = Boolean(process.env.FTM_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);

router.get('/users', async (req, res) => {
  const supabase = getServiceSupabase();
  if (!supabase) return res.status(503).json({ error: 'Database is not configured' });

  try {
    if (!hasServiceRoleKey) {
      let { data: profiles, error: profileError } = await supabase
        .from('users')
        .select('id, email, full_name, avatar_url, role, phone, courier_id, created_at, updated_at')
        .order('created_at', { ascending: false });
      if (profileError && /avatar_url.*does not exist|column.*avatar_url/i.test(profileError.message || '')) {
        ({ data: profiles, error: profileError } = await supabase
          .from('users')
          .select('id, email, full_name, role, phone, courier_id, created_at, updated_at')
          .order('created_at', { ascending: false }));
      }
      if (profileError) return res.status(500).json({ error: profileError.message || 'Failed to fetch user profiles' });
      return res.json((profiles || []).map((profile) => ({
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name || null,
        avatar_url: profile.avatar_url || null,
        role: profile.role || null,
        phone: profile.phone || null,
        courier_id: profile.courier_id || null,
        created_at: profile.created_at || null,
        last_sign_in_at: null,
        locked: false,
        banned_until: null,
      })));
    }

    const { data: authData, error: authError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (authError) return res.status(500).json({ error: authError.message || 'Failed to fetch users' });
    let { data: profiles, error: profileError } = await supabase.from('users').select('id, email, full_name, avatar_url, role, phone, courier_id, created_at, updated_at');
    if (profileError && /avatar_url.*does not exist|column.*avatar_url/i.test(profileError.message || '')) {
      ({ data: profiles, error: profileError } = await supabase.from('users').select('id, email, full_name, role, phone, courier_id, created_at, updated_at'));
    }
    if (profileError) return res.status(500).json({ error: profileError.message || 'Failed to fetch user profiles' });

    const profileById = new Map((profiles || []).map((profile) => [profile.id, profile]));
    const passkeyCounts = new Map();
    const listPasskeys = supabase.auth.admin?.listPasskeys;
    await Promise.all((authData?.users || []).map(async (authUser) => {
      if (typeof listPasskeys !== 'function') {
        passkeyCounts.set(authUser.id, null);
        return;
      }
      try {
        const { data: passkeys, error: passkeyError } = await listPasskeys({ userId: authUser.id });
        if (passkeyError) {
          passkeyCounts.set(authUser.id, null);
          return;
        }
        passkeyCounts.set(authUser.id, Array.isArray(passkeys) ? passkeys.length : 0);
      } catch (passkeyError) {
        passkeyCounts.set(authUser.id, null);
      }
    }));

    return res.json((authData?.users || []).map((authUser) => {
      const profile = profileById.get(authUser.id) || {};
      return {
        id: authUser.id,
        email: authUser.email,
        full_name: profile.full_name || authUser.user_metadata?.full_name || null,
        avatar_url: authUser.user_metadata?.avatar_url || profile.avatar_url || null,
        role: profile.role || authUser.app_metadata?.role || authUser.user_metadata?.role || null,
        phone: profile.phone || authUser.user_metadata?.phone || null,
        courier_id: profile.courier_id || null,
        created_at: profile.created_at || authUser.created_at,
        last_sign_in_at: authUser.last_sign_in_at || null,
        locked: Boolean(authUser.banned_until && new Date(authUser.banned_until).getTime() > Date.now()),
        banned_until: authUser.banned_until || null,
        passkey_count: passkeyCounts.get(authUser.id) ?? null,
      };
    }));
  } catch (error) {
    console.error('adminRoutes users error:', error?.message || error);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/users/:id/courier', async (req, res) => {
  const courierId = req.body?.courier_id ? String(req.body.courier_id) : null;
  const supabase = getServiceSupabase();
  if (!supabase) return res.status(503).json({ error: 'Database is not configured' });
  if (!hasServiceRoleKey) return res.status(503).json({ error: 'Courier assignments require FTM_SUPABASE_SERVICE_ROLE_KEY on the backend.' });
  try {
    const { data: user, error: userError } = await supabase.from('users').select('id, role').eq('id', req.params.id).maybeSingle();
    if (userError) return res.status(500).json({ error: userError.message });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role !== 'driver') return res.status(400).json({ error: 'Only driver accounts can be assigned to a courier.' });
    if (courierId) {
      const { data: courier, error: courierError } = await supabase.from('couriers').select('id, name').eq('id', courierId).eq('is_active', true).maybeSingle();
      if (courierError) return res.status(500).json({ error: courierError.message });
      if (!courier) return res.status(400).json({ error: 'Courier not found or inactive.' });
    }
    const { data, error } = await supabase.from('users').update({ courier_id: courierId }).eq('id', req.params.id).select('id, email, full_name, role, courier_id').maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  } catch (error) {
    console.error('adminRoutes courier assignment error:', error?.message || error);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/users/:id/role', async (req, res) => {
  const role = String(req.body?.role || '').trim().toLowerCase();
  if (!VALID_ROLES.has(role)) return res.status(400).json({ error: 'Invalid user role' });
  if (req.params.id === req.fleetUser?.id && role !== 'admin') return res.status(400).json({ error: 'You cannot remove your own admin role.' });

  const supabase = getServiceSupabase();
  if (!supabase) return res.status(503).json({ error: 'Database is not configured' });
  if (!hasServiceRoleKey) return res.status(503).json({ error: 'Admin role changes require FTM_SUPABASE_SERVICE_ROLE_KEY on the backend.' });
  try {
    const { data: existingProfile, error: existingProfileError } = await supabase
      .from('users')
      .select('role')
      .eq('id', req.params.id)
      .maybeSingle();
    if (existingProfileError) return res.status(500).json({ error: existingProfileError.message || 'Failed to read current user role' });

    const { data: updatedAuth, error: authError } = await supabase.auth.admin.updateUserById(req.params.id, { app_metadata: { role } });
    if (authError) return res.status(500).json({ error: authError.message || 'Failed to update auth role' });
    const { data: profile, error: profileError } = await supabase.from('users').update({ role }).eq('id', req.params.id).select('id, email, full_name, role').maybeSingle();
    if (profileError) return res.status(500).json({ error: profileError.message || 'Failed to update profile role' });
    const { error: auditError } = await supabase.from('role_change_audit').insert({
      changed_by: req.fleetUser.id,
      target_user: req.params.id,
      old_role: existingProfile?.role || null,
      new_role: role,
    });
    if (auditError) console.error('adminRoutes role audit error:', auditError.message || auditError);
    return res.json(profile || { id: req.params.id, email: updatedAuth?.user?.email || null, role });
  } catch (error) {
    console.error('adminRoutes role update error:', error?.message || error);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/users/:id/lock', async (req, res) => {
  if (req.params.id === req.fleetUser?.id) return res.status(400).json({ error: 'You cannot lock your own account.' });
  const supabase = getServiceSupabase();
  if (!supabase) return res.status(503).json({ error: 'Database is not configured' });
  if (!hasServiceRoleKey) return res.status(503).json({ error: 'Admin account locking requires FTM_SUPABASE_SERVICE_ROLE_KEY on the backend.' });

  try {
    const { data, error } = await supabase.auth.admin.updateUserById(req.params.id, { ban_duration: '876000h' });
    if (error) return res.status(500).json({ error: error.message || 'Failed to lock account' });
    return res.json({ id: req.params.id, locked: true, locked_until: data?.user?.banned_until || null });
  } catch (error) {
    console.error('adminRoutes lock user error:', error?.message || error);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/users/:id/unlock', async (req, res) => {
  const supabase = getServiceSupabase();
  if (!supabase) return res.status(503).json({ error: 'Database is not configured' });
  if (!hasServiceRoleKey) return res.status(503).json({ error: 'Admin account unlocking requires FTM_SUPABASE_SERVICE_ROLE_KEY on the backend.' });

  try {
    const { data, error } = await supabase.auth.admin.updateUserById(req.params.id, { ban_duration: 'none' });
    if (error) return res.status(500).json({ error: error.message || 'Failed to unlock account' });
    return res.json({ id: req.params.id, locked: false, locked_until: data?.user?.banned_until || null });
  } catch (error) {
    console.error('adminRoutes unlock user error:', error?.message || error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/optimized_routes
router.get('/optimized_routes', async (req, res) => {
  const supabase = getServiceSupabase();
  if (!supabase) return res.status(503).json({ error: 'Database is not configured' });

  try {
    const { data, error } = await supabase.from('optimized_routes').select('id, trip_id, distance_km, estimated_duration_min, generated_by, created_at').order('created_at', { ascending: false }).limit(200);
    if (error) return res.status(500).json({ error: error.message || 'Failed to fetch optimized routes' });
    return res.json(data || []);
  } catch (err) {
    console.error('adminRoutes optimized_routes error:', err?.message || err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/optimized_routes/:id
router.get('/optimized_routes/:id', async (req, res) => {
  const supabase = getServiceSupabase();
  if (!supabase) return res.status(503).json({ error: 'Database is not configured' });
  const id = req.params.id;
  try {
    const { data, error } = await supabase.from('optimized_routes').select('*').eq('id', id).maybeSingle();
    if (error) return res.status(500).json({ error: error.message || 'Failed to fetch optimized route' });
    if (!data) return res.status(404).json({ error: 'Not found' });
    return res.json(data);
  } catch (err) {
    console.error('adminRoutes optimized_routes/:id error:', err?.message || err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
