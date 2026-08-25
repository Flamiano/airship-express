type ProgressBarTone = "accent" | "success";

type ProgressBarProps = {
  value: number;
  tone?: ProgressBarTone;
  label?: string;
  className?: string;
};

const TONE_CLASSES: Record<ProgressBarTone, string> = {
  accent: "bg-accent",
  success: "bg-green-600 dark:bg-green-500",
};

export default function ProgressBar({
  value,
  tone = "accent",
  label,
  className = "",
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      aria-label={label}
      className={`h-2 w-full overflow-hidden rounded-full bg-line dark:bg-paper/15 ${className}`}
    >
      <div
        className={`h-full rounded-full ${TONE_CLASSES[tone]} motion-safe:transition-[width] motion-safe:duration-500 motion-safe:ease-out`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
