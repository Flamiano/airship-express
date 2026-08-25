import type { ReactNode } from "react";

type EmptyStateProps = {
  icon?: (props: { className?: string }) => ReactNode;
  title: string;
  description?: string;
};

export default function EmptyState({
  icon: Icon,
  title,
  description,
}: EmptyStateProps) {
  return (
    <div className="flex max-w-md flex-col items-start gap-3 rounded-xl border border-dashed border-line px-6 py-10 font-rethink dark:border-paper/25">
      {Icon && (
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-accent/25 bg-accent/10 text-accent">
          <Icon className="h-5 w-5" />
        </span>
      )}
      <div>
        <p className="text-sm font-medium text-ink dark:text-paper">{title}</p>
        {description && (
          <p className="mt-1 text-sm leading-relaxed text-muted">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
