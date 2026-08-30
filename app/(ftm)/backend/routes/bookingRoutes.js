const express = require('express');
const router = express.Router();
const { getBookings, createBooking } = require('../controllers/bookingController');

router.get('/', getBookings);
router.post('/', createBooking);

module.exports = router;
