import React from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type Size = 'sm' | 'md';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
 variant?: Variant;
 size?: Size;
}

const VARIANTS: Record<Variant, string> = {
 primary:
 'bg-pink-600 hover:bg-pink-700 text-white shadow-md shadow-pink-200 border border-transparent',
 secondary:
 'bg-pink-50 hover:bg-pink-100 text-pink-700 border border-pink-200 ',
 ghost: 'text-pink-600 hover:bg-pink-50 border border-transparent',
 danger:
 'bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-200 border border-transparent',
 success:
 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-200 border border-transparent',
};

const SIZES: Record<Size, string> = {
 sm: 'text-[10px] px-2.5 py-1 rounded-lg',
 md: 'text-xs px-4 py-2.5 rounded-xl',
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
 className={`inline-flex items-center justify-center gap-2 font-bold transition disabled:opacity-50 disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
 {...props}
 >
 {children}
 </button>
 );
}
