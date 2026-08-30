"use client";

type ButtonProps = {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger";
  type?: "button" | "submit";
  disabled?: boolean;
  loading?: boolean;
  className?: string;
};

export default function Button({
  children,
  onClick,
  variant = "primary",
  type = "button",
  disabled = false,
  loading = false,
  className = "",
}: ButtonProps) {
  const baseStyles =
    "inline-flex h-10 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold font-rethink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-paper dark:focus-visible:ring-offset-ink";

  const variantStyles = {
    primary:
      "bg-ink text-paper hover:bg-accent dark:bg-accent dark:text-white dark:hover:bg-accent-dark",
    secondary:
      "border border-line bg-paper text-ink hover:bg-line dark:bg-ink dark:border-paper/15 dark:text-paper dark:hover:bg-paper/10",
    danger: "bg-red-600 hover:bg-red-700 text-white",
  };

  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={`${baseStyles} ${variantStyles[variant]} ${
        isDisabled ? "cursor-not-allowed opacity-50" : ""
      } ${className}`}
    >
      {loading && (
        <span
          aria-hidden
          className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none"
        />
      )}
      {children}
    </button>
  );
}
