"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useHrAuth } from "../lib/hr-auth";

export default function AuthGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const { status } = useHrAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated" || status === "expired") {
      router.replace("/hrAuth");
    }
  }, [status, router]);

  if (status !== "authenticated") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex h-dvh w-full items-center justify-center bg-paper font-rethink text-ink dark:bg-ink dark:text-paper"
      >
        <div className="flex flex-col items-center gap-3">
          <span
            aria-hidden
            className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-accent motion-reduce:animate-none"
          />
          <p className="text-sm text-muted">
            {status === "expired"
              ? "Your session has expired. Redirecting you to sign in…"
              : "Checking your session…"}
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
