const express = require('express');
const router = express.Router();
const { listAlerts, transitionAlert, listHistory } = require('../services/alertService');
const { requireRoles } = require('../middleware/authMiddleware');

const staff = requireRoles('admin', 'fleet_manager', 'dispatcher', 'driver');
const canHandle = requireRoles('admin', 'fleet_manager', 'dispatcher');
const accessToken = (req) => (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();

router.get('/', staff, async (req, res) => {
  try {
    const data = await listAlerts({ status: req.query.status, category: req.query.category, severity: req.query.severity, userId: req.fleetUser.id, role: req.fleetUser.role, accessToken: accessToken(req), limit: req.query.limit, offset: req.query.offset });
    return res.json(data);
  } catch (error) {
    console.error('Alert list error:', error?.message || error);
    return res.status(500).json({ error: 'Unable to load alerts' });
  }
});

router.patch('/:id/status', canHandle, async (req, res) => {
  const allowed = new Set(['ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED']);
  const status = String(req.body?.status || '').toUpperCase();
  if (!allowed.has(status)) return res.status(400).json({ error: 'Invalid alert status' });
  try {
    return res.json(await transitionAlert(req.params.id, status, req.fleetUser.id, accessToken(req)));
  } catch (error) {
    console.error('Alert transition error:', error?.message || error);
    return res.status(500).json({ error: 'Unable to update alert' });
  }
});

router.get('/history', staff, async (req, res) => {
  try {
    return res.json(await listHistory({ userId: req.fleetUser.id, role: req.fleetUser.role, accessToken: accessToken(req), limit: req.query.limit, offset: req.query.offset }));
  } catch (error) {
    console.error('Alert history error:', error?.message || error);
    return res.status(500).json({ error: 'Unable to load alert history' });
  }
});

module.exports = router;
