const express = require('express');
const router = express.Router();
const { getRoutePlans, getRoutePlanById, createRoutePlan } = require('../controllers/routePlanController');

router.get('/', getRoutePlans);
router.get('/:id', getRoutePlanById);
router.post('/', createRoutePlan);

module.exports = router;
