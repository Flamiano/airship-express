const express = require('express');
const router = express.Router();
const { requireFleetUser } = require('../middleware/authMiddleware');
const { postChat, getConversationHistory } = require('../controllers/fleetAiController');
const { isConfigured } = require('../services/aiProvider');

router.get('/health', (req, res) => {
  res.json({ message: 'Fleet AI route ready', aiConfigured: isConfigured() });
});

router.post('/chat', requireFleetUser, postChat);
router.get('/conversations/:conversationId', requireFleetUser, getConversationHistory);

module.exports = router;
