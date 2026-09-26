"use client";


import { useState } from "react";
import {
  Loader2,
  ShieldCheck,
  User,
  Mail,
  Phone,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";
import {
  updateCustomer,
  type UpdateCustomerFormState,
  type UpdateCustomerResult,
} from "@/app/(crbc)/actions/customer";
import { validateEmail, validatePhoneNumber } from "@/app/(crbc)/library/utils/validateEmail";

type Props = {
  id: string;
  full_name: string;
  phone: string | null | undefined;
  address: string | null | undefined;
  email: string | null | undefined;
};

type FormState = UpdateCustomerFormState & UpdateCustomerResult;

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

function FieldLabel({
  icon: Icon,
  htmlFor,
  children,
}: {
  icon: React.ElementType;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="flex items-center gap-2 text-sm text-muted"
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
    </label>
  );
}

function InputField({
  icon: Icon,
  id,
  name,
  type = "text",
  value,
  onChange,
  required = false,
  placeholder,
}: {
  icon: React.ElementType;
  id: string;
  name: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">
        <Icon className="h-4 w-4" />
      </div>
      <input
        id={id}
        name={name}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-line bg-background text-sm text-foreground transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 placeholder:text-muted/50"
      />
    </div>
  );
}

function TextAreaField({
  icon: Icon,
  id,
  name,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  icon: React.ElementType;
  id: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div className="relative">
      <div className="absolute left-3 top-3 text-muted">
        <Icon className="h-4 w-4" />
      </div>
      <textarea
        id={id}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-line bg-background text-sm text-foreground transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 resize-none placeholder:text-muted/50"
      />
    </div>
  );
}

function SaveButton({ isSubmitting }: { isSubmitting: boolean }) {
  return (
    <button
      type="submit"
      disabled={isSubmitting}
      className="inline-flex min-w-40 items-center justify-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition-all duration-200 hover:bg-accent/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isSubmitting ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Saving
        </>
      ) : (
        "Save changes"
      )}
    </button>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-disabled={disabled}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? "bg-accent" : "bg-muted/30 dark:bg-muted/50"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ease-out ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
        aria-hidden="true"
      />
    </button>
  );
}

export default function SettingsForm({
  id,
  full_name,
  phone,
  address,
  email,
}: Props) {
  const initialState: FormState = {
    id,
    full_name,
    phone: phone ?? "",
    address: address ?? "",
    email: email ?? "",
  };

  const [formValues, setFormValues] = useState({
    full_name,
    phone: phone ?? "",
    address: address ?? "",
    email: email ?? "",
  });

  // Track last successfully saved values for rollback on error
  const [lastSavedValues, setLastSavedValues] = useState({
    full_name,
    phone: phone ?? "",
    address: address ?? "",
    email: email ?? "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Validate email
    if (!validateEmail(formValues.email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    // Validate phone if provided
    if (formValues.phone && !validatePhoneNumber(formValues.phone)) {
      toast.error("Please enter a valid Philippine phone number (e.g., 09xx-xxx-xxxx)");
      return;
    }

    // Validate full name
    if (!formValues.full_name.trim()) {
      toast.error("Full name is required");
      return;
    }

    setIsSubmitting(true);

    const formData = new FormData();
    formData.set("id", id);
    formData.set("full_name", formValues.full_name.trim());
    formData.set("phone", formValues.phone || "");
    formData.set("address", formValues.address || "");
    formData.set("email", formValues.email.trim());

    const result = await updateCustomer(initialState, formData);

    if (result.success) {
      setLastSavedValues(formValues);
      toast.success("Profile updated successfully!");
    } else {
      setFormValues(lastSavedValues);
      toast.error(result.error || "Failed to update profile");
    }
    setIsSubmitting(false);
  };

  const handleChange = (name: string, value: string) => {
    setFormValues(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-start justify-center bg-background p-4 py-12 sm:py-16">
      <div className="w-full max-w-xl space-y-8">
        {/* Identity header */}
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent/10 text-lg font-semibold text-accent ring-4 ring-accent/5">
            {getInitials(full_name) || "?"}
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold text-foreground">
              Settings
            </h1>
            <p className="mt-0.5 text-sm text-muted">
              Update your profile and manage account security.
            </p>
          </div>
        </div>

        {/* Profile section */}
        <form
          onSubmit={handleSubmit}
          className="overflow-hidden rounded-2xl border border-line bg-background shadow-sm shadow-black/2"
        >

          <section className="space-y-5 p-6 border-b border-line">
            <h2 className="text-sm font-medium text-foreground">Profile</h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <FieldLabel icon={User} htmlFor="full_name">
                  Full name
                </FieldLabel>
                <InputField
                  icon={User}
                  id="full_name"
                  name="full_name"
                  value={formValues.full_name}
                  onChange={(v) => handleChange("full_name", v)}
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <FieldLabel icon={Mail} htmlFor="email">
                  Email address
                </FieldLabel>
                <InputField
                  icon={Mail}
                  id="email"
                  name="email"
                  type="email"
                  value={formValues.email}
                  onChange={(v) => handleChange("email", v)}
                  required
                />
              </div>

              <div>
                <FieldLabel icon={Phone} htmlFor="phone">
                  Phone number
                </FieldLabel>
                <InputField
                  icon={Phone}
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formValues.phone}
                  onChange={(v) => handleChange("phone", v)}
                  placeholder="Optional"
                />
              </div>

              <div>
                <FieldLabel icon={MapPin} htmlFor="address">
                  Address
                </FieldLabel>
                <TextAreaField
                  icon={MapPin}
                  id="address"
                  name="address"
                  value={formValues.address}
                  onChange={(v) => handleChange("address", v)}
                  placeholder="Optional"
                  rows={3}
                />
              </div>
            </div>
          </section>

          <div className="flex items-center justify-end gap-3 p-6 bg-background/30">
            <SaveButton isSubmitting={isSubmitting} />
          </div>
        </form>

        {/* Security section */}
        <div className="overflow-hidden rounded-2xl border border-line bg-background shadow-sm shadow-black/2">
          <section className="p-6">
            <h2 className="text-sm font-medium text-foreground">Security</h2>

            <div className="mt-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 shrink-0 text-muted" />
                <div>
                  <p className="text-sm text-foreground">
                    Two-factor authentication
                  </p>
                  <p className="mt-0.5 text-sm text-muted">
                    Send a one-time code to your email when you sign in.
                  </p>
                </div>
              </div>
              <Toggle
                checked={twoFactorEnabled}
                onChange={setTwoFactorEnabled}
                label="Two-factor authentication"
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}