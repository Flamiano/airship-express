const { getServiceSupabase } = require('../config/db');

// Mirrors web/web/lib/roleAccess.ts so the backend and frontend agree on
// what a role string means. Kept as a small, local copy rather than a
// shared package to avoid coupling the Express backend to the Next app.
const ROLE_ALIASES = {
  fleet_manager: 'fleet_manager',
  'fleet manager': 'fleet_manager',
  'fleet-manager': 'fleet_manager',
  'operations manager': 'fleet_manager',
  'ops manager': 'fleet_manager',
  'dispatch manager': 'fleet_manager',
  'pickup manager': 'fleet_manager',
  manager: 'fleet_manager',
  administrator: 'admin',
  admin: 'admin',
  super_admin: 'admin',
  'super-admin': 'admin',
  dispatcher: 'dispatcher',
  dispatch: 'dispatcher',
  'dispatch officer': 'dispatcher',
  operations: 'dispatcher',
  'operations manager': 'fleet_manager',
  'ops': 'dispatcher',
  'pickup coordinator': 'dispatcher',
  driver: 'driver',
  customer: 'customer',
};

function normalizeRole(value) {
  if (!value) return null;

  const normalized = String(value).trim().toLowerCase().replace(/[^a-z_\-\s]/g, '');
  const directMatch = ROLE_ALIASES[normalized] || ROLE_ALIASES[normalized.replace(/\s+/g, '_')];
  if (directMatch) return directMatch;

  if (/(fleet|operations|dispatch|pickup|route).*(manager|supervisor|lead)/.test(normalized)) {
    return 'fleet_manager';
  }
  if (/(dispatch|operations|pickup|route)/.test(normalized)) {
    return 'dispatcher';
  }
  if (/(driver|delivery)/.test(normalized)) {
    return 'driver';
  }
  if (/(customer|client)/.test(normalized)) {
    return 'customer';
  }

  return null;
}

// Roles allowed to use the Fleet AI assistant at all. Customers and
// unauthenticated visitors are excluded per the FTM access model.
const FLEET_AI_ROLES = new Set(['admin', 'fleet_manager', 'dispatcher', 'driver']);

function requireRoles(...allowedRoles) {
  const allowed = new Set(allowedRoles.flat().map(normalizeRole).filter(Boolean));
  return (req, res, next) => {
    if (!req.fleetUser || !allowed.has(req.fleetUser.role)) {
      return res.status(403).json({ error: 'You do not have permission to perform this action.' });
    }
    return next();
  };
}

/**
 * Verifies the bearer token against Supabase Auth and attaches
 * `req.fleetUser = { id, email, role }`. Never trusts a client-supplied
 * role/user id - it always re-derives them from the verified session.
 */
async function requireFleetUser(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;

    if (!token) {
      return res.status(401).json({ error: 'Missing Authorization bearer token. Sign in and try again.' });
    }

    const supabase = getServiceSupabase();
    if (!supabase) return res.status(503).json({ error: 'Database is not configured' });

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
    }

    const authUser = data.user;
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', authUser.id)
      .maybeSingle();
    const role = [profile?.role, authUser.app_metadata?.role, authUser.user_metadata?.role]
      .map(normalizeRole)
      .find((candidate) => candidate && FLEET_AI_ROLES.has(candidate)) || null;

    if (!role || !FLEET_AI_ROLES.has(role)) {
      return res.status(403).json({ error: 'Fleet operations are only available to fleet staff accounts.' });
    }

    req.fleetUser = {
      id: authUser.id,
      email: authUser.email,
      role,
      user_metadata: authUser.user_metadata || {},
    };

    return next();
  } catch (err) {
    const message = String(err?.message || err || '').toLowerCase();
    const isAuthFailure = /jwt|token|expired|invalid|unauthorized|missing authorization|authentication/i.test(message);

    if (isAuthFailure) {
      return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
    }

    console.error('Fleet AI auth middleware error:', err?.message || err);
    return res.status(500).json({ error: 'Authentication check failed' });
  }
}

module.exports = { requireFleetUser, requireRoles, normalizeRole, FLEET_AI_ROLES };
