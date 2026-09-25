const express = require('express');
const router = express.Router();
const { getServiceSupabase } = require('../config/db');

const VALID_ROLES = new Set(['admin', 'fleet_manager', 'dispatcher', 'driver', 'customer']);
const hasServiceRoleKey = Boolean(process.env.FTM_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);

router.get('/users', async (req, res) => {
  const supabase = getServiceSupabase();
  if (!supabase) return res.status(503).json({ error: 'Database is not configured' });

  try {
    if (!hasServiceRoleKey) {
      const { data: profiles, error: profileError } = await supabase
        .from('users')
        .select('id, email, full_name, role, phone, created_at, updated_at')
        .order('created_at', { ascending: false });
      if (profileError) return res.status(500).json({ error: profileError.message || 'Failed to fetch user profiles' });
      return res.json((profiles || []).map((profile) => ({
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name || null,
        role: profile.role || null,
        phone: profile.phone || null,
        created_at: profile.created_at || null,
        last_sign_in_at: null,
        locked: false,
        banned_until: null,
      })));
    }

    const { data: authData, error: authError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (authError) return res.status(500).json({ error: authError.message || 'Failed to fetch users' });
    const { data: profiles, error: profileError } = await supabase.from('users').select('id, email, full_name, role, phone, created_at, updated_at');
    if (profileError) return res.status(500).json({ error: profileError.message || 'Failed to fetch user profiles' });

    const profileById = new Map((profiles || []).map((profile) => [profile.id, profile]));
    return res.json((authData?.users || []).map((authUser) => {
      const profile = profileById.get(authUser.id) || {};
      return {
        id: authUser.id,
        email: authUser.email,
        full_name: profile.full_name || authUser.user_metadata?.full_name || null,
        role: profile.role || authUser.app_metadata?.role || authUser.user_metadata?.role || null,
        phone: profile.phone || authUser.user_metadata?.phone || null,
        created_at: profile.created_at || authUser.created_at,
        last_sign_in_at: authUser.last_sign_in_at || null,
        locked: Boolean(authUser.banned_until && new Date(authUser.banned_until).getTime() > Date.now()),
        banned_until: authUser.banned_until || null,
      };
    }));
  } catch (error) {
    console.error('adminRoutes users error:', error?.message || error);
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
