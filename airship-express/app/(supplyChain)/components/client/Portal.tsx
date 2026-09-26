// app/(supplyChain)/components/client/Portal.tsx
"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

let activeModalsCount = 0;
let originalBodyOverflow: string | null = null;
let originalBodyPaddingRight: string | null = null;
let originalHtmlOverflow: string | null = null;
let originalBodyOverscroll: string | null = null;

export function lockBodyScroll() {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    if (activeModalsCount === 0) {
        // Save initial inline styles so we can restore them exactly
        originalBodyOverflow = document.body.style.overflow;
        originalBodyPaddingRight = document.body.style.paddingRight;
        originalHtmlOverflow = document.documentElement.style.overflow;
        originalBodyOverscroll = document.body.style.overscrollBehavior;

        // Prevent horizontal layout shift caused by scrollbar disappearance
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
        if (scrollbarWidth > 0) {
            document.body.style.paddingRight = `${scrollbarWidth}px`;
        }

        document.body.style.overflow = "hidden";
        document.documentElement.style.overflow = "hidden";
        document.body.style.overscrollBehavior = "contain";
    }

    activeModalsCount++;
}

export function unlockBodyScroll() {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    activeModalsCount--;

    if (activeModalsCount <= 0) {
        activeModalsCount = 0;
        document.body.style.overflow = originalBodyOverflow ?? "";
        document.body.style.paddingRight = originalBodyPaddingRight ?? "";
        document.documentElement.style.overflow = originalHtmlOverflow ?? "";
        document.body.style.overscrollBehavior = originalBodyOverscroll ?? "";
        originalBodyOverflow = null;
        originalBodyPaddingRight = null;
        originalHtmlOverflow = null;
        originalBodyOverscroll = null;
    }
}

export function useBodyScrollLock(isLocked: boolean = true) {
    useEffect(() => {
        if (!isLocked) return;
        lockBodyScroll();
        return () => {
            unlockBodyScroll();
        };
    }, [isLocked]);
}

function checkHasContent(children: React.ReactNode): boolean {
    if (!children) {
        return false;
    }
    const childrenArray = React.Children.toArray(children);
    return childrenArray.length > 0;
}

export default function Portal({ children }: { children: React.ReactNode }) {
    const [mounted, setMounted] = useState(false);
    const hasContent = checkHasContent(children);

    useEffect(() => {
        setMounted(true);
        return () => {
            setMounted(false);
        };
    }, []);

    useEffect(() => {
        if (!mounted || !hasContent) return;

        lockBodyScroll();

        return () => {
            unlockBodyScroll();
        };
    }, [mounted, hasContent]);

    if (!mounted || !hasContent) return null;

    return createPortal(<div className="supplychain-container !bg-transparent">{children}</div>, document.body);
}