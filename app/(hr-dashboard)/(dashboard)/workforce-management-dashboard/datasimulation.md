# Toggleable Data Simulation (Frontend Architecture)

## Overview
The Data Simulation mode is a frontend-only architectural feature designed to decouple the UI from the backend API/Database for rapid prototyping, scalability, and demonstration purposes.

When enabled via the Settings page, all API calls made through the `apiFetch` wrapper are intercepted and resolved instantly with mock data. 

## How It Works

1. **State Persistence**: 
   The toggle in the Settings page (`app/(hr-dashboard)/(dashboard)/workforce-management-dashboard/(pages)/settings/page.tsx`) writes a `simulation_mode` boolean to the browser's `localStorage`.

2. **API Interception**:
   The centralized `lib/apiFetch.ts` checks for this `localStorage` flag. If `true`, it bypasses the `fetch()` network call entirely and immediately resolves the Promise with a mocked response payload from `lib/mockDatabase.ts`.

3. **Data Source**:
   `lib/mockDatabase.ts` serves as the centralized mock data store. It contains realistic dummy data based on the team's official `employeelist.md` structure.

## Benefits
- **No Backend Requirement**: Pages that have not yet been connected to actual FastAPI or Supabase routes can still be built and tested fully functional on the frontend.
- **Graceful Fallbacks**: If simulation mode is OFF, the frontend properly hits the `/api/...` routes. If those fail, the UI gracefully handles the empty arrays/errors without crashing.
- **Clean Components**: We no longer clutter React pages with hardcoded `const staticData = [...]` arrays. Everything uses native state and `useEffect` data fetching.

## Maintaining Mock Data
To update the simulated data, edit `lib/mockDatabase.ts`. Do not place hardcoded arrays inside your component files. All components must rely exclusively on `apiFetch`.
