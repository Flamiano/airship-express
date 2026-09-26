const express = require('express');
const router = express.Router();
const { getBookings, createBooking, assignBookingResources } = require('../controllers/bookingController');

router.get('/', getBookings);
router.post('/', createBooking);
router.patch('/:id/assignment', assignBookingResources);

module.exports = router;
