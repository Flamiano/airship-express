<!-- BEGIN:workforce-dashboard-agent-rules -->
# Workforce Management Dashboard - Agent Context & Guidelines

Welcome! If you are an AI agent operating in this codebase, **read this carefully**. This file contains the historical context, architecture details, and strict rules for modifying the `workforce-management-dashboard`. Different parts of this project were built by different agents/programmers, so this guide will help you navigate inconsistencies without breaking existing functionality.

## 🏗️ Architecture Overview
- **Frontend**: Next.js App Router, located in `app/(hr-dashboard)/(dashboard)/workforce-management-dashboard`. 
- **Authentication**: Supabase JWT sessions are used for user auth across the dashboard.
- **Backend API**: A standalone FastAPI gateway deployed on a Linux server (`192.168.100.10:8000` / `wf.canefly.xyz`). It handles the core business logic, and can be accessible through ssh canefly@192.168.100.10 with a permitted key already setted up.
- **Hardware Integration**: The system integrates with ESP32 physical devices for RFID attendance tracking. These devices communicate directly with the FastAPI backend using an `X-API-Key` header.
- **Logging**: The FastAPI backend has custom JSON logging middleware that intercepts Supabase JWTs to trace actions to specific users (`email`/`sub`), while excluding `/health-check` from the logs.

## 🎨 UI & Styling Rules
- **UI Standardization**: The UI components here have been standardized to strictly match the visual styling, Tailwind CSS classes, layouts, and dark mode toggles of the `payroll-benefits-dashboard` folder. Maintain this design language.
- **Boundary Restriction**: Treat anything outside the `workforce` folder as **read-only**. Do not modify other submodules to fix UI issues unless explicitly requested by the user.
- **Data Integrity**: **CRITICAL:** Never alter any Supabase data fetching, routing logic, or RFID hardware bindings when performing visual updates.
- **Animation Performance**: Sidebar animations can become choppy due to React Recharts re-rendering during layout shifts. If adding charts to responsive/resizing containers, add `isAnimationActive={false}` to the Recharts components to prevent lag.

## 🛠️ Build & Next.js Constraints (DO NOT BREAK)
- **TypeScript Errors**: There are cross-team type inconsistencies across the broader codebase.

By following these rules, you will ensure the dashboard remains stable, performant, and visually consistent with the rest of the application.
<!-- END:workforce-dashboard-agent-rules -->
