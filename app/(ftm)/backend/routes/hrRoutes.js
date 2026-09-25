const express = require('express');
const { getHrSupabase } = require('../config/db');

const router = express.Router();

function getClient(res) {
  const client = getHrSupabase();
  if (!client) {
    res.status(503).json({ error: 'HR database is not configured for FTM.' });
    return null;
  }
  return client;
}

function employeeSelect() {
  return 'id, employee_id_number, first_name, last_name, email, phone, department, date_hired, status, job_position_id, job_position:hr1_job_positions(id, title)';
}

router.get('/employees', async (req, res) => {
  const client = getClient(res);
  if (!client) return;

  try {
    let query = client.from('hr1_employees').select(employeeSelect()).order('last_name', { ascending: true });
    if (req.query.status) query = query.eq('status', req.query.status);
    if (req.query.department) query = query.eq('department', req.query.department);
    const { data, error } = await query;
    if (error) throw error;
    return res.json(data || []);
  } catch (error) {
    console.error('HR employees query failed:', error.message || error);
    return res.status(500).json({ error: 'Unable to load HR employees.' });
  }
});

router.get('/attendance', async (req, res) => {
  const client = getClient(res);
  if (!client) return;

  try {
    let query = client
      .from('hr2_attendance_logs')
      .select(`id, employee_id, status, shift_start, shift_end, terminal, last_scan, created_at, time_in, time_out, employee:hr1_employees(${employeeSelect()})`)
      .order('last_scan', { ascending: false });
    if (req.query.employee_id) query = query.eq('employee_id', req.query.employee_id);
    if (req.query.status) query = query.eq('status', req.query.status);
    const { data, error } = await query;
    if (error) throw error;
    return res.json(data || []);
  } catch (error) {
    console.error('HR attendance query failed:', error.message || error);
    return res.status(500).json({ error: 'Unable to load HR attendance.' });
  }
});

router.get('/shifts', async (req, res) => {
  const client = getClient(res);
  if (!client) return;

  try {
    let query = client
      .from('hr2_shifts')
      .select('id, title, driver_id, vehicle, shift_date, shift_time, status, priority, created_at, driver:hr1_employees(id, employee_id_number, first_name, last_name, email, department)')
      .order('shift_date', { ascending: true });
    if (req.query.status) query = query.eq('status', req.query.status);
    if (req.query.driver_id) query = query.eq('driver_id', req.query.driver_id);
    const { data, error } = await query;
    if (error) throw error;
    return res.json(data || []);
  } catch (error) {
    console.error('HR shifts query failed:', error.message || error);
    return res.status(500).json({ error: 'Unable to load HR shifts.' });
  }
});

router.get('/freight-loads', async (req, res) => {
  const client = getClient(res);
  if (!client) return;

  try {
    let query = client
      .from('hr2_freight_loads')
      .select('id, load_ref, origin, destination, pickup_date, status, priority, driver_id, created_at, driver:hr1_employees(id, employee_id_number, first_name, last_name, email, department)')
      .order('pickup_date', { ascending: true });
    if (req.query.status) query = query.eq('status', req.query.status);
    if (req.query.driver_id) query = query.eq('driver_id', req.query.driver_id);
    const { data, error } = await query;
    if (error) throw error;
    return res.json(data || []);
  } catch (error) {
    console.error('HR freight loads query failed:', error.message || error);
    return res.status(500).json({ error: 'Unable to load HR freight loads.' });
  }
});

module.exports = router;
