"use client";

import { useEffect, useRef } from "react";
import type { KeyboardEvent, ReactNode } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "audio[controls]",
  "video[controls]",
  "summary",
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex="-1"])',
].join(",");

type ModalProps = {
  children: ReactNode;
  /** Close handler. `null` disables all close behavior (backdrop, Escape). */
  onClose: (() => void) | null;
  /**
   * ID of a visible heading inside the dialog. Prefer this over `ariaLabel`
   * so screen readers announce the real title text.
   */
  labelledBy?: string;
  /**
   * Accessible name used only when there is no visible heading to point at
   * (`labelledBy` wins when both are provided).
   */
  ariaLabel?: string;
  /**
   * When true (e.g. a submit is in flight) the backdrop and Escape never close
   * the dialog. The caller's own disabled buttons still guard their behavior.
   */
  closeDisabled?: boolean;
};

/**
 * Shared PerDev dialog wrapper.
 *
 * Owns the fixed full-screen layer, the dimmed click-to-close backdrop, the
 * `role="dialog"`/`aria-modal` semantics, and keyboard focus behavior:
 * - Focus moves into the dialog when it opens (without stealing focus from an
 *   element already inside the dialog).
 * - Tab / Shift+Tab are trapped inside the dialog while it is open.
 * - Escape closes the dialog unless `closeDisabled` is set.
 * - Focus returns to the previously focused element on close.
 *
 * Visual appearance matches the pre-existing PerDev modals exactly: the same
 * positioning, backdrop, and z-level are rendered here, while each caller
 * keeps rendering its own panel, heading, and close button.
 */
export function Modal({
  children,
  onClose,
  labelledBy,
  ariaLabel,
  closeDisabled = false,
}: ModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const alreadyFocused =
      document.activeElement instanceof HTMLElement &&
      container.contains(document.activeElement)
        ? document.activeElement
        : null;
    const focusTarget =
      alreadyFocused ??
      container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ??
      container;
    focusTarget.focus({ preventScroll: true });

    return () => {
      const previous = previouslyFocusedRef.current;
      if (previous instanceof HTMLElement && previous.isConnected) {
        previous.focus();
      }
    };
  }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      if (onClose && !closeDisabled) {
        event.preventDefault();
        onClose();
      }
      return;
    }

    if (event.key !== "Tab") return;

    const container = containerRef.current;
    if (!container) return;

    const focusables = Array.from(
      container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    );
    if (focusables.length === 0) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;

    if (event.shiftKey) {
      if (active === first || !container.contains(active)) {
        event.preventDefault();
        last.focus();
      }
    } else if (active === last || !container.contains(active)) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
    >
      <div
        className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
        onClick={onClose && !closeDisabled ? onClose : undefined}
      />
      {children}
    </div>
  );
}