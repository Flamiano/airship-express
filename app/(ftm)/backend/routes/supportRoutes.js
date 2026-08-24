const express = require('express');
const router = express.Router();
const { getServiceSupabase } = require('../config/db');

// Static FAQ content - no need for a database round trip for content that
// changes rarely; keeps the driver app's Help & Support screen fast even
// offline-first.
const FAQS = [
  { id: 'faq-1', question: 'How do I start a trip?', answer: 'Open the trip from the Trips tab and tap "Start Trip". Your location will begin sharing with dispatch automatically.' },
  { id: 'faq-2', question: 'How do I log a fuel or toll expense?', answer: 'Go to Expenses > Add Expense, take a photo of the receipt, and the amount/category will auto-fill when possible. You can always edit before submitting.' },
  { id: 'faq-3', question: 'What do I do if my vehicle breaks down?', answer: 'Use Vehicle Details > Report an Issue to notify dispatch immediately, including a description of the problem.' },
  { id: 'faq-4', question: 'Why does my route change automatically?', answer: 'Routes are optimized automatically by OR-Tools whenever a new stop is dispatched to your vehicle, so your stop order may update without you doing anything.' },
  { id: 'faq-5', question: 'I forgot my PIN. What now?', answer: 'Ask your dispatcher to reset your account from the admin dashboard.' },
];

router.get('/faqs', (_req, res) => res.json(FAQS));

// POST /api/support/report -> general driver support ticket (distinct from
// a vehicle-specific issue, which goes through /api/vehicles/:id/report).
router.post('/report', async (req, res) => {
  const { driver_id: driverId, subject, message } = req.body || {};
  if (!message) return res.status(400).json({ error: 'message is required' });

  const supabase = getServiceSupabase();
  if (!supabase) return res.status(503).json({ error: 'Database is not configured' });

  const { data, error } = await supabase
    .from('incident_reports')
    .insert({
      driver_id: driverId || null,
      incident_type: 'Other',
      description: subject ? `[${subject}] ${message}` : message,
    })
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('Support report insert error:', error.message || error);
    return res.status(500).json({ error: `Unable to submit support request: ${error.message}` });
  }
  return res.status(201).json(data);
});

module.exports = router;
