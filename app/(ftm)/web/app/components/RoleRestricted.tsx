"use client";

import { useEffect, useState } from "react";
import { AppRole, getCurrentRole, hasRoleAccess } from "../lib/roleAccess";

type RoleRestrictedProps = {
  allowedRoles: AppRole[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
  hideWhenRestricted?: boolean;
};

export default function RoleRestricted({ allowedRoles, children, fallback, hideWhenRestricted = false }: RoleRestrictedProps) {
  const [isAllowed, setIsAllowed] = useState<boolean>(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setIsAllowed(hasRoleAccess(allowedRoles));
    setIsReady(true);
  }, [allowedRoles]);

  if (!isReady) {
    return null;
  }

  if (!isAllowed) {
    if (hideWhenRestricted) {
      return null;
    }

    return (
      fallback ?? (
        <div className="flex min-h-[40vh] items-center justify-center bg-[#fff7fc] px-6 py-12 text-center">
          <div className="max-w-md rounded-3xl border border-pink-200 bg-white p-8 shadow-sm">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-pink-100 text-xl text-[#b80049]">🔒</div>
            <h2 className="text-xl font-black text-slate-900">Access restricted</h2>
            <p className="mt-2 text-sm text-slate-600">
              This section is only available to fleet managers, administrators, and dispatchers.
            </p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-pink-700">
              Role required: {allowedRoles.join(", ")}
            </p>
          </div>
        </div>
      )
    );
  }

  return <>{children}</>;
}
