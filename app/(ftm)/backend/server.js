const path = require('path');
const express = require('express');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const { initSupabase } = require('./config/db');
const { requireFleetUser, requireRoles } = require('./middleware/authMiddleware');

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
// All operational APIs require a verified Supabase session. Health remains public.
app.use('/api', (req, res, next) => {
  if (req.path === '/health' || req.path.startsWith('/health/')) return next();
  if (req.path.startsWith('/geocode/')) return next();
  return requireFleetUser(req, res, next);
});
const fleetOperations = requireRoles('admin', 'fleet_manager', 'dispatcher');
const fleetRead = requireRoles('admin', 'fleet_manager', 'dispatcher', 'driver');
app.use('/api/vehicles', fleetOperations, require('./routes/vehicleRoutes'));
app.use('/api/trips', fleetRead, require('./routes/tripRoutes'));
app.use('/api/bookings', fleetOperations, require('./routes/bookingRoutes'));
app.use('/api/costs', fleetRead, require('./routes/costRoutes'));
app.use('/api/expenses', fleetRead, require('./routes/expenseRoutes'));
app.use('/api/maintenance', fleetOperations, require('./routes/maintenanceRoutes'));
app.use('/api/fuel', fleetRead, require('./routes/fuelRoutes'));
// legacy single-segment endpoint used by older frontend builds
app.get('/api/fuel-logs', (req, res) => res.redirect(301, '/api/fuel/logs'));
app.use('/api/analytics', fleetRead, require('./routes/analyticsRoutes'));
app.use('/api/tracking', fleetRead, require('./routes/trackingRoutes'));
app.use('/api/optimize', fleetOperations, require('./routes/optimizeRoutes'));
app.use('/api/admin', requireRoles('admin'), adminRoutes);
app.use('/api/health', require('./routes/healthRoutes'));
app.use('/api/drivers', fleetRead, require('./routes/driverRoutes'));
// Parcel management and route-plan endpoints
app.use('/api/parcels', fleetOperations, require('./routes/parcelsRoutes'));
app.use('/api/route-plans', fleetOperations, require('./routes/routePlanRoutes'));
app.use('/api/pickup', fleetOperations, require('./routes/pickupRoutes'));
app.use('/events', require('./routes/eventsRoutes'));
app.use('/api/dashboard', fleetRead, require('./routes/dashboardRoutes'));
app.use('/api/fleet-ai', require('./routes/fleetAiRoutes'));
app.use('/api/support', fleetRead, require('./routes/supportRoutes'));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT} on 0.0.0.0`);
});
