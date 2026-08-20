  'use client';

import "./supplyChain.css";
import AceternityNavbar, { ShadUiNav } from "./components/global/Navbar";
import { AIProvider, useAI } from "./ai/services/AIContext";
import AIChatbot from "./ai/services/AIChatbot";
import { SessionGuard } from "./components/server/SessionGuard";
import { OfflineDetector } from "./components/global/OfflineDetector";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Toaster } from "sonner";
import Lenis from "lenis";
import CustomCursor from "./components/global/CustomCursor";

function AIChatbotWrapper() {
  const { isOpen, closeChat } = useAI();
  return <AIChatbot isOpen={isOpen} onClose={closeChat} />;
}

function LayoutContent({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const lenisRef = useRef<Lenis | null>(null);
  const router = useRouter();
  const { isOpen: isAIOpen } = useAI();

  useEffect(() => {
    const sessionToken = localStorage.getItem('session_token');

    if (!sessionToken) {
      router.push('/scAuth');
      return;
    }

    setIsLoading(false);
  }, [router]);

  // Initialize Lenis smooth scroll
  useEffect(() => {
    if (isLoading) return;

    const lenis = new Lenis({
      duration: 1.0,
      smoothWheel: true,
      allowNestedScroll: true,
      prevent: (node: HTMLElement) => {
        if (!node) return false;
        if (node.hasAttribute?.('data-lenis-prevent')) return true;
        if (node.closest?.('[data-lenis-prevent]')) return true;
        if (node.closest?.('table, .table-pro, [role="dialog"], [role="menu"]')) return true;

        let el: HTMLElement | null = node;
        while (el && el !== document.body && el !== document.documentElement) {
          const style = window.getComputedStyle(el);
          const overflowY = style.overflowY;
          const overflowX = style.overflowX;
          if (
            (overflowY === 'auto' || overflowY === 'scroll') &&
            el.scrollHeight > el.clientHeight
          ) {
            return true;
          }
          if (
            (overflowX === 'auto' || overflowX === 'scroll') &&
            el.scrollWidth > el.clientWidth
          ) {
            return true;
          }
          el = el.parentElement;
        }

        return false;
      },
    });
    lenisRef.current = lenis;
    (window as unknown as { __lenis?: Lenis }).__lenis = lenis;

    let rafId: number;
    function raf(time: number) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
      lenisRef.current = null;
      delete (window as unknown as { __lenis?: Lenis }).__lenis;
    };
  }, [isLoading]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500"></div>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Verifying session...</p>
        </div>
      </div>
    );
  }

  return (
    <OfflineDetector
      autoReconnect={true}
      reconnectInterval={30000}
      blurAmount={4}
    >
      <CustomCursor containerRef={containerRef} />
      <div ref={containerRef} className="supplychain-container font-rethink bg-[#FCFBF9] dark:bg-ink min-h-screen">
        <AnimatePresence mode="wait">
          {!isAIOpen && (
            <motion.div
              initial={{ y: 0, opacity: 1 }}
              exit={{ y: -100, opacity: 0 }}
              transition={{
                duration: 0.3,
                ease: "easeInOut"
              }}
            >
              <AceternityNavbar />
            </motion.div>
          )}
        </AnimatePresence>

        <main className="main-shell mt-18">
          {children}
        </main>

        <ShadUiNav />
        <AIChatbotWrapper />
      </div>
    </OfflineDetector>
  );
}

export default function SupplyChainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionGuard requiredRole={['Admin', 'Manager', 'Employee', 'Operator', 'Executive']}>
      <AIProvider>
        <LayoutContent>{children}</LayoutContent>
      </AIProvider>
    </SessionGuard>
  );
}