const express = require('express');
const router = express.Router();
const { getTrips, createTrip, confirmTripPickup, startTrip, updateTripStatus, assignTrip, acceptTrip } = require('../controllers/tripController');

router.get('/', getTrips);
router.post('/', createTrip);
router.post('/:id/pickup-confirmation', confirmTripPickup);
router.post('/:id/assign', assignTrip);
router.post('/:id/accept', acceptTrip);
router.post('/:id/start', startTrip);
router.post('/:id/complete', (req, res) => updateTripStatus(req, res, 'Completed', 100));

module.exports = router;
