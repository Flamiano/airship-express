"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ClipboardList,
  Loader2,
  Package,
  Plus,
  Search,
  Send,
  UserRound,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  CHANNEL_LABELS,
  type InteractionChannel,
  type PackageType,
} from "../../types/booking-request";
import { formatPhoneNumber } from "../../library/utils/formatPhoneNumber";
import {
  isValidPhone,
  normalizePhone,
} from "../../library/validation/customer.data.validate";

interface CustomerSearchResult {
  id: string;
  customer_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  role: string;
  created_at: string;
}

interface BookingRequestDraft {
  customer_id?: string;
  new_customer?: {
    full_name: string;
    customer_type: string;
    email?: string;
    phone?: string;
    address?: string;
  };
  request_channel: InteractionChannel;
  receiver_name: string;
  receiver_contact?: string;
  receiver_address: string;
  package_quantity: number;
  package_type: PackageType;
  item_category?: string;
  weight?: number;
  dimensions?: {
    length_cm: number;
    width_cm: number;
    height_cm: number;
  };
  declared_value?: number;
  airship_packaging_requested: boolean;
  remarks?: string;
}


const STEPS = [
  { number: 1, title: "Sender" },
  { number: 2, title: "Receiver" },
  { number: 3, title: "Package" },
  { number: 4, title: "Review" },
] as const;

type SenderState = {
  mode: "search" | "new";
  selected: CustomerSearchResult | null;
  newCustomer: {
    full_name: string;
    customer_type: string;
    phone: string;
    address: string;
  };
  channel: InteractionChannel;
};

type ReceiverState = {
  name: string;
  contact: string;
  address: string;
};

type PackageState = {
  quantity: number;
  type: PackageType;
  item_category: string;
  weight: string;
  dim_length: string;
  dim_width: string;
  dim_height: string;
  declared_value: string;
  airship_packaging_requested: boolean;
  remarks: string;
};

type WizardState = {
  sender: SenderState;
  receiver: ReceiverState;
  package: PackageState;
};

const ITEM_CATEGORIES = [
  "Parcel",
  "Documents",
  "Clothing",
  "Electronics",
  "Fragile Items",
  "Food / Perishables",
  "Books",
  "Other",
] as const;

const PACKAGE_TYPES: { value: PackageType; label: string }[] = [
  { value: "box", label: "Box" },
  { value: "parcel", label: "Parcel" },
  { value: "document", label: "Document" },
];

const CUSTOMER_TYPES = ["Individual", "Business"] as const;

// CRM intake covers walk-in and phone-call customers only. Portal customers
// request through the separate customer portal, so PORTAL is not offered here.
const CRM_CHANNELS: InteractionChannel[] = ["WALK_IN", "PHONE_CALL"];

const MIN_SEARCH_LENGTH = 2;
const DEBOUNCE_MS = 300;

const initialWizardState: WizardState = {
  sender: {
    mode: "search",
    selected: null,
    newCustomer: {
      full_name: "",
      customer_type: "Individual",
      phone: "",
      address: "",
    },
    channel: "WALK_IN",
  },
  receiver: { name: "", contact: "", address: "" },
  package: {
    quantity: 1,
    type: "box",
    item_category: "Parcel",
    weight: "",
    dim_length: "",
    dim_width: "",
    dim_height: "",
    declared_value: "",
    airship_packaging_requested: false,
    remarks: "",
  },
};

/* ------------------------------------------------------------------ */
/* Shared styles                                                       */
/* ------------------------------------------------------------------ */

const inputBase =
  "w-full text-sm border border-line bg-paper text-foreground placeholder-muted/70 rounded-lg px-3 py-2.5 outline-none transition-colors focus:border-accent focus:ring-4 focus:ring-accent/15";

const labelCls = "text-xs font-medium text-muted block";
const requiredMark = <span className="text-accent">*</span>;

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <Icon size={14} />
      </span>
      <div>
        <p className="text-[13px] font-semibold text-foreground">{title}</p>
        {subtitle && <p className="text-[11px] text-muted">{subtitle}</p>}
      </div>
    </div>
  );
}

function RadioOption({
  name,
  value,
  current,
  onChange,
  label,
}: {
  name: string;
  value: string;
  current: string;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
        current === value
          ? "border-accent/40 bg-accent/5 text-foreground"
          : "border-line bg-paper text-muted hover:border-muted/50 hover:text-foreground"
      }`}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={current === value}
        onChange={() => onChange(value)}
        className="h-3.5 w-3.5 accent-(--accent)/50"
      />
      {label}
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Progress indicator                                                  */
/* ------------------------------------------------------------------ */

function ProgressIndicator({ current }: { current: number }) {
  return (
    <ol className="flex items-center justify-center gap-1.5">
      {STEPS.map((step, index) => {
        const isCurrent = step.number === current;
        const isDone = step.number < current;

        return (
          <li key={step.number} className="flex items-center gap-1.5">
            {index > 0 && (
              <span
                className={`h-px w-4 sm:w-8 ${isDone || isCurrent ? "bg-accent/50" : "bg-line"}`}
              />
            )}
            <span
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                isCurrent
                  ? "bg-accent text-white"
                  : isDone
                    ? "bg-accent/10 text-accent"
                    : "bg-paper text-muted border border-line"
              }`}
            >
              <span
                className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
                  isCurrent
                    ? "bg-white/20"
                    : isDone
                      ? "bg-accent text-white"
                      : "bg-line text-muted"
                }`}
              >
                {isDone ? <Check size={10} /> : step.number}
              </span>
              <span className="hidden sm:inline">{step.title}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------------------ */
/* Review row helper                                                   */
/* ------------------------------------------------------------------ */

function ReviewRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="text-xs text-muted shrink-0">{label}</span>
      <span className="text-sm text-foreground text-right">{value}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main wizard                                                         */
/* ------------------------------------------------------------------ */

export default function NewBookingRequestWizard({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const dialogId = useId();

  const [step, setStep] = useState(1);
  const [wizard, setWizard] = useState<WizardState>(initialWizardState);

  // Step 1 search state
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState<CustomerSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [stepError, setStepError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [submittedRequestId, setSubmittedRequestId] = useState<string | null>(
    null
  );

  const reset = () => {
    setStep(1);
    setWizard(initialWizardState);
    setSearchQuery("");
    setDebouncedQuery("");
    setResults([]);
    setSearchError(null);
    setStepError(null);
    setSubmittedRequestId(null);
  };

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      reset();
      document.getElementById("wizard-first-field")?.focus();
    }, 0);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const patchSender = (patch: Partial<SenderState>) =>
    setWizard((w) => ({ ...w, sender: { ...w.sender, ...patch } }));
  const patchReceiver = (patch: Partial<ReceiverState>) =>
    setWizard((w) => ({ ...w, receiver: { ...w.receiver, ...patch } }));
  const patchPackage = (patch: Partial<PackageState>) =>
    setWizard((w) => ({ ...w, package: { ...w.package, ...patch } }));

  /* ---------------- Step 1: customer search ---------------- */

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    const q = value.trim();

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    if (q.length < MIN_SEARCH_LENGTH) {
      setDebouncedQuery("");
      setResults([]);
      setIsSearching(false);
      return;
    }

    searchDebounceRef.current = setTimeout(
      () => setDebouncedQuery(q),
      DEBOUNCE_MS
    );
  };

  useEffect(() => {
    if (!debouncedQuery) return;

    let cancelled = false;
    const runSearch = async () => {
      setIsSearching(true);
      await Promise.resolve();
      try {
        const response = await fetch(`/api/customers/search?q=${encodeURIComponent(debouncedQuery)}`);
        const data = await response.json();
        if (cancelled) return;
        if (!data.success) {
          setSearchError(data.error || "Search failed");
          setResults([]);
        } else {
          setResults(data.data);
        }
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    };

    void runSearch();

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  const senderReady =
    wizard.sender.mode === "search"
      ? !!wizard.sender.selected
      : !!wizard.sender.newCustomer.full_name.trim();

  /* ---------------- Per-step validation ---------------- */

  const validateStep = (target: number): string | null => {
    switch (target) {
      case 2: {
        if (!senderReady) {
          return "Select an existing customer or complete the new customer form.";
        }
        if (wizard.sender.mode === "new") {
          const { phone } = wizard.sender.newCustomer;
          if (phone && !isValidPhone(phone)) {
            return "Enter a valid Philippine mobile number (e.g., 09171234567).";
          }
        }
        return null;
      }
      case 3: {
        const r = wizard.receiver;
        if (!r.name.trim()) return "Receiver name is required.";
        if (!r.address.trim()) return "Receiver address is required.";
        if (r.contact.trim() && !isValidPhone(r.contact)) {
          return "Enter a valid Philippine mobile number for the receiver.";
        }
        return null;
      }
      case 4: {
        const p = wizard.package;
        if (!Number.isInteger(p.quantity) || p.quantity < 1) {
          return "Package quantity must be at least 1.";
        }
        if (p.weight && parseFloat(p.weight) <= 0) {
          return "Weight must be greater than zero.";
        }
        if (p.declared_value && parseFloat(p.declared_value) < 0) {
          return "Declared value cannot be negative.";
        }
        const dims = [p.dim_length, p.dim_width, p.dim_height];
        if (dims.some((d) => d && parseFloat(d) <= 0)) {
          return "Dimensions must be greater than zero.";
        }
        return null;
      }
      default:
        return null;
    }
  };

  const goNext = () => {
    const error = validateStep(step + 1);
    if (error) {
      setStepError(error);
      return;
    }
    setStepError(null);
    setStep((s) => Math.min(4, s + 1));
  };

  const goBack = () => {
    setStepError(null);
    setStep((s) => Math.max(1, s - 1));
  };

  const handleSelectCustomer = (customer: CustomerSearchResult) => {
    patchSender({ mode: "search", selected: customer });
    setSearchError(null);
  };

  /* ---------------- Submission ---------------- */

  const buildDraft = (): BookingRequestDraft => {
    const p = wizard.package;
    const dims =
      p.dim_length && p.dim_width && p.dim_height
        ? {
            length_cm: parseFloat(p.dim_length),
            width_cm: parseFloat(p.dim_width),
            height_cm: parseFloat(p.dim_height),
          }
        : undefined;

    return {
      customer_id: wizard.sender.selected?.id,
      new_customer:
        wizard.sender.mode === "new"
          ? {
              full_name: wizard.sender.newCustomer.full_name,
              customer_type: wizard.sender.newCustomer.customer_type,
              phone: wizard.sender.newCustomer.phone
                ? normalizePhone(wizard.sender.newCustomer.phone)
                : undefined,
              address: wizard.sender.newCustomer.address || undefined,
            }
          : undefined,
      request_channel: wizard.sender.channel,
      receiver_name: wizard.receiver.name,
      receiver_contact: wizard.receiver.contact
        ? normalizePhone(wizard.receiver.contact)
        : undefined,
      receiver_address: wizard.receiver.address,
      package_quantity: p.quantity,
      package_type: p.type,
      item_category: p.item_category,
      weight: p.weight ? parseFloat(p.weight) : undefined,
      dimensions: dims,
      declared_value: p.declared_value
        ? parseFloat(p.declared_value)
        : undefined,
      airship_packaging_requested: p.airship_packaging_requested,
      remarks: p.remarks || undefined,
    };
  };

  const handleSubmit = (): void => {
    // Re-validate every step before submitting.
    for (const target of [2, 3, 4]) {
      const error = validateStep(target);
      if (error) {
        setStepError(error);
        setStep(target - 1);
        return;
      }
    }

    startTransition(async () => {
      const response = await fetch("/api/booking-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildDraft()),
      });
      const data = await response.json();

      if (!data.success) {
        setStepError(data.error || "Failed to create booking request");
        return;
      }

      setSubmittedRequestId(data.request_id ?? null);
      router.refresh();
    });
  };

  if (!open) return null;

  /* ---------------- Success screen ---------------- */

  if (submittedRequestId) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto"
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={dialogId}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md bg-background border border-line rounded-2xl shadow-xl p-8 text-center"
        >
          <CheckCircle2 size={40} className="mx-auto text-green-500" />
          <h2
            id={dialogId}
            className="mt-4 text-base font-semibold font-bricolage text-foreground"
          >
            Booking Request Submitted
          </h2>
          <p className="mt-2 text-sm text-muted">
            Request{" "}
            <span className="font-mono font-medium text-accent">
              {submittedRequestId}
            </span>{" "}
            is now pending with Freight Operations.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-6 w-full cursor-pointer rounded-lg bg-accent/70 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-dark"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  /* ---------------- Modal shell ---------------- */

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-black/50 overflow-y-auto"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogId}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl bg-background border border-line rounded-2xl shadow-xl my-4 sm:my-8"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-line">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ClipboardList size={18} />
            </span>
            <div>
              <h2
                id={dialogId}
                className="text-foreground text-base font-semibold font-bricolage"
              >
                New Booking Request
              </h2>
              <p className="text-xs text-muted mt-0.5">
                Step {step} of 4 ·{" "}
                {STEPS[step - 1].title}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-muted hover:text-foreground hover:bg-paper rounded-md p-1 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Progress indicator */}
        <div className="px-5 pt-4">
          <ProgressIndicator current={step} />
        </div>

        <div className="px-5 py-5 max-h-[60vh] overflow-y-auto">
          {/* ============ STEP 1: SENDER ============ */}
          {step === 1 && (
            <div className="space-y-5">
              {/* Mode toggle */}
              <div className="grid grid-cols-2 gap-2 rounded-lg bg-paper p-1 border border-line">
                {(
                  [
                    { value: "search", label: "Existing Customer" },
                    { value: "new", label: "New Customer" },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => {
                      patchSender({ mode: m.value });
                      setStepError(null);
                    }}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                      wizard.sender.mode === m.value
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted hover:text-foreground"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {/* Existing customer search */}
              {wizard.sender.mode === "search" &&
                (wizard.sender.selected ? (
                  <div className="space-y-3 rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/30">
                    <div className="flex items-start justify-between gap-3">
                      <SectionHeader
                        icon={UserRound}
                        title="Selected Customer"
                        subtitle="Reusing this customer record"
                      />
                      <button
                        type="button"
                        onClick={() => patchSender({ selected: null })}
                        className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-accent hover:bg-accent/10 transition-colors cursor-pointer"
                      >
                        Change
                      </button>
                    </div>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <div>
                        <dt className="text-[11px] text-muted">Customer ID</dt>
                        <dd className="font-mono text-accent">
                          {wizard.sender.selected.customer_id}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] text-muted">Full Name</dt>
                        <dd className="text-foreground truncate">
                          {wizard.sender.selected.full_name}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] text-muted">Phone</dt>
                        <dd className="text-foreground">
                          {wizard.sender.selected.phone
                            ? formatPhoneNumber(wizard.sender.selected.phone)
                            : "-"}
                        </dd>
                      </div>
                    </dl>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <SectionHeader
                      icon={Search}
                      title="Search Customer"
                      subtitle="Search by name, Customer ID, phone, or email"
                    />
                    <div className="relative">
                      <Search
                        size={15}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted/60"
                      />
                      <input
                        id="wizard-first-field"
                        type="text"
                        value={searchQuery}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        placeholder="Search by name, Customer ID, phone, or email"
                        autoComplete="off"
                        className={`${inputBase} pl-9`}
                      />
                    </div>

                    {isSearching && (
                      <p className="flex items-center gap-1.5 text-xs text-muted px-1">
                        <Loader2 size={12} className="animate-spin" />{" "}
                        Searching…
                      </p>
                    )}
                    {searchError && (
                      <p className="text-xs text-red-600 px-1">{searchError}</p>
                    )}
                    {!isSearching &&
                      !searchError &&
                      searchQuery.trim().length >= MIN_SEARCH_LENGTH &&
                      results.length === 0 && (
                        <p className="text-xs text-muted px-1">
                          No existing customer found. Switch to{" "}
                          <button
                            type="button"
                            onClick={() => patchSender({ mode: "new" })}
                            className="text-accent underline cursor-pointer"
                          >
                            New Customer
                          </button>{" "}
                          to create one.
                        </p>
                      )}

                    {results.length > 0 && (
                      <ul className="divide-y divide-line rounded-xl border border-line overflow-hidden">
                        {results.map((customer) => (
                          <li
                            key={customer.id}
                            className="flex items-center justify-between gap-3 px-3.5 py-3 bg-paper hover:bg-accent/5 transition-colors"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">
                                {customer.full_name}
                              </p>
                              <p className="text-xs text-muted truncate">
                                {customer.customer_id} ·{" "}
                                {customer.phone
                                  ? formatPhoneNumber(customer.phone)
                                  : "No phone"}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleSelectCustomer(customer)}
                              className="shrink-0 rounded-md border border-accent/40 px-2.5 py-1 text-xs font-medium text-accent hover:bg-accent/10 transition-colors cursor-pointer"
                            >
                              Select
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}

              {/* New customer form — customer identity fields ONLY */}
              {wizard.sender.mode === "new" && (
                <div className="space-y-3">
                  <SectionHeader
                    icon={Plus}
                    title="New Customer"
                    subtitle="Customer information only"
                  />
                  <div className="space-y-1.5">
                    <label htmlFor="nc-name" className={labelCls}>
                      Full Name {requiredMark}
                    </label>
                    <input
                      id="nc-name"
                      type="text"
                      value={wizard.sender.newCustomer.full_name}
                      onChange={(e) =>
                        patchSender({
                          newCustomer: {
                            ...wizard.sender.newCustomer,
                            full_name: e.target.value,
                          },
                        })
                      }
                      placeholder="Enter full name"
                      autoComplete="off"
                      className={inputBase}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="nc-type" className={labelCls}>
                      Customer Type {requiredMark}
                    </label>
                    <select
                      id="nc-type"
                      value={wizard.sender.newCustomer.customer_type}
                      onChange={(e) =>
                        patchSender({
                          newCustomer: {
                            ...wizard.sender.newCustomer,
                            customer_type: e.target.value,
                          },
                        })
                      }
                      className={inputBase}
                    >
                      {CUSTOMER_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="nc-phone" className={labelCls}>
                      Phone
                    </label>
                    <input
                      id="nc-phone"
                      type="text"
                      value={wizard.sender.newCustomer.phone}
                      onChange={(e) =>
                        patchSender({
                          newCustomer: {
                            ...wizard.sender.newCustomer,
                            phone: e.target.value,
                          },
                        })
                      }
                      placeholder="09XXXXXXXXX"
                      autoComplete="off"
                      className={inputBase}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="nc-address" className={labelCls}>
                      Address
                    </label>
                    <input
                      id="nc-address"
                      type="text"
                      value={wizard.sender.newCustomer.address}
                      onChange={(e) =>
                        patchSender({
                          newCustomer: {
                            ...wizard.sender.newCustomer,
                            address: e.target.value,
                          },
                        })
                      }
                      placeholder="Street, barangay, city"
                      autoComplete="off"
                      className={inputBase}
                    />
                  </div>
                </div>
              )}

              {/* Interaction channel — transactional, not customer identity.
                  Portal customers come through the customer portal, not CRM. */}
              <div className="space-y-2 rounded-xl border border-line bg-paper/50 p-4">
                <SectionHeader
                  icon={Send}
                  title="Request Channel"
                  subtitle="How did the customer submit this request?"
                />
                <div className="grid grid-cols-2 gap-2">
                  {CRM_CHANNELS.map((ch) => (
                    <RadioOption
                      key={ch}
                      name="interaction-channel"
                      value={ch}
                      current={wizard.sender.channel}
                      onChange={(v) =>
                        patchSender({ channel: v as InteractionChannel })
                      }
                      label={CHANNEL_LABELS[ch]}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ============ STEP 2: RECEIVER ============ */}
          {step === 2 && (
            <div className="space-y-3">
              <SectionHeader
                icon={UserRound}
                title="Receiver Information"
                subtitle="Where is this shipment going?"
              />
              <div className="space-y-1.5">
                <label htmlFor="rc-name" className={labelCls}>
                  Receiver Name {requiredMark}
                </label>
                <input
                  id="rc-name"
                  type="text"
                  value={wizard.receiver.name}
                  onChange={(e) =>
                    patchReceiver({ name: e.target.value })
                  }
                  placeholder="Full name of recipient"
                  autoComplete="off"
                  className={inputBase}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="rc-contact" className={labelCls}>
                  Receiver Contact
                </label>
                <input
                  id="rc-contact"
                  type="text"
                  value={wizard.receiver.contact}
                  onChange={(e) =>
                    patchReceiver({ contact: e.target.value })
                  }
                  placeholder="09XXXXXXXXX"
                  autoComplete="off"
                  className={inputBase}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="rc-address" className={labelCls}>
                  Receiver Address {requiredMark}
                </label>
                <textarea
                  id="rc-address"
                  value={wizard.receiver.address}
                  onChange={(e) =>
                    patchReceiver({ address: e.target.value })
                  }
                  placeholder="House/unit no., street, barangay, city, province"
                  autoComplete="off"
                  rows={2}
                  className={`${inputBase} resize-none`}
                />
              </div>
              <p className="text-[11px] text-muted">
                Receiver details belong to this booking request only — they are
                never saved to the customer record.
              </p>
            </div>
          )}

          {/* ============ STEP 3: PACKAGE ============ */}
          {step === 3 && (
            <div className="space-y-3">
              <SectionHeader
                icon={Package}
                title="Package Details"
                subtitle="Help us handle this shipment correctly"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="pkg-qty" className={labelCls}>
                    Package Quantity {requiredMark}
                  </label>
                  <input
                    id="pkg-qty"
                    type="number"
                    min={1}
                    step={1}
                    value={wizard.package.quantity}
                    onChange={(e) =>
                      patchPackage({
                        quantity: Math.max(
                          1,
                          parseInt(e.target.value) || 1
                        ),
                      })
                    }
                    className={inputBase}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="pkg-type" className={labelCls}>
                    Package Type {requiredMark}
                  </label>
                  <select
                    id="pkg-type"
                    value={wizard.package.type}
                    onChange={(e) =>
                      patchPackage({
                        type: e.target.value as PackageType,
                      })
                    }
                    className={inputBase}
                  >
                    {PACKAGE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="pkg-category" className={labelCls}>
                    Item Category {requiredMark}
                  </label>
                  <select
                    id="pkg-category"
                    value={wizard.package.item_category}
                    onChange={(e) =>
                      patchPackage({ item_category: e.target.value })
                    }
                    className={inputBase}
                  >
                    {ITEM_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="pkg-weight" className={labelCls}>
                    Weight (kg)
                  </label>
                  <input
                    id="pkg-weight"
                    type="number"
                    min={0}
                    step="0.01"
                    value={wizard.package.weight}
                    onChange={(e) => patchPackage({ weight: e.target.value })}
                    placeholder="0.00"
                    className={inputBase}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className={labelCls}>Dimensions (cm)</label>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    aria-label="Length in centimeters"
                    type="number"
                    min={0}
                    step="0.1"
                    value={wizard.package.dim_length}
                    onChange={(e) =>
                      patchPackage({ dim_length: e.target.value })
                    }
                    placeholder="L"
                    className={inputBase}
                  />
                  <input
                    aria-label="Width in centimeters"
                    type="number"
                    min={0}
                    step="0.1"
                    value={wizard.package.dim_width}
                    onChange={(e) =>
                      patchPackage({ dim_width: e.target.value })
                    }
                    placeholder="W"
                    className={inputBase}
                  />
                  <input
                    aria-label="Height in centimeters"
                    type="number"
                    min={0}
                    step="0.1"
                    value={wizard.package.dim_height}
                    onChange={(e) =>
                      patchPackage({ dim_height: e.target.value })
                    }
                    placeholder="H"
                    className={inputBase}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="pkg-value" className={labelCls}>
                  Declared Value (₱)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">
                    ₱
                  </span>
                  <input
                    id="pkg-value"
                    type="number"
                    min={0}
                    step="0.01"
                    value={wizard.package.declared_value}
                    onChange={(e) =>
                      patchPackage({ declared_value: e.target.value })
                    }
                    placeholder="0.00"
                    className={`${inputBase} pl-8`}
                  />
                </div>
              </div>

              {/* Exact spec wording: Airship Xpress Packaging */}
              <div className="space-y-2">
                <label className={labelCls}>Airship Xpress Packaging</label>
                <p className="text-xs text-muted">
                  Would you like Airship Xpress to provide the packaging?
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <RadioOption
                    name="airship-packaging"
                    value="yes"
                    current={
                      wizard.package.airship_packaging_requested ? "yes" : "no"
                    }
                    onChange={(v) =>
                      patchPackage({
                        airship_packaging_requested: v === "yes",
                      })
                    }
                    label="Yes"
                  />
                  <RadioOption
                    name="airship-packaging"
                    value="no"
                    current={
                      wizard.package.airship_packaging_requested ? "yes" : "no"
                    }
                    onChange={(v) =>
                      patchPackage({
                        airship_packaging_requested: v === "yes",
                      })
                    }
                    label="No"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="pkg-remarks" className={labelCls}>
                  Remarks
                </label>
                <textarea
                  id="pkg-remarks"
                  value={wizard.package.remarks}
                  onChange={(e) => patchPackage({ remarks: e.target.value })}
                  placeholder="Special handling instructions (optional)"
                  rows={2}
                  maxLength={500}
                  className={`${inputBase} resize-none`}
                />
                <p className="text-right text-[11px] text-muted">
                  {wizard.package.remarks.length}/500
                </p>
              </div>
            </div>
          )}

          {/* ============ STEP 4: REVIEW ============ */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="rounded-xl border border-line bg-paper/50 p-4">
                <SectionHeader
                  icon={UserRound}
                  title="Sender"
                  subtitle={CHANNEL_LABELS[wizard.sender.channel]}
                />
                {wizard.sender.selected ? (
                  <div className="mt-3">
                    <ReviewRow
                      label="Name"
                      value={wizard.sender.selected.full_name}
                    />
                    <ReviewRow
                      label="Customer ID"
                      value={
                        <span className="font-mono text-accent">
                          {wizard.sender.selected.customer_id}
                        </span>
                      }
                    />
                    <ReviewRow
                      label="Phone"
                      value={
                        wizard.sender.selected.phone
                          ? formatPhoneNumber(wizard.sender.selected.phone)
                          : "-"
                      }
                    />
                  </div>
                ) : (
                  <div className="mt-3">
                    <ReviewRow
                      label="Name"
                      value={wizard.sender.newCustomer.full_name}
                    />
                    <ReviewRow
                      label="Customer Type"
                      value={wizard.sender.newCustomer.customer_type}
                    />
                    <ReviewRow
                      label="New Customer"
                      value="Will be created on submit"
                    />
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-line bg-paper/50 p-4">
                <SectionHeader
                  icon={UserRound}
                  title="Receiver"
                />
                <div className="mt-3">
                  <ReviewRow label="Name" value={wizard.receiver.name} />
                  <ReviewRow
                    label="Contact"
                    value={
                      wizard.receiver.contact
                        ? formatPhoneNumber(wizard.receiver.contact)
                        : "-"
                    }
                  />
                  <ReviewRow
                    label="Address"
                    value={wizard.receiver.address}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-line bg-paper/50 p-4">
                <SectionHeader icon={Package} title="Package" />
                <div className="mt-3">
                  <ReviewRow label="Quantity" value={wizard.package.quantity} />
                  <ReviewRow
                    label="Package Type"
                    value={
                      PACKAGE_TYPES.find(
                        (t) => t.value === wizard.package.type
                      )?.label ?? wizard.package.type
                    }
                  />
                  <ReviewRow
                    label="Item Category"
                    value={wizard.package.item_category}
                  />
                  <ReviewRow
                    label="Weight"
                    value={
                      wizard.package.weight ? `${wizard.package.weight} kg` : "-"
                    }
                  />
                  <ReviewRow
                    label="Dimensions"
                    value={
                      wizard.package.dim_length &&
                      wizard.package.dim_width &&
                      wizard.package.dim_height
                        ? `${wizard.package.dim_length} × ${wizard.package.dim_width} × ${wizard.package.dim_height} cm`
                        : "-"
                    }
                  />
                  <ReviewRow
                    label="Declared Value"
                    value={
                      wizard.package.declared_value
                        ? `₱${parseFloat(wizard.package.declared_value).toLocaleString("en-PH")}`
                        : "-"
                    }
                  />
                  <ReviewRow
                    label="Airship Xpress Packaging"
                    value={wizard.package.airship_packaging_requested ? "Yes" : "No"}
                  />
                  <ReviewRow
                    label="Remarks"
                    value={wizard.package.remarks || "-"}
                  />
                </div>
              </div>

            {/*No price yet for now*/}
            </div>
          )}

          {stepError && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
              {stepError}
            </div>
          )}
        </div>

        {/* Footer navigation */}
        <div className="flex items-center justify-between gap-2 border-t border-line bg-paper/50 px-5 py-4 rounded-b-2xl">
          {step === 1 ? (
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-lg border border-line px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-paper"
            >
              Cancel
            </button>
          ) : (
            <button
              type="button"
              onClick={goBack}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-line px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-paper"
            >
              <ArrowLeft size={14} />
              Back
            </button>
          )}

          {step < 4 ? (
            <button
              type="button"
              onClick={goNext}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-foreground/90"
            >
              Next
              <ArrowRight size={14} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending}
              className="flex cursor-pointer items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
              {isPending ? "Submitting…" : "Submit Booking Request"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
