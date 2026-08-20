import React from 'react';

/**
 * Lightweight table primitives that enforce the pink/white palette.
 * Usage:
 * <Table>
 * <THead><TR><TH>...</TH></TR></THead>
 * <TBody><TR><TD>...</TD></TR></TBody>
 * </Table>
 */

export function Table({ children }: { children: React.ReactNode }) {
 return (
 <div className="overflow-x-auto">
 <table className="w-full text-left border-collapse text-xs">{children}</table>
 </div>
 );
}

export function THead({ children }: { children: React.ReactNode }) {
 return <thead>{children}</thead>;
}

export function TBody({ children }: { children: React.ReactNode }) {
 return <tbody className="divide-y divide-pink-100">{children}</tbody>;
}

export function TR({
 children,
 header = false,
}: {
 children: React.ReactNode;
 header?: boolean;
}) {
 return (
 <tr
 className={
 header
 ? 'border-b border-pink-100 bg-pink-50/50 text-pink-900 font-bold'
 : 'hover:bg-pink-50/40 transition'
 }
 >
 {children}
 </tr>
 );
}

export function TH({ children, className = '' }: { children: React.ReactNode; className?: string }) {
 return <th className={`p-3 ${className}`}>{children}</th>;
}

export function TD({ children, className = '' }: { children: React.ReactNode; className?: string }) {
 return <td className={`p-3 ${className}`}>{children}</td>;
}
