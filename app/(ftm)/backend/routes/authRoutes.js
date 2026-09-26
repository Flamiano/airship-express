const express = require('express');
const router = express.Router();
const {
  healthCheck,
  registerDriver,
  loginDriver,
  getDriverProfile,
  requestMfaOtp,
  verifyMfaOtp,
  updateOtpPolicy,
  getOtpPolicy,
} = require('../controllers/authController');
const { requireFleetUser, requireRoles } = require('../middleware/authMiddleware');

router.get('/health', healthCheck);
router.post('/driver/register', registerDriver);
router.post('/driver/login', loginDriver);
router.post('/login', loginDriver);
router.post('/request-otp', requestMfaOtp);
router.post('/verify-otp', verifyMfaOtp);
router.patch('/otp-policy', requireFleetUser, requireRoles('admin', 'fleet_manager'), updateOtpPolicy);
router.get('/otp-policy', requireFleetUser, getOtpPolicy);
router.get('/driver/profile/:driverId', getDriverProfile);

module.exports = router;
