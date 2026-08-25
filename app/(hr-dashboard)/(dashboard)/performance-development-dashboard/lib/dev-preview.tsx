"use client";

import { useState } from "react";
import type { AuthenticatedHrUser } from "./types";

export type DevPreviewProfileId = "admin" | "employee";

export const DEV_PREVIEW_PROFILES: Record<
  DevPreviewProfileId,
  AuthenticatedHrUser
> = {
  admin: {
    authUserId: "dev-preview-admin",
    role: "hr_payroll_admin",
    employeeId: null,
    employeeNumber: "AX-01003",
    fullName: "Pedro Reyes",
    email: null,
    department: "Human Resources",
    jobTitle: "HR & Payroll Administrator",
  },
  employee: {
    authUserId: "dev-preview-employee",
    role: "employee",
    employeeId: null,
    employeeNumber: "AX-01001",
    fullName: "Juan Dela Cruz",
    email: null,
    department: "Operations",
    jobTitle: "Operations Associate",
  },
};

let selectedProfileId: DevPreviewProfileId = "admin";
const profileListeners = new Set<() => void>();

export function getSelectedDevPreviewProfileId(): DevPreviewProfileId {
  return selectedProfileId;
}

export function selectDevPreviewProfile(id: DevPreviewProfileId): void {
  selectedProfileId = id;
  profileListeners.forEach((listener) => listener());
}

export function subscribeToDevPreviewProfile(
  listener: () => void
): () => void {
  profileListeners.add(listener);
  return () => {
    profileListeners.delete(listener);
  };
}

export function isHrDevPreviewEnabled(): boolean {
  return process.env.NODE_ENV === "development";
}

export function DevPreviewPanel() {
  const [selected, setSelected] = useState<DevPreviewProfileId>(
    getSelectedDevPreviewProfileId()
  );

  if (!isHrDevPreviewEnabled()) return null;

  const active = DEV_PREVIEW_PROFILES[selected];

  function choose(id: DevPreviewProfileId) {
    setSelected(id);
    selectDevPreviewProfile(id);
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 rounded-xl border border-amber-500/25 bg-paper px-3.5 py-3 font-rethink shadow-sm dark:bg-ink">
      <p className="flex items-center gap-2 text-[11px] font-semibold text-amber-700 dark:text-amber-500">
        <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-amber-500" />
        DEV PREVIEW · UI ONLY — NO LIVE DATA
      </p>
      <p className="text-[11.5px] text-muted">
        {active.fullName} ({active.employeeNumber}) ·{" "}
        {selected === "admin" ? "Admin view" : "Employee view"}
      </p>
      <div className="flex gap-1.5">
        {(Object.keys(DEV_PREVIEW_PROFILES) as DevPreviewProfileId[]).map(
          (id) => (
            <button
              key={id}
              type="button"
              onClick={() => choose(id)}
              className={
                selected === id
                  ? "rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-[11px] font-semibold text-accent transition-colors"
                  : "rounded-full border border-line px-2.5 py-1 text-[11px] font-medium text-muted transition-colors hover:border-accent hover:text-accent dark:border-paper/15"
              }
            >
              {id === "admin" ? "Admin view" : "Employee view"}
            </button>
          )
        )}
      </div>
    </div>
  );
}
