import type { ReactNode } from "react";

type FilterBarProps = {
  children: ReactNode;
  className?: string;
};

export function FilterBar({ children, className }: FilterBarProps) {
  return (
    <div
      className={`flex flex-col gap-3 rounded-2xl border border-line bg-paper px-4 py-4 dark:border-paper/10 sm:flex-row sm:items-center sm:flex-wrap ${className ?? ""}`}
    >
      {children}
    </div>
  );
}