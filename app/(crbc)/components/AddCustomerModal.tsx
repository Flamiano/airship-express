"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { X, Search, UserCheck } from "lucide-react";
import { addCustomer, searchCustomer } from "../actions/customer";
import {
  isValidPhone,
  isValidEmail,
  normalizePhone,
} from "../library/validation/customer.data.validate";
import { formatPhoneNumber } from "../library/utils/formatPhoneNumber";

type AddCustomerModalProps = {
  open: boolean;
  onClose: () => void;
};

type CustomerResult = {
  id: string;
  customer_id: string;
  full_name: string;
  phone: string | null;
  address: string | null;
  isNew: boolean;
};

type SearchStatus = "idle" | "loading" | "found" | "not_found";
type Channel = "walk_in" | "call";
const MIN_SEARCH_LENGTH = 4;
const DEBOUNCE_MS = 300;

export default function AddCustomerModal({
  open,
  onClose,
}: AddCustomerModalProps) {
  const nameInput = useRef<HTMLInputElement>(null);
  const okId = useId();

  // Search state
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [searchType, setSearchType] = useState<"customer_id" | "phone">("phone");
  const [foundCustomer, setFoundCustomer] = useState<CustomerResult | null>(null);
  const [searchStatus, setSearchStatus] = useState<SearchStatus>("idle");
  const [pendingMatch, setPendingMatch] = useState<CustomerResult | null>(null);

  // Form state
  const [senderName, setSenderName] = useState("");
  const [senderNumber, setSenderNumber] = useState("");
  const [senderAddress, setSenderAddress] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [receiver, setReceiver] = useState("");
  const [receiverAddress, setReceiverAddress] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [channel, setChannel] = useState<Channel>("walk_in");
  // Reset everything when modal opens
  useEffect(() => {
    (async()=>{
     if (open) {
        setSenderName("");
        setSenderNumber("");
        setSenderAddress("");
        setSenderEmail("");
        setReceiver("");
        setReceiverAddress("");
        setFormError(null);
        setFoundCustomer(null);
        setPendingMatch(null);
        setSearchQuery("");
        setDebouncedQuery("");
        setSearchStatus("idle");
        setShowSearch(false);
        const t = setTimeout(() => nameInput.current?.focus(), 0);
        return () => clearTimeout(t);
      }
    })();
   
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Run search whenever the debounced query changes
  useEffect(() => {
        let cancelled = false;

    (async()=>{
         if (foundCustomer) return; // don't re-search once a customer is selected

    if (debouncedQuery.length < MIN_SEARCH_LENGTH) {
      setSearchStatus("idle");
      return;
    }

    setSearchStatus("loading");

    const run = async () => {
      try {
        const res =
          searchType === "customer_id"
            ? await searchCustomer(debouncedQuery, undefined)
            : await searchCustomer(undefined, normalizePhone(debouncedQuery));

        if (cancelled) return;

        if (res.data) {
          setSearchStatus("found");
          setPendingMatch(res.data);
        } else {
          setSearchStatus("not_found");
          setPendingMatch(null);
        }
      } catch {
        if (!cancelled) {
          setSearchStatus("not_found");
          setPendingMatch(null);
        }
      }
    };
       run();
    })()
   
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, searchType, foundCustomer]);

  // "idle" is derived from the debounced query so the effect never sets state synchronously.
  const effectiveStatus: SearchStatus =
    debouncedQuery.length < MIN_SEARCH_LENGTH ? "idle" : searchStatus;

  const handleUseCustomer = (customer: CustomerResult) => {
    setFoundCustomer(customer);
    setSenderName(customer.full_name);
    setSenderNumber(customer.phone ? formatPhoneNumber(customer.phone) : "");
    setSenderAddress(customer.address || "");
    setShowSearch(false); // collapse back to the confirmed summary
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setDebouncedQuery("");
    setFoundCustomer(null);
    setPendingMatch(null);
    setSearchStatus("idle");
    setSenderName("");
    setSenderNumber("");
    setSenderAddress("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const name = senderName.trim();
    if (!name) {
      setFormError("Sender name is required.");
      nameInput.current?.focus();
      return;
    }

    const phone = senderNumber.trim();
    if (phone && !isValidPhone(phone)) {
      setFormError("Enter a valid Philippine mobile number (e.g., 09171234567).");
      return;
    }

    const email = senderEmail.trim();
    if (email && !isValidEmail(email)) {
      setFormError("Enter a valid Gmail address (e.g., name@gmail.com).");
      return;
    }

    if (!receiverAddress.trim()) {
      setFormError("Delivery address is required.");
      return;
    }

    startTransition(async () => {
        const res = await addCustomer({
        senderName: name,
        senderNumber: phone ? normalizePhone(phone) : undefined,
        senderEmail: email || undefined,
        senderAddress: senderAddress.trim() || undefined,
        receiverName: receiver.trim(),
        receiverNumber: undefined,
        receiverAddress: receiverAddress.trim(),
        source: channel,
        existingCustomerId: foundCustomer?.id, // NEW
      });

      if (res.error) {
        setFormError(res.error);
      } else {
        onClose();
      }
    });
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={okId}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-background border border-line rounded-2xl shadow-xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-line">
          <div>
            <h2 id={okId} className="text-foreground text-base font-semibold">
              Add Customer
            </h2>
            <p className="text-xs text-muted mt-0.5">
              Search for existing customer by ID or phone to avoid duplicates
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-muted hover:text-foreground transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-5">
          {/* Search Section */}

          {!showSearch && !foundCustomer && (
            <button
              type="button"
              onClick={() => setShowSearch(true)}
              className="flex items-center gap-2 px-3 py-2.5 cursor-pointer rounded-lg bg-accent/85 text-white text-xs font-medium hover:bg-accent-dark transition-colors"
            >
              <Search size={15} />
              Find Existing Customer
            </button>
          )}

          {!showSearch && foundCustomer && (
            <div className="p-3 rounded-lg bg-green-50 border border-green-200 dark:bg-green-950/30 dark:border-green-900 flex items-center gap-3">
              <UserCheck className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-green-800 dark:text-green-200">
                  Using existing customer
                </p>
                <p className="text-xs text-green-700 dark:text-green-300 truncate">
                  {foundCustomer.customer_id} · {foundCustomer.full_name} ·{" "}
                  {foundCustomer.phone
                    ? formatPhoneNumber(foundCustomer.phone)
                    : "No phone"}
                </p>
              </div>
              <button
                type="button"
                onClick={handleClearSearch}
                className="text-green-700 dark:text-green-400 hover:text-green-900 text-xs font-medium shrink-0"
              >
                × Clear
              </button>
            </div>
          )}

          {/* Expanded search panel */}
          {showSearch && (
            <fieldset className="space-y-3">
              <div className="flex items-center justify-between">
                <legend className="text-xs font-semibold uppercase tracking-wide text-accent">
                  Find Existing Customer
                </legend>
                <button
                  type="button"
                  onClick={() => setShowSearch(false)}
                  aria-label="Hide search"
                  className="text-muted hover:text-foreground transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted block">
                  Search by
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSearchType("customer_id");
                      handleClearSearch();
                    }}
                    disabled={!!foundCustomer}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      searchType === "customer_id"
                        ? "bg-accent/85 border-accent text-white cursor-pointer"
                        : "bg-paper border-line text-muted hover:border-muted/50 hover:text-foreground"
                    }`}
                  >
                    Customer ID (CUS-XXXX)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchType("phone");
                      handleClearSearch();
                    }}
                    disabled={!!foundCustomer}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      searchType === "phone"
                        ? "bg-accent/85 border-accent text-white cursor-pointer"
                        : "bg-paper border-line text-muted hover:border-muted/50 hover:text-foreground"
                    }`}
                  >
                    Phone Number
                  </button>
                </div>
              </div>

              <div className="relative">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted/60"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  disabled={!!foundCustomer}
                  placeholder={
                    searchType === "customer_id"
                      ? "Start typing Customer ID (e.g., WIC-0001)"
                      : "Start typing phone number"
                  }
                  autoComplete="off"
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-line bg-paper text-sm text-foreground placeholder-muted/70 outline-none transition-colors focus:border-accent focus:ring-4 focus:ring-accent/15 disabled:opacity-60"
                />
              </div>

              {/* Search status area */}
              {!foundCustomer && effectiveStatus === "loading" && (
                <p className="text-xs text-muted px-1">Searching…</p>
              )}

              {!foundCustomer && effectiveStatus === "not_found" && (
                <p className="text-xs text-muted px-1">
                  No match — a new customer record will be created.
                </p>
              )}

              {!foundCustomer && effectiveStatus === "found" && pendingMatch && (
                <div className="p-3 rounded-lg bg-accent/5 border border-accent/30 flex items-center gap-3">
                  <UserCheck className="h-5 w-5 text-accent shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {pendingMatch.full_name}
                    </p>
                    <p className="text-xs text-muted truncate">
                      {pendingMatch.customer_id} ·{" "}
                      {pendingMatch.phone
                        ? formatPhoneNumber(pendingMatch.phone)
                        : "No phone"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUseCustomer(pendingMatch)}
                    className="text-xs font-medium text-accent hover:underline shrink-0"
                  >
                    Use this customer
                  </button>
                </div>
              )}
            </fieldset>
          )}

          {/* Sender Details */}
          <fieldset className="space-y-3 pt-2 border-t border-line">
            <legend className="text-xs font-semibold uppercase tracking-wide text-accent">
              Sender Details
            </legend>

            <div className="space-y-1.5">
              <label
                htmlFor="sender-name"
                className="text-xs font-medium text-muted block"
              >
                Name <span className="text-foreground/80">(required)</span>
              </label>
              <input
                ref={nameInput}
                id="sender-name"
                type="text"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="Enter sender name"
                autoComplete="off"
                required
                readOnly={!!foundCustomer}
                className={`w-full text-sm border border-line text-foreground placeholder-muted/70 rounded-lg px-3 py-2.5 outline-none transition-colors focus:border-accent focus:ring-4 focus:ring-accent/15 ${
                  foundCustomer ? "bg-line/20 cursor-not-allowed" : "bg-paper"
                }`}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label
                  htmlFor="sender-number"
                  className="text-xs font-medium text-muted block"
                >
                  Phone Number
                </label>
                <input
                  id="sender-number"
                  type="text"
                  value={senderNumber}
                  onChange={(e) => setSenderNumber(e.target.value)}
                  placeholder="Contact number"
                  autoComplete="off"
                  readOnly={!!foundCustomer}
                  className={`w-full text-sm border border-line text-foreground placeholder-muted/70 rounded-lg px-3 py-2.5 outline-none transition-colors focus:border-accent focus:ring-4 focus:ring-accent/15 ${
                    foundCustomer ? "bg-line/20 cursor-not-allowed" : "bg-paper"
                  }`}
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="sender-address"
                  className="text-xs font-medium text-muted block"
                >
                  Address (optional)
                </label>
                <input
                  id="sender-address"
                  type="text"
                  value={senderAddress}
                  onChange={(e) => setSenderAddress(e.target.value)}
                  placeholder="Sender address"
                  autoComplete="off"
                  className="w-full text-sm bg-paper border border-line text-foreground placeholder-muted/70 rounded-lg px-3 py-2.5 outline-none transition-colors focus:border-accent focus:ring-4 focus:ring-accent/15"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="sender-email"
                className="text-xs font-medium text-muted block"
              >
                Email
              </label>
              <input
                id="sender-email"
                type="email"
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
                placeholder="Gmail address (e.g., name@gmail.com)"
                autoComplete="off"
                className="w-full text-sm bg-paper border border-line text-foreground placeholder-muted/70 rounded-lg px-3 py-2.5 outline-none transition-colors focus:border-accent focus:ring-4 focus:ring-accent/15"
              />
            </div>

            {foundCustomer && (
              <p className="text-xs text-muted">
                Name and phone are locked to the matched record. Address stays editable.
              </p>
            )}
          </fieldset>

          {/* Booking Request - Receiver Details */}
          <fieldset className="space-y-3 pt-2 border-t border-line">
            <legend className="text-xs font-semibold uppercase tracking-wide text-muted pt-3">
              Booking Request — Receiver
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label
                  htmlFor="receiver"
                  className="text-xs font-medium text-muted block"
                >
                  Receiver Name <span className="text-foreground/80">(required)</span>
                </label>
                <input
                  id="receiver"
                  type="text"
                  value={receiver}
                  onChange={(e) => setReceiver(e.target.value)}
                  placeholder="Receiver name"
                  autoComplete="off"
                  required
                  className="w-full text-sm bg-paper border border-line text-foreground placeholder-muted/70 rounded-lg px-3 py-2.5 outline-none transition-colors focus:border-accent focus:ring-4 focus:ring-accent/15"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label
                  htmlFor="receiver-address"
                  className="text-xs font-medium text-muted block"
                >
                  Delivery Address <span className="text-foreground/80">(required)</span>
                </label>
                <input
                  id="receiver-address"
                  type="text"
                  value={receiverAddress}
                  onChange={(e) => setReceiverAddress(e.target.value)}
                  placeholder="Destination address"
                  autoComplete="off"
                  required
                  className="w-full text-sm bg-paper border border-line text-foreground placeholder-muted/70 rounded-lg px-3 py-2.5 outline-none transition-colors focus:border-accent focus:ring-4 focus:ring-accent/15"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="channel"
                className="text-xs font-medium text-muted block"
              >
                Type
              </label>
              <select
                id="channel"
                value={channel}
                onChange={(e) => setChannel(e.target.value as Channel)}
                className="w-full px-3 py-2.5 rounded-lg border border-line bg-paper text-sm text-foreground outline-none transition-colors focus:border-accent focus:ring-4 focus:ring-accent/15"
              >
                <option value="walk_in">Walk-in</option>
                <option value="call">Phone Call</option>
              </select>
            </div>
          </fieldset>

          {formError && (
            <div className="text-red-700 bg-red-50 border border-red-200 dark:text-red-400 dark:bg-red-950 dark:border-red-900 rounded-lg text-sm px-3 py-2.5">
              {formError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 cursor-pointer py-2.5 rounded-lg border border-line text-foreground text-sm font-medium hover:bg-paper transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2.5 rounded-lg bg-accent hover:bg-accent-dark cursor-pointer text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? "Saving…" : foundCustomer ? "Request Booking" : "Add Customer & Booking"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}