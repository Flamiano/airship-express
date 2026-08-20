const express = require('express');
const router = express.Router();
const { healthCheck, registerDriver, loginDriver, getDriverProfile } = require('../controllers/authController');

router.get('/health', healthCheck);
router.post('/driver/register', registerDriver);
router.post('/driver/login', loginDriver);
router.get('/driver/profile/:driverId', getDriverProfile);

module.exports = router;
