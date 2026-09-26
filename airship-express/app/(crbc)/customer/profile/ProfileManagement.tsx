"use client";

import { useState } from "react";
import { Copy, Check, Hash, Mail, Phone, MapPin } from "lucide-react";
import Link from "next/link";

type Props = {
  customer_id: string;
  full_name: string;
  phone: string | null | undefined;
  address: string | null | undefined;
  email: string | null | undefined;
};

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

function Field({
  icon: Icon,
  label,
  value,
  mono = false,
}: {
  icon: React.ElementType;
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="group flex items-start gap-3 py-4">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-muted">{label}</p>
        <p
          className={`mt-0.5 truncate text-sm ${
            value ? "text-foreground" : "text-muted/60"
          } ${mono ? "font-mono" : ""}`}
        >
          {value ?? "Not provided"}
        </p>
      </div>
      {value && (
        <button
          type="button"
          onClick={handleCopy}
          aria-label={`Copy ${label.toLowerCase()}`}
          className="shrink-0 rounded-md p-1.5 text-muted opacity-0 transition-opacity hover:bg-line/50 hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-accent" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
      )}
    </div>
  );
}

export default function ProfileManagement({
  customer_id,
  full_name,
  phone,
  address,
  email,
}: Props) {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-start justify-center bg-background p-4 py-12 sm:py-16">
      <div className="w-full max-w-xl">
        {/* Identity header */}
        <div className="mb-8 flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xl font-semibold text-accent">
            {getInitials(full_name) || "?"}
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold text-foreground">
              {full_name}
            </h1>
            <p className="mt-0.5 text-sm text-muted">Your profile</p>
          </div>
        </div>

        {/* Details panel */}
        <div className="rounded-xl border border-line">
          <div className="divide-y divide-line px-6">
            <Field icon={Hash} label="Customer ID" value={customer_id} mono />
            <Field icon={Mail} label="Email" value={email} />
            <Field icon={Phone} label="Phone" value={phone} />
            <Field icon={MapPin} label="Address" value={address} />
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted">
          Want to update these details?{" "}
          <Link href="/customer/settings" className="text-accent hover:underline">
            Go to settings
          </Link>
        </p>
      </div>
    </div>
  );
}