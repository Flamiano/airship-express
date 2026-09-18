import React, { forwardRef, useEffect, useRef, useState, useCallback } from 'react';
import { cn } from '../../utils/helpers/classNames';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    helperText?: string;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    fullWidth?: boolean;
    caretSrc?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    (
        {
            className,
            label,
            error,
            helperText,
            leftIcon,
            rightIcon,
            fullWidth = true,
            caretSrc = '/images/logo-remove-bg.png',
            id,
            onFocus,
            onBlur,
            onChange,
            onSelect,
            onKeyUp,
            onClick,
            value,
            defaultValue,
            ...props
        },
        ref
    ) => {
        const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
        const innerRef = useRef<HTMLInputElement | null>(null);
        const mirrorRef = useRef<HTMLSpanElement | null>(null);
        const [focused, setFocused] = useState(false);
        const [caretLeft, setCaretLeft] = useState(0);
        const [caretVisible, setCaretVisible] = useState(false);

        const setRefs = (node: HTMLInputElement | null) => {
            innerRef.current = node;
            if (typeof ref === 'function') ref(node);
            else if (ref)
                (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
        };

        const measureCaret = useCallback(() => {
            const el = innerRef.current;
            const mirror = mirrorRef.current;
            if (!el || !mirror) return;

            const computed = window.getComputedStyle(el);
            const paddingLeft = parseFloat(computed.paddingLeft) || 0;
            const paddingRight = parseFloat(computed.paddingRight) || 0;
            const borderLeft = parseFloat(computed.borderLeftWidth) || 0;

            const pos = el.selectionStart ?? el.value.length;
            const textBefore = el.value.substring(0, pos);

            mirror.style.font = computed.font;
            mirror.style.fontFamily = computed.fontFamily;
            mirror.style.fontSize = computed.fontSize;
            mirror.style.fontWeight = computed.fontWeight;
            mirror.style.letterSpacing = computed.letterSpacing;
            mirror.textContent = textBefore;

            const textWidth = mirror.getBoundingClientRect().width;

            const inputWidth = el.getBoundingClientRect().width;
            const maxLeft = inputWidth - paddingRight - 8;
            const nextLeft = Math.min(
                borderLeft + paddingLeft + textWidth,
                maxLeft
            );

            setCaretLeft(nextLeft);
            setCaretVisible(true);
        }, []);

        const scheduleMeasure = useCallback(() => {
            if (typeof window === 'undefined') return;
            window.requestAnimationFrame(() => {
                window.requestAnimationFrame(measureCaret);
            });
        }, [measureCaret]);

        useEffect(() => {
            if (!focused) {
                setCaretVisible(false);
                return;
            }
            scheduleMeasure();

            const handler = () => scheduleMeasure();
            window.addEventListener('resize', handler);
            window.addEventListener('scroll', handler, true);
            return () => {
                window.removeEventListener('resize', handler);
                window.removeEventListener('scroll', handler, true);
            };
        }, [focused, value, scheduleMeasure]);

        useEffect(() => {
            const el = innerRef.current;
            if (!el) return;

            const handler = () => {
                if (document.activeElement === el) scheduleMeasure();
            };

            el.addEventListener('input', handler);
            el.addEventListener('keyup', handler);
            el.addEventListener('click', handler);
            el.addEventListener('select', handler);
            el.addEventListener('focus', handler);
            el.addEventListener('scroll', handler);

            const onSelectionChange = () => {
                if (document.activeElement === el) scheduleMeasure();
            };
            document.addEventListener('selectionchange', onSelectionChange);

            return () => {
                el.removeEventListener('input', handler);
                el.removeEventListener('keyup', handler);
                el.removeEventListener('click', handler);
                el.removeEventListener('select', handler);
                el.removeEventListener('focus', handler);
                el.removeEventListener('scroll', handler);
                document.removeEventListener('selectionchange', onSelectionChange);
            };
        }, [scheduleMeasure]);

        return (
            <div className={cn(fullWidth && 'w-full')}>
                {label && (
                    <label
                        htmlFor={inputId}
                        className="block text-xs font-medium text-ink mb-1.5 font-rethink"
                    >
                        {label}
                    </label>
                )}
                <div className="relative">
                    {leftIcon && (
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted">
                            {leftIcon}
                        </div>
                    )}

                    <input
                        ref={setRefs}
                        id={inputId}
                        value={value}
                        defaultValue={defaultValue}
                        onChange={(e) => {
                            onChange?.(e);
                            scheduleMeasure();
                        }}
                        onFocus={(e) => {
                            setFocused(true);
                            onFocus?.(e);
                        }}
                        onBlur={(e) => {
                            setFocused(false);
                            onBlur?.(e);
                        }}
                        onSelect={(e) => {
                            scheduleMeasure();
                            onSelect?.(e);
                        }}
                        onKeyUp={(e) => {
                            scheduleMeasure();
                            onKeyUp?.(e);
                        }}
                        onClick={(e) => {
                            scheduleMeasure();
                            onClick?.(e);
                        }}
                        className={cn(
                            'block w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 text-sm text-ink placeholder:text-muted/70 font-rethink caret-transparent',
                            'outline-none transition-colors duration-150',
                            'focus:border-accent focus:ring-2 focus:ring-accent/15',
                            'disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-ink/[0.02]',
                            'dark:border-line/30 dark:bg-ink/[0.03]',
                            leftIcon && 'pl-10',
                            rightIcon && 'pr-10',
                            error && 'border-red-400 focus:border-red-500 focus:ring-red-500/15',
                            className
                        )}
                        {...props}
                    />

                    <span
                        ref={mirrorRef}
                        aria-hidden="true"
                        className="pointer-events-none invisible absolute top-0 left-0 whitespace-pre font-rethink"
                    />

                    {focused && caretVisible && (
                        <img
                            src={caretSrc}
                            alt=""
                            aria-hidden="true"
                            draggable={false}
                            className="pointer-events-none absolute top-1/2 -translate-y-1/2 h-3.5 w-auto max-w-[14px] object-contain select-none animate-airship-caret"
                            style={{ left: `${caretLeft}px` }}
                        />
                    )}

                    {rightIcon && (
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-muted">
                            {rightIcon}
                        </div>
                    )}
                </div>
                {error && (
                    <p className="mt-1 text-xs text-red-500 font-rethink">{error}</p>
                )}
                {helperText && !error && (
                    <p className="mt-1 text-xs text-muted font-rethink">{helperText}</p>
                )}
            </div>
        );
    }
);

Input.displayName = 'Input';