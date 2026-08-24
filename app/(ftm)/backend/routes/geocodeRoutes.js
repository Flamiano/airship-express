const express = require('express');
const router = express.Router();

const fetchFn = typeof fetch === 'function' ? fetch : require('node-fetch');

const DEFAULT_HEADERS = {
  'User-Agent': 'SimpleFleetAdmin/1.0 (contact: support@fleetapp.local)',
  Accept: 'application/json',
};

async function fetchGeocode(url) {
  const response = await fetchFn(url, { headers: DEFAULT_HEADERS });
  return response;
}

router.get('/reverse', async (req, res) => {
  const lat = req.query.lat;
  const lon = req.query.lon;
  if (!lat || !lon) {
    return res.status(400).json({ error: 'lat and lon are required' });
  }

  const primaryUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&zoom=18&addressdetails=1`;
  const fallbackUrls = [
    `https://photon.komoot.io/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`,
    `https://geocode.maps.co/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`,
  ];

  try {
    let response = await fetchGeocode(primaryUrl);
    if (!response.ok) {
      const text = await response.text();
      console.error('Primary reverse geocode failed:', response.status, text);
      for (const fallback of fallbackUrls) {
        response = await fetchGeocode(fallback);
        if (response.ok) break;
        const fallbackText = await response.text();
        console.error('Fallback reverse geocode failed:', fallback, response.status, fallbackText);
      }
    }

    if (!response.ok) {
      const text = await response.text();
      console.error('Reverse geocode proxy failed:', response.status, text);
      return res.status(502).json({ error: 'Reverse geocode service failed' });
    }

    const data = await response.json();
    return res.json(data);
  } catch (error) {
    console.error('Geocode proxy error:', error);
    return res.status(500).json({ error: 'Reverse geocode proxy failed' });
  }
});

// Philippines geographic boundaries
const PHILIPPINES_BOUNDS = {
  minLat: 5.0,
  maxLat: 20.0,
  minLng: 119.0,
  maxLng: 129.0,
};

function isWithinPhilippines(lat, lng) {
  return (
    lat >= PHILIPPINES_BOUNDS.minLat &&
    lat <= PHILIPPINES_BOUNDS.maxLat &&
    lng >= PHILIPPINES_BOUNDS.minLng &&
    lng <= PHILIPPINES_BOUNDS.maxLng
  );
}

// GET /api/geocode/search?q=... - forward to Nominatim search API
// Restricted to Philippines locations only
router.get('/search', async (req, res) => {
  const q = req.query.q;
  if (!q) return res.status(400).json({ error: 'q is required' });

  // Add Philippines to query to bias results toward Philippines
  const biasedQuery = `${q}, Philippines`;
  const primaryUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(biasedQuery)}&addressdetails=1&limit=6`;
  const fallbackUrls = [
    `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6`,
    `https://geocode.maps.co/search?q=${encodeURIComponent(q)}&limit=6`,
  ];

  try {
    let response = await fetchGeocode(primaryUrl);
    if (!response.ok) {
      const text = await response.text();
      console.error('Primary geocode search failed:', response.status, text);
      for (const fallback of fallbackUrls) {
        response = await fetchGeocode(fallback);
        if (response.ok) break;
        const fallbackText = await response.text();
        console.error('Fallback geocode search failed:', fallback, response.status, fallbackText);
      }
    }

    if (!response.ok) {
      const text = await response.text();
      console.error('Geocode search proxy failed:', response.status, text);
      // Return empty array instead of error - let frontend handle fallback
      return res.json([]);
    }

    let data = await response.json();
    
    // Filter results to only include locations within Philippines
    if (Array.isArray(data)) {
      data = data.filter((result) => {
        const lat = Number(result.lat);
        const lng = Number(result.lon);
        return isWithinPhilippines(lat, lng);
      });
      
      if (data.length === 0) {
        console.warn(`Geocode search for "${q}" returned no results within Philippines bounds`);
      }
    }
    
    return res.json(data || []);
  } catch (error) {
    console.error('Geocode search proxy error:', error);
    // Return empty array instead of error - let frontend handle fallback
    return res.json([]);
  }
});

module.exports = router;
