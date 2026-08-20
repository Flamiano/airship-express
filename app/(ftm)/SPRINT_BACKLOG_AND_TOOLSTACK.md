# FTM (Fleet & Tracking Management) - Sprint Backlog, Burndown Chart & Tool Stack

## Sprint Overview
- **Sprint Duration**: 2 weeks
- **Sprint Goal**: Deliver enhanced dashboard with centralized map layout, complete parcel management, and route optimization
- **Team Size**: 3-5 developers
- **Start Date**: 2026-08-01
- **End Date**: 2026-08-15

---

## Sprint Backlog

### Epic 1: Dashboard Redesign & Optimization

#### Story 1.1: Centralize Map on Dashboard
- **Story Points**: 8
- **Priority**: P0 (Critical)
- **Status**: ✅ COMPLETED
- **Description**: Restructure dashboard layout with Leaflet map centered, flanked by charts on both sides
- **Tasks**:
  - [ ] Redesign grid layout (3-column: Left charts, Center map, Right charts)
  - [ ] Move MapSection to center column
  - [ ] Position Fuel Consumption chart on left
  - [ ] Position Delivery Performance chart on right
  - [ ] Add responsive breakpoints for mobile
  - [ ] Test map rendering at different screen sizes

#### Story 1.2: Real-Time Fleet Tracking
- **Story Points**: 13
- **Priority**: P0 (Critical)
- **Status**: 🔄 IN PROGRESS
- **Description**: Implement WebSocket-based real-time vehicle tracking on map
- **Tasks**:
  - [ ] Set up WebSocket connection to backend
  - [ ] Update vehicle markers in real-time
  - [ ] Add live vehicle info popup
  - [ ] Implement location history trail
  - [ ] Add vehicle speed/bearing indicators
  - [ ] Performance optimization for 100+ vehicles

#### Story 1.3: Advanced Chart Interactivity
- **Story Points**: 8
- **Priority**: P1 (High)
- **Status**: 🔄 IN PROGRESS
- **Description**: Add drill-down and filtering capabilities to dashboard charts
- **Tasks**:
  - [ ] Implement chart click handlers
  - [ ] Add date range filters
  - [ ] Enable vehicle/driver filtering
  - [ ] Create drill-down from summary to detail
  - [ ] Add export to PDF/CSV functionality

### Epic 2: Parcel Management System

#### Story 2.1: Parcel Tracking Interface
- **Story Points**: 13
- **Priority**: P0 (Critical)
- **Status**: 🔄 IN PROGRESS
- **Description**: Complete parcel tracking with barcode scanning and status updates
- **Tasks**:
  - [ ] Design parcel detail view
  - [ ] Implement barcode scanner integration
  - [ ] Add parcel location map overlay
  - [ ] Create status timeline component
  - [ ] Implement photo upload for proof of delivery

#### Story 2.2: Bulk Parcel Operations
- **Story Points**: 8
- **Priority**: P1 (High)
- **Status**: 🔄 IN PROGRESS
- **Description**: Enable bulk parcel import, export, and batch operations
- **Tasks**:
  - [ ] Create bulk import CSV template
  - [ ] Implement CSV parser and validator
  - [ ] Add batch status update interface
  - [ ] Create bulk export functionality
  - [ ] Add batch operation scheduling

#### Story 2.3: Parcel Analytics & Insights
- **Story Points**: 8
- **Priority**: P2 (Medium)
- **Status**: 🔄 IN PROGRESS
- **Description**: Generate parcel delivery analytics and KPI reports
- **Tasks**:
  - [ ] Create delivery rate analysis
  - [ ] Implement parcel loss/damage tracking
  - [ ] Add delivery time distribution analysis
  - [ ] Generate courier performance report
  - [ ] Create predictive delivery time estimates

### Epic 3: Route Planning & Optimization

#### Story 3.1: Advanced Route Optimization
- **Story Points**: 21
- **Priority**: P0 (Critical)
- **Status**: 🔄 IN PROGRESS
- **Description**: Integrate OR-Tools for dynamic route optimization
- **Tasks**:
  - [ ] Set up OR-Tools Python service integration
  - [ ] Implement vehicle capacity constraints
  - [ ] Add time window constraints
  - [ ] Optimize for fuel efficiency
  - [ ] Support multiple depot locations
  - [ ] Real-time re-optimization during delivery

#### Story 3.2: Route Visualization & Analytics
- **Story Points**: 8
- **Priority**: P1 (High)
- **Status**: 🔄 IN PROGRESS
- **Description**: Visualize and analyze route efficiency
- **Tasks**:
  - [ ] Add multi-route comparison view
  - [ ] Create route quality metrics dashboard
  - [ ] Implement route deviation alerts
  - [ ] Add turn-by-turn directions
  - [ ] Create historical route analysis

### Epic 4: System Integration & Infrastructure

#### Story 4.1: Supabase Integration
- **Story Points**: 13
- **Priority**: P0 (Critical)
- **Status**: 🔄 IN PROGRESS
- **Description**: Full database integration with Supabase
- **Tasks**:
  - [ ] Configure RLS policies
  - [ ] Set up authentication flows
  - [ ] Implement real-time subscriptions
  - [ ] Optimize query performance
  - [ ] Add database backup strategy

#### Story 4.2: API Documentation
- **Story Points**: 5
- **Priority**: P2 (Medium)
- **Status**: 🔄 IN PROGRESS
- **Description**: Complete API documentation with examples
- **Tasks**:
  - [ ] Document all REST endpoints
  - [ ] Create OpenAPI/Swagger specs
  - [ ] Write integration examples
  - [ ] Create API error code reference

#### Story 4.3: Performance Optimization
- **Story Points**: 13
- **Priority**: P1 (High)
- **Status**: 🔄 IN PROGRESS
- **Description**: Optimize frontend and backend performance
- **Tasks**:
  - [ ] Implement code splitting and lazy loading
  - [ ] Optimize API response times (target <200ms)
  - [ ] Add caching strategies
  - [ ] Reduce bundle size
  - [ ] Implement database query optimization

---

## Sprint Burndown Chart

### Burndown Data (Ideal vs Actual)

| Day | Ideal Points | Actual Points | Completed | Velocity |
|-----|--------------|---------------|-----------|----------|
| 1   | 100          | 92            | 8         | 8        |
| 2   | 95           | 88            | 12        | 12       |
| 3   | 90           | 82            | 18        | 18       |
| 4   | 85           | 75            | 25        | 25       |
| 5   | 80           | 68            | 32        | 32       |
| 6   | 75           | 62            | 38        | 38       |
| 7   | 70           | 55            | 45        | 45       |
| 8   | 65           | 48            | 52        | 52       |
| 9   | 60           | 40            | 60        | 60       |
| 10  | 55           | 32            | 68        | 68       |
| 11  | 50           | 25            | 75        | 75       |
| 12  | 45           | 18            | 82        | 82       |
| 13  | 40           | 12            | 88        | 88       |
| 14  | 35           | 5             | 95        | 95       |

### Key Metrics
- **Total Story Points**: 137
- **Sprint Velocity (Target)**: 100 points
- **Burn Rate**: ~7 points/day
- **Sprint Capacity**: 90%
- **On-Track**: ✅ YES (currently tracking at 95 points completed)

### Burndown Chart Analysis
```
Points Remaining
│
100 ├─●─ Ideal Line
    │  \
 90 ├─  ╱─● Actual Line
    │ ╱    \
 80 ├─     ╱─●
    │    ╱    \
 70 ├─  ╱      ╱─●
    │ ╱      ╱
 60 ├─     ╱────●
    │    ╱
 50 ├─  ╱────────╱─●
    │ ╱
 40 ├─────────────╱─●
    │
 30 ├────────────────╱─●
    │
 20 ├─────────────────╱─●
    │
 10 ├──────────────────╱─●
    │
  0 ├───────────────────●
    └─────────────────────────
      1 2 3 4 5 6 7 8 9...14
      Days
```

---

## Technology Stack & Tool Stack

### Frontend
- **Framework**: React 18 + TypeScript
- **Build Tool**: Next.js 14 (with Turbopack)
- **Styling**: Tailwind CSS 3.3
- **Maps**: Leaflet 1.9 + React-Leaflet
- **Charts**: Recharts 2.10
- **State Management**: TanStack Query (React Query) + Zustand
- **UI Components**: Material Symbols (Material Design Icons)
- **HTTP Client**: Fetch API + Custom wrapper

### Backend
- **Runtime**: Node.js 20+ with Express.js
- **Language**: JavaScript (ES2020+)
- **Database**: Supabase (PostgreSQL 15)
- **ORM/Query**: Supabase JavaScript Client
- **Authentication**: JWT + Supabase Auth
- **API**: REST with Express Router
- **Middleware**: CORS, JSON body parser, custom error handling
- **Real-Time**: Supabase Realtime subscriptions (PostgreSQL LISTEN/NOTIFY)

### Optimization & Route Planning
- **Service**: OR-Tools (Python 3.10)
- **Algorithm**: Vehicle Routing Problem (VRP) solver
- **Constraints**: Capacity, Time Windows, Distance
- **Performance**: C++ backend compiled to Python bindings

### Database & Storage
- **Primary DB**: Supabase (PostgreSQL)
- **Tables**: vehicles, trips, bookings, parcels, drivers, routes, fuel_logs, costs
- **RLS**: Row-Level Security enabled for multi-tenant isolation
- **Backup**: Automated daily backups via Supabase

### DevOps & Infrastructure
- **Version Control**: Git + GitHub
- **CI/CD**: GitHub Actions (on push)
- **Deployment**: Docker containers
- **Environment**: Development, Staging, Production
- **Monitoring**: Console logs + Error tracking
- **API Documentation**: OpenAPI/Swagger (planned)

### Development Tools
- **IDE**: VS Code
- **Package Manager**: npm 9+
- **Linting**: ESLint + Prettier
- **Type Checking**: TypeScript 5
- **Testing**: Jest + React Testing Library (planned)
- **Debug**: Browser DevTools + VS Code Debugger
- **Task Management**: GitHub Issues + Project Boards
- **Documentation**: Markdown + Confluence (planned)

### APIs & External Services
- **Geocoding**: OpenStreetMap Nominatim + Google Maps API
- **Mapping**: OpenStreetMap (Leaflet tiles)
- **Weather**: OpenWeather API (for route conditions)
- **Notifications**: Firebase Cloud Messaging (planned)
- **Analytics**: Google Analytics (planned)

### Performance & Security
- **Frontend Optimization**: Code splitting, lazy loading, tree-shaking
- **Caching**: Browser caching + API response caching
- **Security**: HTTPS/TLS, CSRF protection, SQL injection prevention
- **Rate Limiting**: API endpoint rate limiting (planned)
- **Data Encryption**: End-to-end encryption for sensitive fields

### Monitoring & Logging
- **Application Logs**: Console output + File logs
- **Error Tracking**: Browser console + Backend error logs
- **Performance Metrics**: React DevTools + Network tab
- **Uptime**: Health check endpoint (/api/health)

---

## Definition of Done (DoD)

- ✅ Code peer review approved
- ✅ Unit tests pass (>80% coverage)
- ✅ Integration tests pass
- ✅ TypeScript types properly defined
- ✅ No console warnings/errors
- ✅ Responsive design tested (mobile/tablet/desktop)
- ✅ Accessibility WCAG 2.1 AA compliant
- ✅ Performance metrics meet targets
- ✅ Documentation updated
- ✅ QA sign-off received
- ✅ Merged to main branch
- ✅ Deployed to staging environment

---

## Sprint Risks & Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|-----------|
| OR-Tools integration delays | High | Medium | Start early, have fallback algorithm |
| Supabase RLS complexity | High | Medium | Allocate senior dev, pair programming |
| Real-time WebSocket issues | Medium | Low | Pre-test with multiple vehicle counts |
| API performance degradation | High | Low | Implement caching, query optimization |
| Database connection timeouts | Medium | Low | Add connection pooling, retry logic |

---

## Success Criteria

- ✅ Dashboard layout with centered map and flanking charts
- ✅ Real-time vehicle tracking on map
- ✅ Complete parcel management interface
- ✅ Route optimization integrated with OR-Tools
- ✅ Sprint velocity ≥ 90 points
- ✅ Zero critical bugs in production
- ✅ >95% uptime
- ✅ API response time <200ms (p95)
- ✅ User satisfaction score >4.5/5

---

## Post-Sprint Actions

1. **Sprint Retrospective** (Aug 16): Team reflection on what went well and improvements
2. **Sprint Review** (Aug 16): Demo to stakeholders
3. **Planning** (Aug 17): Next sprint planning based on feedback
4. **Release Notes** (Aug 17): Document changes and deployment checklist
5. **Monitoring** (Ongoing): Track production metrics and user feedback
