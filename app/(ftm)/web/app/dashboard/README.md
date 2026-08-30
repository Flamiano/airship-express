# Airship Express — Command Center

Next.js 14 (App Router) + Tailwind CSS rebuild of the logistics dashboard, with the
center map panel now a real, interactive **Leaflet** map (via `react-leaflet`)
instead of a static image.

## Setup

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Structure

- `app/page.tsx` — assembles the three-column dashboard layout
- `app/layout.tsx` / `app/globals.css` — fonts, panel corner-bracket styling, Leaflet theme overrides
- `components/MapSection.tsx` — the map panel: overlays the "Transit Time / Active Centers / Support
  Units / Duty Officer" stat bar and the color legend on top of the live map, and dynamically
  imports `MapPanel` with SSR disabled (Leaflet requires `window`)
- `components/MapPanel.tsx` — the actual `react-leaflet` map: CartoDB light basemap, circle markers
  for each hub (radius/color scaled by tier), a popup per hub, and a dashed route line
- Other `components/*.tsx` — one file per panel (Specialized Logistics, Performance Metrics,
  Mission Logs, Resource Data, Sensor Hub, News & Alerts), all with the same data that was
  hardcoded in the original HTML, now as typed arrays you can swap for real API data

## Notes

- Map tiles come from CartoDB's free "light_all" basemap over OpenStreetMap data — no API key
  needed. Swap the `url` in `MapPanel.tsx` for Mapbox/Stadia/etc. if you want a different look or
  higher rate limits in production.
- Hub coordinates are illustrative (Beijing, Shanghai, Shenzhen, Chengdu, Guangzhou) — replace
  `HUBS` in `MapPanel.tsx` with real data.
- I couldn't run `npm install` / `npm run build` in this sandbox (no network access), so double
  check `npm run build` locally before deploying.
