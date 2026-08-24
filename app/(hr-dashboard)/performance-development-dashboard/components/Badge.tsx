type BadgeProps = {
  children: React.ReactNode;
  variant?: "success" | "warning" | "danger" | "neutral";
};

export default function Badge({ children, variant = "neutral" }: BadgeProps) {
  const variantStyles = {
    success:
      "bg-green-600/10 text-green-700 border border-green-600/25 dark:bg-green-500/15 dark:text-green-400 dark:border-green-500/30",
    warning:
      "bg-amber-500/10 text-amber-700 border border-amber-500/25 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30",
    danger:
      "bg-red-600/10 text-red-700 border border-red-600/25 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30",
    neutral:
      "bg-paper text-muted border border-line dark:bg-ink dark:border-paper/15",
  };

  return (
    <span
      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium font-rethink ${variantStyles[variant]}`}
    >
      {children}
    </span>
  );
}
