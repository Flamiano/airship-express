import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  /** Full tailwind class string (bg/text/border) — usually from a *_BADGE map. */
  className?: string;
  pulse?: boolean;
}

/** Pill-shaped status badge. Color classes are passed in from constants maps. */
export function Badge({ children, className = '', pulse = false }: BadgeProps) {
  return (
    <span
      className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-[10px] border ${
        pulse ? 'animate-pulse' : ''
      } ${className}`}
    >
      {children}
    </span>
  );
}
