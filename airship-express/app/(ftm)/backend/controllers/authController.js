const { getSupabase, getServiceSupabase } = require('../config/db');
const { normalizeUser } = require('../models/User');
const failedLogins = new Map();
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

function isPermissionError(error) {
  const message = (error?.message || error || '').toString().toLowerCase();
  return message.includes('permission denied') || message.includes('not authorized') || message.includes('rls') || message.includes('jwt');
}

function healthCheck(req, res) {
  res.json({ message: 'Auth route ready for Supabase Auth integration' });
}

function profileFromAuthUser(authUser) {
  const metadata = authUser.user_metadata || {};
  return {
    id: authUser.id,
    email: authUser.email,
    full_name: metadata.full_name || authUser.email?.split('@')[0] || 'Driver',
    phone: metadata.phone || null,
    role: metadata.role || 'driver',
    vehicle_id: null,
  };
}

async function persistAccountLock(email) {
  const supabase = getServiceSupabase();
  if (!supabase) return { persisted: false };

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('id')
    .ilike('email', email)
    .maybeSingle();

  let userId = profile?.id;
  if (profileError) console.error('Account lock profile lookup error:', profileError.message);
  if (!userId) {
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (authError) {
      console.error('Account lock auth-user lookup error:', authError.message);
      return { persisted: false };
    }
    userId = authData?.users?.find((user) => user.email?.toLowerCase() === email)?.id;
  }
  if (!userId) return { persisted: false };

  const { data, error } = await supabase.auth.admin.updateUserById(userId, { ban_duration: `${LOCKOUT_MS / 1000}s` });
  if (error) {
    console.error('Account lock persistence error:', error.message);
    return { persisted: false };
  }

  return { persisted: true, bannedUntil: data?.user?.banned_until || null };
}

async function restoreDriverProfile(supabase, authUser) {
  const profile = profileFromAuthUser(authUser);
  const { data, error } = await supabase
    .from('users')
    .upsert([profile], { onConflict: 'id' })
    .select('*')
    .maybeSingle();

  return { data, error, profile };
}

async function registerDriver(req, res) {
  const { email, password, full_name, phone } = req.body;

  if (!email || !password || !full_name) {
    return res.status(400).json({ error: 'Email, password, and full name are required' });
  }

  const supabase = getSupabase();
  if (!supabase) return res.status(501).json({ error: 'Auth not configured' });

  try {
    const userMetadata = { full_name, phone, role: 'driver' };
    const isProduction = process.env.NODE_ENV === 'production';
    const { data: authData, error: authError } = isProduction
      ? await supabase.auth.signUp({ email, password, options: { data: userMetadata } })
      : await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: userMetadata,
        });

    if (authError) {
      console.error('Auth signup error:', authError.message);
      if (isPermissionError(authError)) {
        return res.status(500).json({ error: 'Supabase auth permission denied. Configure Supabase auth and RLS policies.' });
      }
      return res.status(400).json({ error: authError.message });
    }

    if (!authData?.user?.id) {
      return res.status(500).json({ error: 'Account creation did not return a user' });
    }

    const { data: userData, error: userError } = await restoreDriverProfile(supabase, authData.user);

    if (userError) {
      console.error('User profile creation error:', userError.message);
      return res.status(201).json({
        user: {
          id: authData.user.id,
          email: authData.user.email || email,
          full_name,
          phone: phone || null,
          role: 'driver',
          vehicle_id: null,
        },
        profilePending: true,
        message: 'Driver account created. Your dispatcher can complete the profile assignment.',
      });
    }

    return res.status(201).json({
      user: normalizeUser(userData),
      message: isProduction ? 'Driver registered successfully. Check your email for confirmation.' : 'Driver account created and confirmed for local testing.',
    });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ error: 'Registration failed' });
  }
}

async function loginDriver(req, res) {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  const loginKey = String(email).trim().toLowerCase();
  const lock = failedLogins.get(loginKey);
  if (lock?.lockedUntil > Date.now()) {
    return res.status(423).json({ error: 'Account temporarily locked after repeated failed login attempts.', retryAfterSeconds: Math.ceil((lock.lockedUntil - Date.now()) / 1000) });
  }

  const supabase = getSupabase();
  if (!supabase) return res.status(501).json({ error: 'Auth not configured' });

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.error('Login error:', error.message);
      if (isPermissionError(error)) {
        return res.status(500).json({ error: 'Supabase auth permission denied. Configure Supabase auth and RLS policies.' });
      }
      const next = { attempts: (lock?.attempts || 0) + 1, lockedUntil: 0 };
      if (next.attempts >= MAX_FAILED_ATTEMPTS) {
        next.lockedUntil = Date.now() + LOCKOUT_MS;
        await persistAccountLock(loginKey);
      }
      failedLogins.set(loginKey, next);
      return res.status(next.lockedUntil ? 423 : 401).json({ error: next.lockedUntil ? 'Account temporarily locked after 5 failed login attempts.' : 'Invalid email or password' });
    }

    failedLogins.delete(loginKey);

    if (!data?.user?.id) return res.status(401).json({ error: 'Authentication failed' });

    let { data: userData, error: userError } = await supabase.from('users').select('*').eq('id', data.user.id).maybeSingle();
    if (!userError && !userData && data.user.email) {
      const byEmail = await supabase.from('users').select('*').ilike('email', data.user.email).maybeSingle();
      userData = byEmail.data;
      userError = byEmail.error;
    }
    if (userError) {
      console.error('Profile fetch error:', userError.message);
      const metadata = data.user.user_metadata || {};
      return res.json({
        user: {
          id: data.user.id,
          email: data.user.email,
          full_name: metadata.full_name || data.user.email?.split('@')[0] || 'Driver',
          phone: metadata.phone || null,
          role: metadata.role || null,
          vehicle_id: null,
        },
        session: data.session,
        profilePending: true,
        message: 'Login successful. Your dispatcher can complete the driver profile assignment.',
      });
    }

    if (!userData) {
      const restoredProfile = await restoreDriverProfile(supabase, data.user);
      if (restoredProfile.data) {
        return res.json({
          user: normalizeUser(restoredProfile.data),
          session: data.session,
          message: 'Login successful',
        });
      }

      if (restoredProfile.error) {
        console.error('Profile restore error:', restoredProfile.error.message);
      }

      return res.json({
        user: restoredProfile.profile,
        session: data.session,
        profilePending: true,
        message: 'Login successful. Your driver profile is being synchronized.',
      });
    }
    return res.json({ user: normalizeUser(userData), session: data.session, message: 'Login successful' });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Login failed' });
  }
}


async function getDriverProfile(req, res) {
  const driverId = req.params.driverId;
  const supabase = getSupabase();
  if (!supabase) return res.status(501).json({ error: 'Auth not configured' });

  const { data, error } = await supabase.from('users').select('*').eq('id', driverId).maybeSingle();
  if (error) {
    console.error('Profile fetch error:', error.message);
    return res.status(500).json({ error: 'Failed to fetch driver profile' });
  }
  if (!data) {
    const { data: authData, error: authError } = await supabase.auth.admin.getUserById(driverId);
    if (authError || !authData?.user) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    const restoredProfile = await restoreDriverProfile(supabase, authData.user);
    if (restoredProfile.data) return res.json(normalizeUser(restoredProfile.data));

    if (restoredProfile.error) {
      console.error('Profile restore error:', restoredProfile.error.message);
    }
    return res.json({ ...restoredProfile.profile, profilePending: true });
  }
  return res.json(normalizeUser(data));
}

module.exports = { healthCheck, registerDriver, loginDriver, getDriverProfile };
