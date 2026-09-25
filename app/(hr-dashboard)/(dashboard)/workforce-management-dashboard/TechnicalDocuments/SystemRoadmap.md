# **SMART FREIGHT: Workforce System Architecture & Development Roadmap**

# **1\. Core System & Scope Refinements**

* **Scope Reduction:** Remove compliance, skilling cards, and vehicle/weight tracking features as they fall outside the primary project scope.  
* **Export Capabilities:** Implement a printable format/export button across all UI pages for individual reports and manual data backups.  
* **Notification System:** Redesign the notification interface to include a "Clear Notifications" function.

# **2\. Role-Based Attendance & Scheduling**

* **Role Categorization:** Separate logic for Office Employees and Riders/Drivers.  
* **Office Employees:** Fixed schedules with full Time-In/Time-Out tracking capabilities.  
* **Employed Drivers:** Dispatch-based scheduling with expected arrival dates and dispatch status indicators.  
* **Third-Party Drivers:** RFID usage restricted to basic In/Out gate verification (no full time-tracking).  
* **Calendar UI Integration:** Add toggleable calendar views for visualizing individual employee schedules and shift management.  
* **Backend Thresholds:** Implement configurable backend settings to define thresholds for Late, Absent, and AWOL statuses.

# **3\. Analytics & Leave Management**

* **Timesheet Workflow:** Retain numeric charts displaying total hours, shifting focus toward analytical time data with potential future AI insights.  
* **Leave & Fatigue UI:** Revamp the active request queue into a modal menu. Incorporate a calendar modal to cross-reference leave requests against active employees and schedules.  
* **Workforce Analytics:** Redesign to feature categorized lists (e.g., late vs. on-time employees) with search functionality, individual employee previews, and in-depth calendar views of tardiness history.

# **4\. The "Omnibar" AI Strategy**

* **Integrated Search & Chat:** Replace the floating chatbot widget with a Google-inspired header search bar that doubles as an AI conversation starter.  
* **Contextual Assistance:** AI will serve to summarize employee lists (e.g., tardy employees) and guide users seamlessly through the system UI.  
* **Design Philosophy:** Take inspiration from iOS 27 Siri's system-wide integration to make the AI feel deeply connected to the database rather than a tacked-on UI wrapper.

# **5\. Phased Development Strategy**

* **Stage 1: UI Implementation:** Establish and finalize the stateless frontend presentation components.  
* **Stage 2: Backend Logic:** Implement core APIs, thresholds, and Supabase/FastAPI routing.  
* **Stage 3: UX Polish:** Refine user interactions, visual feedback, and accessibility.  
* **Stage 4: Architectural Validation:** Double-check all system design elements against this roadmap.  
* **Stage 5: AI Integration:** Introduce AI only after deterministic logic is flawless. Grant the AI sandboxed FastAPI tool-calling access for scheduled summarizations, unique notifications, and future predictions.

# **6\. Definition of Done**

* System logic functions deterministically without AI intervention.  
* AI is deeply integrated using Supabase Vectors for quick, contextual searches.  
* UI/UX is fully polished, accessible, and responsive.  
* Security protocols and permissions are thoroughly verified.  
* Admin logs are fully viewable and exportable.  
* Backend logic is decoupled, relying on FastAPI for all AI services.

&nbsp;