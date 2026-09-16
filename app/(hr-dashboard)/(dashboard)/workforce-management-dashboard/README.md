# Airship Express — Workforce Management Sub-system

A production-structured **Next.js + TypeScript + Supabase** implementation of the
Workforce Management sub-system for a Freight Management System, built from the
provided pink/white dashboard prototype.

It delivers the primary **Workforce Analytics** dashboard plus four core modules
(Time & Attendance, Shifts & Schedules, Timesheets, Leave) with real
authentication, role-based access control, Supabase Realtime, and a secure
Gemini AI staffing-forecast endpoint.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (Pages Router), React 18, TypeScript (strict) |
| Styling | Tailwind CSS — strict pink/white palette |
| Charts | Recharts |
| Backend | Next.js API Routes (serverless) |
| Database / Auth / Realtime | Supabase (PostgreSQL) |
| AI | Google Gemini (server-side route, heuristic fallback) |
| CI/CD | GitHub Actions → Vercel |

---

## Feature Map

**Workforce Analytics Dashboard** (`/dashboard`) — the primary admin view:
- **Card 1 — Predict Hiring Needs:** multi-line chart (current vs required staffing over 12 months) + AI insights + deficit/skill-gap overlays.
- **Card 2 — Employee Performance:** pink doughnut (Top Performers / Steady / Needs Review) + rating metrics.
- **Card 3 — Skilling Progress:** pink horizontal bar chart of departmental certification completion.
- **Card 4 — Real-time Attendance:** live Supabase Realtime status feed + On-Shift / On-Break / Tardy tiles.

**Core modules:**
- `/attendance` — Time & Attendance: clock in/out, live terminal log, status editing (HR/Manager).
- `/shifts` — Shift & Schedule Management: assign drivers to vehicles/routes.
- `/timesheets` — Timesheet Workflow: approve / flag overtime (HR Admin).
- `/leave` — Leave & Fatigue Rest: request + approval cycle with balances.
- `/loads` — Freight Load Dispatch: match loads to available drivers, track status.

**RBAC roles:** the real roster positions from `employeelist.txt` (Appraiser,
Sales Representative, JNT Pick-Up Rider, Airship Driver, HR Generalist, ...) —
HR roles approve/flag, managers (incl. Office-in-Charge) build schedules and
assign loads, riders get a reduced driver view. Enforced in API routes *and*
Postgres Row-Level Security.

---

## Local Setup

### 1. Install
```bash
npm install
```

### 2. Create a Supabase project
Go to [supabase.com](https://supabase.com) → New Project. In **SQL Editor**, run `supabase/schema.sql` (creates tables, RLS policies, realtime subscription, and the signup trigger).

### 3. Configure environment
Fill in `.env.local` from **Supabase → Project Settings → API**:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co       # bare origin, no /rest/v1/
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...                            # server only — never expose
GEMINI_API_KEY=...                                       # optional (heuristic fallback exists)
```
Get a Gemini key from [Google AI Studio](https://aistudio.google.com/app/apikey).

### 4. Populate the database (one command)
```bash
npm run db:setup
```
This creates **one sign-in account per employee in `employeelist.txt`** (61
people, each with their real position as their role), seeds all 9 tables with
roster-driven data, and outputs the login credentials. Password for all:
`AirshipExpress#2026`

### 5. Run
```bash
npm run dev      # http://localhost:3000/dashboard
```
Sign-in has been removed — the app opens directly on the dashboard (running as
Meliza Bangkok, HR Generalist) with live cards.

### Regenerating DB types (optional)
Hand-written row types live in `types/workforce.ts`. To regenerate TypeScript
types straight from the live Supabase schema (e.g. after schema changes), log in
once and run:
```bash
npx supabase login
npm run db:types     # writes database.types.ts
```

---

## Verify It Works

| Check | Expected |
|---|---|
| Visit `/` | Redirects to `/dashboard` (no sign-in required) |
| Open `/dashboard` | 4 populated cards render immediately (runs as Meliza Bangkok, HR Generalist) |
| Dashboard → "Predictive Hiring AI" | Modal shows Gemini forecast (or heuristic if no key) |
| Realtime: edit an `attendance_logs` row's status in Supabase | Card 4 / `/attendance` updates with no refresh |
| On `/timesheets` | "Approve" / "Flag OT" buttons visible and working (HR roles) |
| On `/leave` / `/loads` | Create + approve actions all available (HR/manager context) |
| Press ⌘K (or Ctrl+K) in TopNav search | Command palette opens; try typing a rider name or load ref |
| As HR on `/loads` | "Create Freight Load" + assign/status dropdowns visible; driver list tags On-Shift staff |
| `npm test` | unit tests pass (analytics calcs, RBAC gates, search sanitizer, Supabase error handling) |
| `npm run build` | Compiles with zero TypeScript errors |

---

## Deploy

1. Push to GitHub — the included `.github/workflows/ci.yml` runs typecheck + lint + build.
2. Import the repo into **Vercel**.
3. Add the four environment variables in the Vercel project settings.
4. Deploy. Supabase remains the managed DB/Auth/Realtime backend.

---

## Project Structure

```
pages/            Routes + API routes (backend)
components/
  layout/         Sidebar, TopNav, DashboardLayout
  analytics/      Card1–Card4
  modals/         CreateShift, LeaveRequest, AiInsights
  ui/             Button, Card, Badge, Table, Modal
contexts/         AuthContext (demo identity + role)
hooks/            useAuth, useRealtime, useAiAnalysis
lib/              supabaseAdmin, gemini, apiAuth, apiFetch
types/            workforce.ts, api.ts (strict TS interfaces)
utils/            rbac.ts, constants.ts
supabase/         schema.sql, step2_users_and_data.sql, seed.sql
scripts/          setup-database.mjs (npm run db:setup)
```

> **No Node? SQL-only alternative:** run `supabase/schema.sql` then
> `supabase/seed.sql` in the SQL Editor. That seeds analytics (Cards 1 & 3)
> immediately. `npm run db:setup` does all of this in one step (and creates the
> 61 roster accounts); `supabase/step2_users_and_data.sql` is the SQL-only
> version of it.

---

## Integration Notes (wider freight system)

Workforce data is modeled relationally so it can feed the broader platform — e.g.
matching **available drivers** (profiles + attendance `On-Shift`) to **loads**. The
`freight_loads` table ships with `/loads` for dispatch; join on `shifts.driver_id`
or `freight_loads.driver_id`, and the `workforce_forecast.freight_volume` column is
the intended hook for real load volume data.

> **Palette note:** the UI never uses pure black on pure white — body text is deep
> pink (`pink-950`), highlights and active states use the pink scale, per spec.
