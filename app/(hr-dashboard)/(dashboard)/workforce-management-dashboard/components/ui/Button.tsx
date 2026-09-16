import React from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'outline';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-accent hover:bg-accent-dark text-paper shadow-sm shadow-accent/20 border border-transparent',
  secondary:
    'bg-ink/[0.04] dark:bg-paper/[0.06] hover:bg-ink/[0.08] dark:hover:bg-paper/[0.12] text-ink border border-line',
  outline:
    'bg-transparent hover:bg-ink/[0.04] dark:hover:bg-paper/[0.06] text-ink border border-line',
  ghost:
    'text-muted hover:text-ink hover:bg-ink/[0.04] dark:hover:bg-paper/[0.06] border border-transparent',
  danger:
    'bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-600/20 border border-transparent',
  success:
    'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/20 border border-transparent',
};

const SIZES: Record<Size, string> = {
  sm: 'text-xs px-2.5 py-1.5 rounded-lg',
  md: 'text-xs px-3.5 py-2 rounded-xl font-medium',
  lg: 'text-sm px-4 py-2.5 rounded-xl font-medium',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
