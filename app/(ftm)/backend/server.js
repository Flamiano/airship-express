const path = require('path');
const express = require('express');
const http = require('http');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env'), override: true });

const { initSupabase } = require('./config/db');
const { requireFleetUser, requireRoles } = require('./middleware/authMiddleware');
const { permissionForMethod } = require('./middleware/permissions');

initSupabase();

const app = express();
const PORT = Number(process.env.PORT || 8001);

const adminRoutes = require('./routes/adminRoutes');

const allowedOrigin = process.env.CORS_ORIGIN || '*';
const allowedOrigins = Array.isArray(allowedOrigin)
  ? allowedOrigin
  : allowedOrigin.split(',').map((origin) => origin.trim()).filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes('*')) {
    res.header('Access-Control-Allow-Origin', '*');
  } else if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.use(express.json({ limit: '20mb' }));


app.get('/', (req, res) => {
  res.send('Simple Fleet API is running');
});

// Public health aliases for local and deployment connectivity checks.
app.get('/health', (req, res) => res.json({ ok: true, service: 'ftm-backend' }));

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/geocode', require('./routes/geocodeRoutes'));
// All operational APIs require a verified Supabase session. Health and auth routes remain public.
app.use('/api', (req, res, next) => {
  if (req.path === '/health' || req.path.startsWith('/health/')) return next();
  if (req.path.startsWith('/geocode/')) return next();
  if (req.path.startsWith('/auth/')) return next();
  return requireFleetUser(req, res, next);
});
const fleetRead = requireRoles('admin', 'fleet_manager', 'dispatcher', 'driver');
app.use('/api/vehicles', permissionForMethod('fvm'), require('./routes/vehicleRoutes'));
app.use('/api/trips', permissionForMethod('operations'), require('./routes/tripRoutes'));
app.use('/api/bookings', permissionForMethod('vrds'), require('./routes/bookingRoutes'));
app.use('/api/costs', permissionForMethod('costAnalysis'), require('./routes/costRoutes'));
app.use('/api/expenses', permissionForMethod('costAnalysis'), require('./routes/expenseRoutes'));
app.use('/api/maintenance', permissionForMethod('fvm'), require('./routes/maintenanceRoutes'));
app.use('/api/fuel', permissionForMethod('fuelManagement'), require('./routes/fuelRoutes'));
// legacy single-segment endpoint used by older frontend builds
app.get('/api/fuel-logs', (req, res) => res.redirect(301, '/api/fuel/logs'));
app.use('/api/analytics', permissionForMethod('operations'), require('./routes/analyticsRoutes'));
app.use('/api/tracking', permissionForMethod('operations'), require('./routes/trackingRoutes'));
app.use('/api/optimize', permissionForMethod('vrds'), require('./routes/optimizeRoutes'));
app.use('/api/admin', requireRoles('admin'), adminRoutes);
app.use('/api/system-backup', requireRoles('admin'), require('./routes/backupRoutes'));
app.use('/api/health', require('./routes/healthRoutes'));
app.use('/api/profile', require('./routes/profileRoutes'));
app.use('/api/drivers', permissionForMethod('driverPerformance'), require('./routes/driverRoutes'));
app.use('/api/hr', fleetRead, require('./routes/hrRoutes'));
// Parcel management and route-plan endpoints
app.use('/api/parcels', permissionForMethod('vrds'), require('./routes/parcelsRoutes'));
app.use('/api/route-plans', permissionForMethod('vrds'), require('./routes/routePlanRoutes'));
app.use('/api/pickup', permissionForMethod('vrds'), require('./routes/pickupRoutes'));
app.use('/events', require('./routes/eventsRoutes'));
app.use('/api/dashboard', permissionForMethod('operations'), require('./routes/dashboardRoutes'));
app.use('/api/fleet-ai', require('./routes/fleetAiRoutes'));
app.use('/api/support', permissionForMethod('operations'), require('./routes/supportRoutes'));
app.use('/api/alerts', require('./routes/alertRoutes'));

http.createServer({ maxHeaderSize: 2 * 1024 * 1024 }, app).listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT} on 0.0.0.0`);
});
