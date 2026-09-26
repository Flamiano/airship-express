# Airship Express — Cost Analysis Dashboard

A Next.js (App Router) + TypeScript + Tailwind CSS port of the original static
`code.html` mock. All colors, spacing, type scale, and border-radius tokens
from the original Tailwind CDN config were moved into `tailwind.config.ts`,
and the page was split into reusable components under `src/components`.

## Getting started

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Project structure

```
src/
  app/
    layout.tsx       # root layout, fonts, metadata
    page.tsx          # assembles the dashboard
    globals.css        # Tailwind layers + material-symbols/bento-shadow utilities
  components/
    TopNavBar.tsx
    SubNavBar.tsx
    ControlsRow.tsx
    KpiRow.tsx                  # PrimaryKpiRow / SecondaryKpiRow
    AnalyticsRow.tsx            # expense breakdown + trend chart + top drivers
    ExpenseDonutChart.tsx       # Chart.js donut (client component)
    TrendChart.tsx              # Chart.js bar+line combo (client component)
    DataTableRow.tsx            # table + insights panel
    AssetCostTable.tsx
    StatusBadge.tsx
    CostOptimizationInsights.tsx
    TrendIcon.tsx
    Footer.tsx
  lib/
    data.ts           # all dashboard data (KPIs, table rows, chart data, insights)
```

## Notes

- Charts use `chart.js` directly inside client components (`"use client"`),
  matching the original vanilla Chart.js implementation.
- Data that was hardcoded inline in the HTML (KPI values, table rows, chart
  datasets, insights) now lives in `src/lib/data.ts` — edit that file to
  update the numbers, or wire it up to a real API/data source.
- The Material Symbols and Hanken Grotesk fonts are loaded via Google Fonts
  `<link>` tags in `src/app/layout.tsx`, same as the original.
- The profile photo uses `next/image` and is allow-listed in
  `next.config.mjs` (`lh3.googleusercontent.com`).
- Tailwind's `forms` plugin is included to match the original CDN config
  (`?plugins=forms,container-queries`); container-queries were not needed by
  any markup used in this page.
