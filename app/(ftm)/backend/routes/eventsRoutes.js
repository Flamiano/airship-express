const express = require('express');
const router = express.Router();
const { addClient } = require('../events/sse');

// Simple SSE endpoint — clients may filter client-side by driver_id
router.get('/assignments', (req, res) => addClient(req, res));

module.exports = router;
