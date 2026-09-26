const express = require('express');
const router = express.Router();
const { getVehicles, getNextVehicleIdRoute, createVehicle, getCouriers, createVehicleDocument, uploadVehicleDocument } = require('../controllers/vehicleController');

router.get('/couriers', getCouriers);
router.get('/next-id', getNextVehicleIdRoute);
router.post('/documents/upload', uploadVehicleDocument);
router.post('/documents', createVehicleDocument);
router.get('/', getVehicles);
router.post('/', createVehicle);

module.exports = router;
