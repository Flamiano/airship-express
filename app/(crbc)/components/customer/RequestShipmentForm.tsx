"use client";

import { useId, useEffect, useMemo, useState, useTransition } from "react";
import {
  Package,
  UserRound,
  FileText,
  CheckCircle2,
  Loader2,
  Copy,
  ArrowRight,
  Receipt,
  Info,
} from "lucide-react";
import { requestShipment } from "../../actions/shipment";
import type { BookingPackageDetails } from "../../actions/customer";
import { getQuote, type Quote } from "../../services/pricing.service";

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

const PACKAGE_TYPES = [
  { value: "box", label: "Box" },
  { value: "parcel", label: "Parcel" },
  { value: "document", label: "Document" },
] as const;

const inputBase =
  "w-full text-sm border border-line bg-paper text-foreground placeholder-muted/70 rounded-lg px-3 py-2.5 outline-none transition-colors focus:border-accent focus:ring-4 focus:ring-accent/15";

const labelCls = "text-xs font-medium text-muted block";
const requiredMark = <span className="text-accent">*</span>;

const peso = (n: number) =>
  `₱${n.toLocaleString("en-PH", { maximumFractionDigits: 2 })}`;

function SectionCard({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line bg-background p-5 sm:p-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
          <Icon size={16} />
        </span>
        <div>
          <h2 className="font-bricolage text-[15px] font-semibold text-foreground">
            {title}
          </h2>
          {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ */

type Confirmation = {
  booking_id: string;
  receiverName: string;
  receiverAddress: string;
  total: number;
};

export default function RequestShipmentForm() {
  const formId = useId();

  const [receiverName, setReceiverName] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");
  const [receiverAddress, setReceiverAddress] = useState("");
  const [packageQuantity, setPackageQuantity] = useState(1);
  const [packageType, setPackageType] =
    useState<BookingPackageDetails["package_type"]>("box");
  const [itemCategory, setItemCategory] = useState<string>("Parcel");
  const [weight, setWeight] = useState("");
  const [dimLength, setDimLength] = useState("");
  const [dimWidth, setDimWidth] = useState("");
  const [dimHeight, setDimHeight] = useState("");
  const [declaredValue, setDeclaredValue] = useState("");
  const [packagingService, setPackagingService] = useState<
    BookingPackageDetails["packaging_service"]
  >("empty");
  const [remarks, setRemarks] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

  const actualWeight = parseFloat(weight) || 0;

  // Quote comes from the pricing service (Tariff/Rate Management boundary).
  // Debounced so typing in weight/dimension fields doesn't spam recomputes.
  const hasDims =
    parseFloat(dimLength) > 0 &&
    parseFloat(dimWidth) > 0 &&
    parseFloat(dimHeight) > 0;
  const quoteInput = useMemo(
    () => ({
      actualWeightKg: actualWeight,
      dimensionsCm: hasDims
        ? {
            length: parseFloat(dimLength),
            width: parseFloat(dimWidth),
            height: parseFloat(dimHeight),
          }
        : undefined,
      declaredValue: declaredValue ? parseFloat(declaredValue) : undefined,
      packagingProvided: packagingService === "provided",
    }),
    [actualWeight, hasDims, dimLength, dimWidth, dimHeight, declaredValue, packagingService]
  );

  const [quote, setQuote] = useState<Quote | null>(null);
  const [isQuoting, setIsQuoting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        setIsQuoting(true);
        const q = await getQuote(quoteInput);
        if (!cancelled) setQuote(q);
      } finally {
        if (!cancelled) setIsQuoting(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [quoteInput]);

  const total = quote?.total ?? 0;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);

    if (!receiverName.trim()) return setFormError("Receiver name is required.");
    if (!receiverAddress.trim())
      return setFormError("Delivery address is required.");
    if (!weight || parseFloat(weight) <= 0)
      return setFormError("Weight is required and must be greater than zero.");
    if (!agreeTerms)
      return setFormError("Please agree to the terms and conditions to continue.");

    startTransition(async () => {
      const res = await requestShipment({
        receiverName,
        receiverPhone: receiverPhone || undefined,
        receiverAddress,
        packageDetails: {
          package_quantity: packageQuantity,
          package_type: packageType,
          item_category: itemCategory,
          weight: parseFloat(weight),
          dimensions:
            dimLength && dimWidth && dimHeight
              ? {
                  length_cm: parseFloat(dimLength),
                  width_cm: parseFloat(dimWidth),
                  height_cm: parseFloat(dimHeight),
                }
              : undefined,
          declared_value: declaredValue ? parseFloat(declaredValue) : undefined,
          packaging_service: packagingService,
          remarks: remarks || undefined,
        },
      });

      if (res.error) {
        setFormError(res.error);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else if (res.booking) {
        setConfirmation({
          booking_id: res.booking.booking_id,
          receiverName,
          receiverAddress,
          total,
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  };

  /* ---------------------------------------------------------------- */

  if (confirmation) {
    return (
      <div className="mx-auto max-w-xl">
        <div className="rounded-2xl border border-line bg-background p-8 text-center sm:p-10">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600">
            <CheckCircle2 size={28} />
          </span>
          <h1 className="font-bricolage text-xl font-semibold text-foreground">
            Shipment Request Submitted
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
            Our team will review your request and confirm the pickup schedule.
            You&apos;ll be notified once it&apos;s approved.
          </p>

          <dl className="mt-6 space-y-3 rounded-xl border border-line bg-paper p-4 text-left text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted">Reference No.</dt>
              <dd className="flex items-center gap-2 font-medium text-foreground">
                {confirmation.booking_id}
                <button
                  type="button"
                  onClick={() =>
                    navigator.clipboard.writeText(confirmation.booking_id)
                  }
                  aria-label="Copy reference number"
                  className="text-muted transition-colors hover:text-accent"
                >
                  <Copy size={13} />
                </button>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted">Receiver</dt>
              <dd className="truncate font-medium text-foreground">
                {confirmation.receiverName}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted">Delivery to</dt>
              <dd className="max-w-[60%] truncate text-right font-medium text-foreground">
                {confirmation.receiverAddress}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-line pt-3">
              <dt className="text-muted">Estimated Total</dt>
              <dd className="text-base font-semibold text-accent">
                {peso(confirmation.total)}
              </dd>
            </div>
          </dl>

          <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted">
            <Info size={12} />
            Final charges may adjust after branch weigh-in.
          </p>

          <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
            <a
              href="/customer/shipments"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-line px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-paper"
            >
              <FileText size={15} />
              View My Shipments
            </a>
            <button
              type="button"
              onClick={() => {
                setConfirmation(null);
                setReceiverName("");
                setReceiverPhone("");
                setReceiverAddress("");
                setWeight("");
                setDimLength("");
                setDimWidth("");
                setDimHeight("");
                setDeclaredValue("");
                setRemarks("");
                setAgreeTerms(false);
              }}
              className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-dark"
            >
              <Package size={15} />
              Book Another Shipment
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */

  return (
    <form id={formId} onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="font-bricolage text-xl font-semibold text-foreground sm:text-2xl">
          Request Shipment
        </h1>
        <p className="mt-1 text-sm text-muted">
          Tell us about your package and where it&apos;s going — we&apos;ll take
          care of the rest.
        </p>
      </div>

      <SectionCard
        icon={UserRound}
        title="Delivery Details"
        subtitle="Who is receiving this shipment?"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="rs-receiver" className={labelCls}>
                Receiver Name {requiredMark}
              </label>
              <input
                id="rs-receiver"
                type="text"
                value={receiverName}
                onChange={(e) => setReceiverName(e.target.value)}
                placeholder="Full name of recipient"
                autoComplete="off"
                required
                className={inputBase}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="rs-phone" className={labelCls}>
                Receiver Phone
              </label>
              <input
                id="rs-phone"
                type="tel"
                value={receiverPhone}
                onChange={(e) => setReceiverPhone(e.target.value)}
                placeholder="09XXXXXXXXX"
                autoComplete="off"
                className={inputBase}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="rs-address" className={labelCls}>
              Delivery Address {requiredMark}
            </label>
            <textarea
              id="rs-address"
              value={receiverAddress}
              onChange={(e) => setReceiverAddress(e.target.value)}
              placeholder="House/unit no., street, barangay, city, province"
              rows={2}
              required
              className={`${inputBase} resize-none`}
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard
        icon={Package}
        title="Package Details"
        subtitle="Help us handle your shipment correctly"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label htmlFor="rs-qty" className={labelCls}>
                Quantity {requiredMark}
              </label>
              <input
                id="rs-qty"
                type="number"
                min={1}
                step={1}
                value={packageQuantity}
                onChange={(e) =>
                  setPackageQuantity(Math.max(1, parseInt(e.target.value) || 1))
                }
                className={inputBase}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="rs-type" className={labelCls}>
                Package Type {requiredMark}
              </label>
              <select
                id="rs-type"
                value={packageType}
                onChange={(e) =>
                  setPackageType(
                    e.target.value as BookingPackageDetails["package_type"]
                  )
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
            <div className="col-span-2 space-y-1.5 sm:col-span-1">
              <label htmlFor="rs-category" className={labelCls}>
                Item Category {requiredMark}
              </label>
              <select
                id="rs-category"
                value={itemCategory}
                onChange={(e) => setItemCategory(e.target.value)}
                className={inputBase}
              >
                {ITEM_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="rs-weight" className={labelCls}>
              Weight (kg) {requiredMark}
            </label>
            <input
              id="rs-weight"
              type="number"
              min={0}
              step="0.01"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="0.00"
              className={inputBase}
            />
          </div>

          <div className="space-y-1.5">
            <label className={labelCls}>Dimensions (cm)</label>
            <div className="grid grid-cols-3 gap-2">
              <input
                aria-label="Length in centimeters"
                type="number"
                min={0}
                step="0.1"
                value={dimLength}
                onChange={(e) => setDimLength(e.target.value)}
                placeholder="Length"
                className={inputBase}
              />
              <input
                aria-label="Width in centimeters"
                type="number"
                min={0}
                step="0.1"
                value={dimWidth}
                onChange={(e) => setDimWidth(e.target.value)}
                placeholder="Width"
                className={inputBase}
              />
              <input
                aria-label="Height in centimeters"
                type="number"
                min={0}
                step="0.1"
                value={dimHeight}
                onChange={(e) => setDimHeight(e.target.value)}
                placeholder="Height"
                className={inputBase}
              />
            </div>
          </div>

          {/* Weight summary strip */}
          {quote && (quote.volumetricWeightKg > 0 || actualWeight > 0) && (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-line bg-paper px-4 py-3 text-sm">
              <span className="text-muted">
                Actual Weight:{" "}
                <span className="font-medium text-foreground">
                  {actualWeight.toFixed(2)} kg
                </span>
              </span>
              <span className="text-muted">
                Chargeable Weight:{" "}
                <span className="font-medium text-accent">
                  {quote.chargeableWeightKg.toFixed(2)} kg
                </span>
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="rs-value" className={labelCls}>
                Declared Value
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">
                  ₱
                </span>
                <input
                  id="rs-value"
                  type="number"
                  min={0}
                  step="0.01"
                  value={declaredValue}
                  onChange={(e) => setDeclaredValue(e.target.value)}
                  placeholder="0.00"
                  className={`${inputBase} pl-8`}
                />
              </div>
              <p className="text-[11px] text-muted">
                For insurance purposes. Maximum liability applies to undeclared items.
              </p>
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Packaging Service</label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {(
                  [
                    { value: "empty", label: "My own packaging" },
                    { value: "provided", label: "Airship packaging" },
                  ] as const
                ).map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                      packagingService === opt.value
                        ? "border-accent bg-accent/5 text-foreground"
                        : "border-line bg-paper text-muted hover:border-muted/50 hover:text-foreground"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`rs-packaging-${formId}`}
                      value={opt.value}
                      checked={packagingService === opt.value}
                      onChange={() => setPackagingService(opt.value)}
                      className="h-3.5 w-3.5 accent-(--accent)"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="rs-remarks" className={labelCls}>
              Remarks
            </label>
            <textarea
              id="rs-remarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Special handling instructions (optional)"
              rows={2}
              maxLength={500}
              className={`${inputBase} resize-none`}
            />
          </div>
        </div>
      </SectionCard>

      {/* Fee Summary */}
      <section className="overflow-hidden rounded-2xl border border-line bg-background">
        <div className="flex items-center gap-2.5 px-5 py-4 sm:px-6">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <Receipt size={16} />
          </span>
          <div>
            <h2 className="font-bricolage text-[15px] font-semibold text-foreground">
              Fee Summary
            </h2>
            <p className="text-xs text-muted">Estimated before branch weigh-in</p>
          </div>
        </div>
        <div className="space-y-2.5 border-t border-line bg-paper/50 px-5 py-4 text-sm sm:px-6">
          {!quote ? (
            <p className="flex items-center gap-2 text-muted">
              {isQuoting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Calculating estimate…
                </>
              ) : (
                "Enter weight to see the estimated fee."
              )}
            </p>
          ) : (
            <>
              {(quote.volumetricWeightKg > 0 || actualWeight > 0) && (
                <div className="flex justify-between">
                  <span className="text-muted">Chargeable weight</span>
                  <span className="font-medium text-foreground">
                    {quote.chargeableWeightKg.toFixed(2)} kg
                  </span>
                </div>
              )}
              {quote.lineItems.map((li) => (
                <div key={li.label} className="flex justify-between">
                  <span className="text-muted">
                    {li.label}
                    {li.explanation && (
                      <span className="block text-[11px] text-muted/70">
                        {li.explanation}
                      </span>
                    )}
                  </span>
                  <span className="font-medium text-foreground">{peso(li.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-line pt-2.5">
                <span className="font-medium text-foreground">Estimated Total</span>
                <span className={`text-lg font-semibold text-accent transition-opacity ${isQuoting ? "opacity-50" : ""}`}>
                  {peso(total)}
                </span>
              </div>
            </>
          )}
        </div>
      </section>

      {formError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
          {formError}
        </div>
      )}

      {/* Submit */}
      <div className="flex flex-col-reverse items-stretch gap-2 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex cursor-pointer items-start gap-2.5 text-xs text-muted">
          <input
            type="checkbox"
            checked={agreeTerms}
            onChange={(e) => setAgreeTerms(e.target.checked)}
            className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-(--accent)"
          />
          <span>
            I have read, understand and agree to the{" "}
            <span className="font-medium text-accent">
              Terms and Conditions
            </span>
            . Sales invoice will be available within seven (7) days.
          </span>
        </label>
        <button
          type="submit"
          disabled={isPending}
          className="flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg bg-accent px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              Submitting…
            </>
          ) : (
            <>
              Submit Request
              <ArrowRight size={15} />
            </>
          )}
        </button>
      </div>
    </form>
  );
}
