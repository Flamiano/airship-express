const { getSupabase } = require('../config/db');
const { normalizeUser } = require('../models/User');

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

  const supabase = getSupabase();
  if (!supabase) return res.status(501).json({ error: 'Auth not configured' });

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.error('Login error:', error.message);
      if (isPermissionError(error)) {
        return res.status(500).json({ error: 'Supabase auth permission denied. Configure Supabase auth and RLS policies.' });
      }
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!data?.user?.id) return res.status(401).json({ error: 'Authentication failed' });

    const { data: userData, error: userError } = await supabase.from('users').select('*').eq('id', data.user.id).maybeSingle();
    if (userError) {
      console.error('Profile fetch error:', userError.message);
      const metadata = data.user.user_metadata || {};
      return res.json({
        user: {
          id: data.user.id,
          email: data.user.email,
          full_name: metadata.full_name || data.user.email?.split('@')[0] || 'Driver',
          phone: metadata.phone || null,
          role: metadata.role || 'driver',
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
