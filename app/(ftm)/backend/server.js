const path = require('path');
const express = require('express');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const { initSupabase } = require('./config/db');

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

// Health check for quick connectivity tests
// NOTE: health route is provided by ./routes/healthRoutes and mounted below

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/vehicles', require('./routes/vehicleRoutes'));
app.use('/api/trips', require('./routes/tripRoutes'));
app.use('/api/bookings', require('./routes/bookingRoutes'));
app.use('/api/costs', require('./routes/costRoutes'));
app.use('/api/maintenance', require('./routes/maintenanceRoutes'));
app.use('/api/fuel', require('./routes/fuelRoutes'));
// legacy single-segment endpoint used by older frontend builds
app.get('/api/fuel-logs', (req, res) => res.redirect(301, '/api/fuel/logs'));
app.use('/api/analytics', require('./routes/analyticsRoutes'));
app.use('/api/tracking', require('./routes/trackingRoutes'));
app.use('/api/optimize', require('./routes/optimizeRoutes'));
app.use('/api/admin', adminRoutes);
app.use('/api/health', require('./routes/healthRoutes'));
app.use('/api/drivers', require('./routes/driverRoutes'));
app.use('/api/geocode', require('./routes/geocodeRoutes'));
// Parcel management and route-plan endpoints
app.use('/api/parcels', require('./routes/parcelsRoutes'));
app.use('/api/route-plans', require('./routes/routePlanRoutes'));
app.use('/events', require('./routes/eventsRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT} on 0.0.0.0`);
});
