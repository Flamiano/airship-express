/**
 * Thin alias layer over routes/trackingRoutes.js.
 *
 * The driver app (driver-app/src/services/driverApi.js and
 * trackingService.js) was written against `/api/gps/mobile`,
 * `/api/gps/vehicle`, `/api/gps/vehicle/:id`, and `/api/gps/mobile/:id`, but
 * the backend only ever implemented the equivalent logic under
 * `/api/tracking/mobile-gps/*` and `/api/tracking/vehicle-gps/*` - so every
 * GPS call from the app was hitting a 404. Rather than duplicate the
 * (fairly involved, with several DB-fallback code paths) tracking logic,
 * this file rewrites the URL and re-dispatches into the same Express
 * Router instance used by trackingRoutes, so both URL shapes share one
 * implementation.
 */
const express = require('express');
const trackingRouter = require('./trackingRoutes');
const router = express.Router();

function dispatchTo(newPath) {
  return (req, res, next) => {
    const queryIndex = req.url.indexOf('?');
    const query = queryIndex >= 0 ? req.url.slice(queryIndex) : '';
    req.url = `${newPath}${query}`;
    trackingRouter.handle(req, res, next);
  };
}

router.post('/mobile', dispatchTo('/mobile-gps/record'));
router.post('/vehicle', dispatchTo('/vehicle-gps/record'));
router.get('/mobile/:driverId', (req, res, next) => dispatchTo(`/mobile-gps/${req.params.driverId}`)(req, res, next));
router.get('/vehicle/:vehicleId', (req, res, next) => dispatchTo(`/vehicle-gps/${req.params.vehicleId}`)(req, res, next));

module.exports = router;
