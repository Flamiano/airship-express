"use client";

// Save as: app/(spnc)/spnc/app/accounts/page.tsx  (same depth as audit-logs/page.tsx)
// Create Account in two steps:
//   1. Pick a role: two cards in the center (Admin / Employee)
//   2. Fill in the account details → POST /spnc/app/api/users (you stay logged in)
// After saving, it goes back to Employee Activity, which shows the new user.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  UserPlus,
  Loader2,
  CheckCircle2,
  Eye,
  EyeOff,
  X,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  UserRound,
  Check,
  Minus,
  Mail,
  Hash,
  KeyRound,
  Sparkles,
  Copy,
  ChevronLeft,
} from "lucide-react";
import { useShell } from "../../components/ShellContext";
import PageHeader from "../../components/PageHeader";
import { can, type Role } from "../../lib/rbac";

// Employee Activity page: its "Create Account" button opens this page, and after an
// account is created we go back there so the new user shows up in the list.
const EMPLOYEES_PATH = "/spnc/app/employees";

type RoleCard = {
  role: Role;
  title: string;
  tagline: string;
  icon: typeof ShieldCheck;
  access: { label: string; allowed: boolean }[];
};

const ROLE_CARDS: RoleCard[] = [
  {
    role: "admin",
    title: "Admin",
    tagline: "Full access, including Audit Logs and creating accounts.",
    icon: ShieldCheck,
    access: [
      { label: "Dashboard, providers, routes, rates, SOPs & schedules", allowed: true },
      { label: "Add service providers and rates", allowed: true },
      { label: "Audit Logs", allowed: true },
      { label: "Create accounts and assign roles", allowed: true },
    ],
  },
  {
    role: "employee",
    title: "Employee",
    tagline: "Standard access. No Audit Logs or account management.",
    icon: UserRound,
    access: [
      { label: "Dashboard, providers, routes, rates, SOPs & schedules", allowed: true },
      { label: "Add service providers and rates", allowed: false },
      { label: "Audit Logs", allowed: false },
      { label: "Create accounts and assign roles", allowed: false },
    ],
  },
];

// A readable temporary password: 12 characters, no look-alikes (0/O, 1/l/I)
function generatePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const symbols = "!@#$%*?";
  const bytes = new Uint32Array(12);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < 11; i++) out += chars[bytes[i] % chars.length];
  return out + symbols[bytes[11] % symbols.length];
}

export default function CreateAccountPage() {
  const router = useRouter();
  const { theme, role, roleLoading } = useShell();
  const isDark = theme === "dark";
  const authorized = !roleLoading && can(role, "users:create");

  const [step, setStep] = useState<"role" | "details">("role");
  const [newRole, setNewRole] = useState<Role | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (roleLoading) return;
    if (!role) router.replace("/spnc/app/login");
    else if (!can(role, "users:create")) router.replace("/spnc/app/dashboard");
  }, [role, roleLoading, router]);

  // Focus the first field when the form opens
  useEffect(() => {
    if (step === "details") nameRef.current?.focus();
  }, [step]);

  function chooseRole(r: Role) {
    setNewRole(r);
    setError(null);
    setStep("details");
  }

  async function copyPassword() {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — the user can still select it */
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !newRole) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/spnc/app/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName, email, id_number: idNumber, password, role: newRole }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || "Couldn't create the account.");
        return;
      }
      const user = data.user ?? { full_name: fullName, email, role: newRole };
      setNotice(`Created ${user.role} account for ${user.full_name} (${user.email}). Opening Employee Activity…`);
      setFullName("");
      setEmail("");
      setIdNumber("");
      setPassword("");
      // Back to Employee Activity, which shows a "created" message and the new user in the list
      const params = new URLSearchParams({
        created: String(user.full_name || user.email || ""),
        createdRole: String(user.role || ""),
      });
      window.setTimeout(() => router.push(`${EMPLOYEES_PATH}?${params.toString()}`), 1500);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!authorized) {
    return (
      <div className={`flex min-h-full flex-col items-center justify-center gap-3 py-24 ${isDark ? "bg-[#0B1220]" : "bg-white"}`}>
        <Loader2 size={32} className="animate-spin text-[#F2419B]" />
        <p className="text-sm font-semibold text-[#F2419B]">Loading</p>
      </div>
    );
  }

  const muted = isDark ? "text-[#8FA0AF]" : "text-gray-500";
  const strong = isDark ? "text-[#F2F1EC]" : "text-gray-900";
  const faint = isDark ? "text-[#4B5A68]" : "text-gray-400";
  const panel = isDark ? "border-[#23303D] bg-[#121B26]" : "border-gray-200 bg-white shadow-sm";
  const iconTile = isDark ? "bg-[#3A1229] text-[#F2419B]" : "bg-[#FDE7F2] text-[#D12C80]";
  const input = `w-full rounded-md border py-2.5 pl-10 pr-3 text-sm outline-none transition focus:ring-2 focus:ring-[#F2419B]/20 ${
    isDark
      ? "border-[#2C4356] bg-[#0B1220] text-[#F2F1EC] placeholder:text-[#4B5A68] focus:border-[#F2419B]"
      : "border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 focus:border-[#F2419B]"
  }`;
  const label = `mb-1.5 block text-xs font-semibold uppercase tracking-wide ${muted}`;
  const fieldIcon = `pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${faint}`;
  const selected = ROLE_CARDS.find((c) => c.role === newRole) ?? null;

  // Step indicator: 1 Choose role → 2 Account details
  const steps = [
    { n: 1, label: "Choose role", done: step === "details", active: step === "role" },
    { n: 2, label: "Account details", done: false, active: step === "details" },
  ];

  return (
    <div className={`min-h-full pb-24 ${isDark ? "bg-[#0B1220]" : "bg-white"}`}>
      <div className="px-8 pt-8">
        <PageHeader
          icon={<UserPlus size={20} />}
          title="Create Account"
          subtitle="Add a new user and choose what they can access"
          showThemeToggle={false}
        />
      </div>

      <div className="px-8 pt-6">
        <Link
          href={EMPLOYEES_PATH}
          className={`inline-flex items-center gap-1.5 text-sm font-medium transition hover:text-[#F2419B] ${muted}`}
        >
          <ArrowLeft size={16} />
          Back to Employee Activity
        </Link>

        {/* Steps */}
        <div className="mx-auto mt-6 flex max-w-md items-center justify-center gap-3">
          {steps.map((s, i) => (
            <div key={s.n} className="flex items-center gap-3">
              {i > 0 && <span className={`h-px w-10 ${s.active || s.done ? "bg-[#F2419B]" : isDark ? "bg-[#2C4356]" : "bg-gray-300"}`} />}
              <div className="flex items-center gap-2">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition ${
                    s.done
                      ? "bg-[#F2419B] text-white"
                      : s.active
                      ? "border-2 border-[#F2419B] text-[#F2419B]"
                      : isDark
                      ? "border border-[#2C4356] text-[#8FA0AF]"
                      : "border border-gray-300 text-gray-400"
                  }`}
                >
                  {s.done ? <Check size={14} /> : s.n}
                </span>
                <span className={`text-sm font-medium ${s.active || s.done ? strong : muted}`}>{s.label}</span>
              </div>
            </div>
          ))}
        </div>

        {step === "role" ? (
          /* ---------- Step 1: two role cards in the center ---------- */
          <div className="mx-auto mt-8 max-w-3xl">
            <div className="mb-6 text-center">
              <h2 className={`text-xl font-semibold ${strong}`} style={{ fontFamily: "var(--font-display)" }}>
                What kind of account is this?
              </h2>
              <p className={`mt-1 text-sm ${muted}`}>Pick a role. You can change it before saving.</p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              {ROLE_CARDS.map((card) => {
                const Icon = card.icon;
                const isSel = newRole === card.role;
                return (
                  <button
                    key={card.role}
                    type="button"
                    onClick={() => chooseRole(card.role)}
                    aria-pressed={isSel}
                    className={`group relative flex flex-col rounded-2xl border p-6 text-left transition hover:-translate-y-0.5 hover:border-[#F2419B] hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2419B]/40 ${
                      isSel ? "border-[#F2419B] ring-2 ring-[#F2419B]/25" : ""
                    } ${panel}`}
                  >
                    {isSel && (
                      <span className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-[#F2419B] text-white">
                        <Check size={14} />
                      </span>
                    )}
                    <span className={`flex h-14 w-14 items-center justify-center rounded-xl transition group-hover:scale-105 ${iconTile}`}>
                      <Icon size={28} />
                    </span>
                    <span className={`mt-4 text-lg font-semibold ${strong}`} style={{ fontFamily: "var(--font-display)" }}>
                      {card.title}
                    </span>
                    <span className={`mt-1 text-sm ${muted}`}>{card.tagline}</span>

                    <ul className={`mt-5 space-y-2 border-t pt-4 ${isDark ? "border-[#23303D]" : "border-gray-100"}`}>
                      {card.access.map((a) => (
                        <li key={a.label} className="flex items-start gap-2 text-sm">
                          {a.allowed ? (
                            <Check size={16} className={`mt-0.5 shrink-0 ${isDark ? "text-emerald-400" : "text-emerald-600"}`} />
                          ) : (
                            <Minus size={16} className={`mt-0.5 shrink-0 ${faint}`} />
                          )}
                          <span className={a.allowed ? (isDark ? "text-[#C7D1DA]" : "text-gray-700") : `${faint} line-through`}>{a.label}</span>
                        </li>
                      ))}
                    </ul>

                    <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-[#F2419B]">
                      Continue as {card.title}
                      <ArrowRight size={16} className="transition group-hover:translate-x-1" />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          /* ---------- Step 2: account details ---------- */
          <form onSubmit={handleSubmit} className={`mx-auto mt-8 max-w-lg rounded-2xl border p-6 ${panel}`}>
            {/* Chosen role */}
            {selected && (
              <div
                className={`mb-6 flex items-center gap-3 rounded-xl border p-3 ${
                  isDark ? "border-[#F2419B]/30 bg-[#F2419B]/5" : "border-[#F2419B]/30 bg-[#FDE7F2]/50"
                }`}
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconTile}`}>
                  <selected.icon size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold ${strong}`}>{selected.title} account</p>
                  <p className={`truncate text-xs ${muted}`}>{selected.tagline}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setStep("role")}
                  disabled={busy}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-[#F2419B] transition hover:bg-[#F2419B]/10 disabled:opacity-50"
                >
                  <ChevronLeft size={14} />
                  Change
                </button>
              </div>
            )}

            {notice && (
              <div className="mb-5 flex items-center gap-2 rounded-lg border border-[#1FA968]/40 bg-[#1FA968]/10 px-3 py-2.5 text-sm text-[#1FA968]">
                <CheckCircle2 size={16} className="shrink-0" />
                <span className="flex-1">{notice}</span>
                <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss" className="rounded p-0.5 hover:bg-[#1FA968]/15">
                  <X size={14} />
                </button>
              </div>
            )}
            {error && (
              <div className="mb-5 rounded-md border border-[#E2685A]/40 bg-[#E2685A]/10 px-3 py-2 text-sm text-[#E2685A]">{error}</div>
            )}

            <div className="space-y-4">
              <div>
                <label htmlFor="full_name" className={label}>Full name</label>
                <div className="relative">
                  <UserRound size={16} className={fieldIcon} />
                  <input
                    ref={nameRef}
                    id="full_name"
                    className={input}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    autoComplete="off"
                    placeholder="e.g. Juan Dela Cruz"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="email" className={label}>Email</label>
                <div className="relative">
                  <Mail size={16} className={fieldIcon} />
                  <input
                    id="email"
                    type="email"
                    className={input}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="off"
                    placeholder="name@company.com"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="id_number" className={label}>
                  Employee ID <span className="normal-case tracking-normal">(Required)</span>
                </label>
                <div className="relative">
                  <Hash size={16} className={fieldIcon} />
                  <input
                    id="id_number"
                    className={input}
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value)}
                    autoComplete="off"
                    placeholder="e.g. AE130292352"
                  />
                </div>
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label htmlFor="password" className={`${label} mb-0`}>Temporary password</label>
                  <button
                    type="button"
                    onClick={() => {
                      setPassword(generatePassword());
                      setShowPassword(true);
                    }}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#F2419B] hover:underline"
                  >
                    <Sparkles size={13} />
                    Generate
                  </button>
                </div>
                <div className="relative">
                  <KeyRound size={16} className={fieldIcon} />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    className={`${input} pr-20`}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={8}
                    required
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                  />
                  <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
                    <button
                      type="button"
                      onClick={copyPassword}
                      disabled={!password}
                      aria-label="Copy password"
                      title={copied ? "Copied" : "Copy"}
                      className={`rounded p-1.5 transition disabled:opacity-40 ${copied ? "text-emerald-500" : `${muted} hover:text-[#F2419B]`}`}
                    >
                      {copied ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className={`rounded p-1.5 ${muted} hover:text-[#F2419B]`}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                {password && password.length < 8 && (
                  <p className="mt-1.5 text-xs text-[#E2685A]">{8 - password.length} more character(s) needed.</p>
                )}
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => setStep("role")}
                disabled={busy}
                className={`flex items-center justify-center gap-1.5 rounded-lg border px-4 py-2.5 text-sm font-medium transition disabled:opacity-50 ${
                  isDark ? "border-[#2C4356] text-[#C7D1DA] hover:bg-[#1A2530]" : "border-gray-300 text-gray-600 hover:bg-gray-100"
                }`}
              >
                <ArrowLeft size={16} />
                Back
              </button>
              <button
                type="submit"
                disabled={busy || !!notice}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#F2419B] py-2.5 text-sm font-semibold text-white transition hover:bg-[#F55CAB] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                {busy ? "Creating…" : `Create ${selected ? selected.title.toLowerCase() : ""} account`}
              </button>
            </div>
            <p className={`mt-3 flex items-center justify-center gap-1.5 text-center text-xs ${muted}`}>
              <ShieldCheck size={13} />
              Share the temporary password with the user securely.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}