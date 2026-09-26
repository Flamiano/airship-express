const express = require('express');
const router = express.Router();
const { getTrips, createTrip, updateTripStatus, assignTrip, acceptTrip } = require('../controllers/tripController');

router.get('/', getTrips);
router.post('/', createTrip);
router.post('/:id/assign', assignTrip);
router.post('/:id/accept', acceptTrip);
router.post('/:id/start', (req, res) => updateTripStatus(req, res, 'In Transit', 5));
router.post('/:id/complete', (req, res) => updateTripStatus(req, res, 'Completed', 100));

module.exports = router;
