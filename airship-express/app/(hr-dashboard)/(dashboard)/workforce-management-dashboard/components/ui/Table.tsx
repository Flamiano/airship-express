import React from 'react';

/**
 * Lightweight table primitives that enforce the theme palette.
 * Usage:
 * <Table>
 *   <THead><TR header><TH>...</TH></TR></THead>
 *   <TBody><TR><TD>...</TD></TR></TBody>
 * </Table>
 */

export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-left border-collapse text-xs">{children}</table>
    </div>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return <thead>{children}</thead>;
}

export function TBody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-line">{children}</tbody>;
}

export function TR({
  children,
  header = false,
  className = '',
}: {
  children: React.ReactNode;
  header?: boolean;
  className?: string;
}) {
  return (
    <tr
      className={
        header
          ? `border-b border-line bg-ink/[0.02] dark:bg-paper/[0.04] text-muted font-semibold ${className}`
          : `border-b border-line hover:bg-ink/[0.02] dark:hover:bg-paper/[0.04] transition-colors ${className}`
      }
    >
      {children}
    </tr>
  );
}

export function TH({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`p-3 text-left font-medium text-muted align-middle ${className}`}>{children}</th>;
}

export function TD({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`p-3 align-middle text-ink ${className}`}>{children}</td>;
}

