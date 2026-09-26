const nodemailer = require('nodemailer');
const { getSupabase, getServiceSupabase } = require('../config/db');
const { normalizeUser } = require('../models/User');
const failedLogins = new Map();
const otpStore = new Map();
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const OTP_LIFETIME_OPTIONS = new Set([60, 120, 240, 300, 600]);
const DEFAULT_OTP_LIFETIME_SECONDS = 60;
const MAX_OTP_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_SECONDS = 30;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getValidatedUpdatedByUserId(fleetUser) {
  const candidate = typeof fleetUser?.id === 'string' ? fleetUser.id.trim() : '';
  return candidate && UUID_RE.test(candidate) ? candidate : null;
}

async function getOtpLifetimeSeconds() {
  const supabase = getServiceSupabase();
  if (!supabase) return DEFAULT_OTP_LIFETIME_SECONDS;

  try {
    const { data, error } = await supabase
      .from('ftm_security_settings')
      .select('otp_lifetime_seconds')
      .eq('id', true)
      .maybeSingle();

    if (error) {
      console.warn('OTP lifetime lookup failed, using default:', error.message || error);
      return DEFAULT_OTP_LIFETIME_SECONDS;
    }

    const parsed = Number(data?.otp_lifetime_seconds);
    return OTP_LIFETIME_OPTIONS.has(parsed) ? parsed : DEFAULT_OTP_LIFETIME_SECONDS;
  } catch (error) {
    console.warn('OTP lifetime lookup threw an error, using default:', error?.message || error);
    return DEFAULT_OTP_LIFETIME_SECONDS;
  }
}

function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function getSmtpConfig() {
  return {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
  };
}

async function sendOtpEmail(email, code, lifetimeSeconds) {
  const config = getSmtpConfig();
  if (!config.host || !config.user || !config.pass) {
    throw new Error('SMTP email is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and optionally SMTP_FROM.');
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  await transporter.sendMail({
    from: config.from,
    to: email,
    subject: 'Airship Express MFA verification code',
    text: `Your Airship Express verification code is ${code}. It expires in ${Math.ceil(lifetimeSeconds / 60)} minute${lifetimeSeconds >= 120 ? 's' : ''}.`,
    html: `
      <div style="font-family: Arial, sans-serif; background: #0f172a; color: #f8fafc; padding: 24px; border-radius: 12px;">
        <h2 style="margin: 0 0 12px; color: #f472b6;">Airship Express MFA</h2>
        <p style="margin: 0 0 18px; color: #e2e8f0;">Use the code below to complete your verification.</p>
        <div style="display: inline-block; background: #111827; border: 1px solid #374151; border-radius: 8px; padding: 18px 20px; font-size: 28px; font-weight: 700; letter-spacing: 6px; color: #ffffff;">
          ${code}
        </div>
        <p style="margin-top: 18px; color: #cbd5e1;">This code expires in ${Math.ceil(lifetimeSeconds / 60)} minute${lifetimeSeconds >= 120 ? 's' : ''}.</p>
      </div>
    `,
  });
}

async function requestMfaOtp(req, res) {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  const existing = otpStore.get(email);
  const now = Date.now();
  if (existing?.lastSentAt && now - existing.lastSentAt < OTP_RESEND_COOLDOWN_SECONDS * 1000) {
    return res.status(429).json({ error: 'Please wait before requesting another verification code.', retryAfterSeconds: Math.ceil((OTP_RESEND_COOLDOWN_SECONDS * 1000 - (now - existing.lastSentAt)) / 1000) });
  }
  const lifetimeSeconds = await getOtpLifetimeSeconds();
  const code = generateOtpCode();
  const expiresAt = now + lifetimeSeconds * 1000;
  otpStore.set(email, { code, expiresAt, attempts: 0, lastSentAt: now });

  try {
    await sendOtpEmail(email, code, lifetimeSeconds);
    return res.json({ sent: true, message: 'A 6-digit verification code was sent to your email.', expiresAt, expiresInSeconds: lifetimeSeconds, resendAvailableAt: now + OTP_RESEND_COOLDOWN_SECONDS * 1000 });
  } catch (error) {
    otpStore.delete(email);
    console.error('SMTP OTP send error:', error);
    return res.status(500).json({
      error: 'Unable to send the verification email. Please check your SMTP configuration.',
    });
  }
}

function verifyMfaOtp(req, res) {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const code = String(req.body?.code || '').replace(/\D/g, '');

  if (!email || !code) {
    return res.status(400).json({ error: 'Email and OTP code are required.' });
  }

  const record = otpStore.get(email);
  if (!record) {
    return res.status(401).json({ error: 'No active OTP was found for this email.' });
  }

  if (Date.now() > record.expiresAt) {
    otpStore.delete(email);
    return res.status(410).json({ error: 'The verification code has expired. Please request a new one.' });
  }

  if (record.code !== code) {
    record.attempts = Number(record.attempts || 0) + 1;
    if (record.attempts >= MAX_OTP_ATTEMPTS) {
      otpStore.delete(email);
      return res.status(429).json({ error: 'Too many incorrect codes. Request a new verification code and try again.', attemptsRemaining: 0 });
    }
    otpStore.set(email, record);
    return res.status(401).json({ error: 'The verification code is invalid.', attemptsRemaining: MAX_OTP_ATTEMPTS - record.attempts });
  }

  otpStore.delete(email);
  return res.json({ verified: true, message: 'Verification successful.' });
}

async function updateOtpPolicy(req, res) {
  const lifetimeSeconds = Number(req.body?.otpLifetimeSeconds);
  if (!OTP_LIFETIME_OPTIONS.has(lifetimeSeconds)) {
    return res.status(400).json({ error: 'OTP expiration must be 1, 2, 4, 5, or 10 minutes.' });
  }

  const supabase = getServiceSupabase();
  if (!supabase) return res.status(503).json({ error: 'Supabase service role is not configured.' });

  try {
    const updatedByUserId = getValidatedUpdatedByUserId(req.fleetUser);
    const payload = {
      id: true,
      otp_lifetime_seconds: lifetimeSeconds,
      updated_at: new Date().toISOString(),
    };

    if (updatedByUserId) {
      payload.updated_by = updatedByUserId;
    }

    let { error } = await supabase.from('ftm_security_settings').upsert(payload, { onConflict: 'id' });

    if (error && /updated_by|foreign key|schema cache|column .* does not exist/i.test(String(error.message || error))) {
      ({ error } = await supabase.from('ftm_security_settings').upsert({
        id: true,
        otp_lifetime_seconds: lifetimeSeconds,
        updated_at: payload.updated_at,
      }, { onConflict: 'id' }));
    }

    if (error) {
      console.error('OTP policy persistence error:', error.message || error);
      return res.status(500).json({ error: 'Unable to save the OTP expiration policy.', details: error.message || String(error) });
    }

    return res.json({ otpLifetimeSeconds: lifetimeSeconds });
  } catch (error) {
    console.error('OTP policy update threw an error:', error?.message || error);
    return res.status(500).json({ error: 'Unable to save the OTP expiration policy.' });
  }
}

async function getOtpPolicy(req, res) {
  const supabase = getServiceSupabase();
  if (!supabase) {
    return res.json({ otpLifetimeSeconds: DEFAULT_OTP_LIFETIME_SECONDS });
  }

  try {
    const { data, error } = await supabase
      .from('ftm_security_settings')
      .select('otp_lifetime_seconds')
      .eq('id', true)
      .maybeSingle();

    if (error) {
      console.warn('OTP policy fetch failed:', error.message || error);
      return res.json({ otpLifetimeSeconds: DEFAULT_OTP_LIFETIME_SECONDS });
    }

    const otpLifetimeSeconds = Number(data?.otp_lifetime_seconds);
    return res.json({
      otpLifetimeSeconds: OTP_LIFETIME_OPTIONS.has(otpLifetimeSeconds) ? otpLifetimeSeconds : DEFAULT_OTP_LIFETIME_SECONDS,
    });
  } catch (error) {
    console.warn('OTP policy fetch threw an error:', error?.message || error);
    return res.json({ otpLifetimeSeconds: DEFAULT_OTP_LIFETIME_SECONDS });
  }
}

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
    courier_id: metadata.courier_id || null,
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
  const { email, password, full_name, phone, courier_id } = req.body;

  if (!email || !password || !full_name || !courier_id) {
    return res.status(400).json({ error: 'Email, password, full name, and courier_id are required' });
  }

  const supabase = getSupabase();
  if (!supabase) return res.status(501).json({ error: 'Auth not configured' });

  try {
    const { data: courier, error: courierError } = await supabase
      .from('couriers')
      .select('id')
      .eq('id', courier_id)
      .eq('is_active', true)
      .maybeSingle();
    if (courierError || !courier) return res.status(400).json({ error: 'courier_id must reference an active registered courier.' });

    const userMetadata = { full_name, phone, role: 'driver', courier_id };
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
      if (error.code === 'email_not_confirmed' || /email not confirmed|confirm your email/i.test(error.message || '')) {
        return res.status(403).json({ error: 'Please verify your email before signing in.', code: 'email_not_confirmed' });
      }
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
    if (!data.user.email_confirmed_at) {
      return res.status(403).json({ error: 'Please verify your email before signing in.', code: 'email_not_confirmed' });
    }

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

module.exports = {
  healthCheck,
  registerDriver,
  loginDriver,
  getDriverProfile,
  requestMfaOtp,
  verifyMfaOtp,
  updateOtpPolicy,
  getOtpPolicy,
};
