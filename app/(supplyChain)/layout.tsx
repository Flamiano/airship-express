'use client';
import "./supplyChain.css";
import AceternityNavbar, { ShadUiNav } from "./components/global/Navbar";
import { AIProvider, useAI } from "./ai/services/AIContext";
import AIChatbot from "./ai/services/AIChatbot";
import { SessionGuard } from "./components/server/SessionGuard";
import { OfflineDetector } from "./components/global/OfflineDetector";
import { useEffect, useState, useRef, createContext, useContext } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import Lenis from "lenis";
import CustomCursor from "./components/global/CustomCursor";
import SupplyChainFooter from "./components/global/SupplyChainFooter";
import { user } from "./lib/services/Class/user";

export const NavVisibilityContext = createContext<{
    isNavHidden: boolean;
    setIsNavHidden: (hidden: boolean) => void;
}>({
    isNavHidden: false,
    setIsNavHidden: () => {},
});

export const useNavVisibility = () => useContext(NavVisibilityContext);

function AIChatbotWrapper() {
    const { isOpen, closeChat } = useAI();
    const { isNavHidden } = useNavVisibility();
    const pathname = usePathname();
    const isPortal = pathname?.startsWith('/suppliers_page') || pathname?.startsWith('/supplier-portal');
    if (isNavHidden || isPortal) return null;
    return <AIChatbot isOpen={isOpen} onClose={closeChat}/>;
}

function AnimatedTopNavbar() {
    const { isOpen: isAIOpen } = useAI();
    const { isNavHidden } = useNavVisibility();
    const pathname = usePathname();
    const isPortal = pathname?.startsWith('/suppliers_page') || pathname?.startsWith('/supplier-portal');
    if (isNavHidden || isPortal) return null;
    return (
        <motion.div
            key="supplychain-navbar-wrapper"
            initial={false}
            animate={{
                y: isAIOpen ? -90 : 0,
                opacity: isAIOpen ? 0 : 1,
            }}
            transition={{
                duration: 0.28,
                ease: [0.16, 1, 0.3, 1],
            }}
            style={{
                pointerEvents: isAIOpen ? "none" : "auto",
            }}
            className="fixed inset-x-0 top-0 z-40 w-full will-change-transform transform-gpu"
        >
            <AceternityNavbar />
        </motion.div>
    );
}

function AnimatedBottomNav() {
    const { isOpen: isAIOpen } = useAI();
    const { isNavHidden } = useNavVisibility();
    const pathname = usePathname();
    const isPortal = pathname?.startsWith('/suppliers_page') || pathname?.startsWith('/supplier-portal');
    if (isNavHidden || isPortal) return null;
    return (
        <motion.div
            key="supplychain-shaduibar-wrapper"
            initial={false}
            animate={{
                y: isAIOpen ? 30 : 0,
                scale: isAIOpen ? 0.9 : 1,
                opacity: isAIOpen ? 0 : 1,
            }}
            transition={{
                duration: 0.25,
                ease: [0.16, 1, 0.3, 1],
            }}
            style={{
                pointerEvents: isAIOpen ? "none" : "auto",
            }}
            className="fixed bottom-8 right-3 z-50 pointer-events-auto will-change-transform transform-gpu"
        >
            <ShadUiNav />
        </motion.div>
    );
}

function FooterWrapper() {
    const { isNavHidden } = useNavVisibility();
    const pathname = usePathname();
    const isPortal = pathname?.startsWith('/suppliers_page') || pathname?.startsWith('/supplier-portal');
    if (isNavHidden || isPortal) return null;
    return <SupplyChainFooter />;
}

function LayoutContent({ children }: {
    children: React.ReactNode;
}) {
    const [isNavHidden, setIsNavHidden] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const lenisRef = useRef<Lenis | null>(null);
    const pathname = usePathname();
    const isPortal = pathname?.startsWith('/suppliers_page') || pathname?.startsWith('/supplier-portal');

    // start smooth scroll on non-touch desktop and skip nested areas
    useEffect(() => {

        // Skip Lenis on mobile/touch devices to ensure native hardware-accelerated smooth touch scrolling
        const isTouchDevice = typeof window !== 'undefined' && (
            window.innerWidth < 768 ||
            window.matchMedia('(pointer: coarse)').matches ||
            'ontouchstart' in window
        );

        if (isTouchDevice) {
            return;
        }

        const lenis = new Lenis({
            duration: 1.0,
            smoothWheel: true,
            allowNestedScroll: true,
            prevent: (node: HTMLElement) => {
                if (!node)
                    return false;
                if (node.hasAttribute?.('data-lenis-prevent'))
                    return true;
                if (node.closest?.('[data-lenis-prevent], [role="dialog"], [role="menu"]'))
                    return true;
                return false;
            },
        });
        lenisRef.current = lenis;
        (window as unknown as {
            __lenis?: Lenis;
        }).__lenis = lenis;
        let rafId: number;
        function raf(time: number) {
            lenis.raf(time);
            rafId = requestAnimationFrame(raf);
        }
        rafId = requestAnimationFrame(raf);

        // Auto-recalculate scroll boundaries whenever DOM dynamically expands
        const resizeObserver = new ResizeObserver(() => {
            lenis.resize();
        });
        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }
        const onWinResize = () => lenis.resize();
        window.addEventListener('resize', onWinResize);

        // clean up animation frame and lenis
        return () => {
            cancelAnimationFrame(rafId);
            resizeObserver.disconnect();
            window.removeEventListener('resize', onWinResize);
            lenis.destroy();
            lenisRef.current = null;
            delete (window as unknown as {
                __lenis?: Lenis;
            }).__lenis;
        };
    }, []);

    return (
        <NavVisibilityContext.Provider value={{ isNavHidden, setIsNavHidden }}>
            <CustomCursor containerRef={containerRef}/>
            <OfflineDetector autoReconnect={true} reconnectInterval={30000} blurAmount={4}>
                <div ref={containerRef} className="supplychain-container relative w-full max-w-full overflow-x-hidden font-rethink bg-[#FCFBF9] dark:bg-ink min-h-screen flex flex-col justify-between">
                    {/* Ambient decorative background glows & geometric shapes constrained in overflow-hidden */}
                    {!isNavHidden && !isPortal && (
                        <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
                            <div aria-hidden className="pointer-events-none absolute -top-32 -left-32 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
                            <div aria-hidden className="pointer-events-none absolute -top-20 -right-24 h-72 w-72 rounded-full blur-3xl transition-colors duration-500 bg-ink/5 dark:bg-paper/5" />
                            <div
                                aria-hidden
                                className="pointer-events-none absolute -bottom-10 left-8 hidden h-24 w-24 rounded-full border-[14px] border-accent/60 lg:block"
                                style={{ clipPath: "inset(0 0 50% 0)" }}
                            />
                            <div aria-hidden className="pointer-events-none absolute bottom-24 right-0 hidden h-16 w-16 rounded-tl-full bg-accent/20 lg:block" />
                            <div aria-hidden className="pointer-events-none absolute bottom-8 right-0 hidden h-16 w-16 rounded-bl-full bg-accent/40 lg:block" />
                        </div>
                    )}

                    <AnimatedTopNavbar />

                    <FooterWrapper />

                    <main className={`relative z-10 flex-1 flex flex-col w-full max-w-full min-w-0 overflow-x-hidden ${isNavHidden || isPortal ? 'mt-0 pb-0' : 'mt-16 sm:mt-18 pb-16'}`}>
                        {children}
                    </main>

                    <AnimatedBottomNav />
                    <AIChatbotWrapper />
                </div>
            </OfflineDetector>
        </NavVisibilityContext.Provider>
    );
}

export default function SupplyChainLayout({ children, }: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const isPublicRoute = 
        pathname === '/scAuth' || 
        pathname?.startsWith('/supplier-portal') || 
        pathname?.startsWith('/suppliers_page');

    if (isPublicRoute) {
        return (
            <AIProvider>
                <LayoutContent>{children}</LayoutContent>
            </AIProvider>
        );
    }

    return (
        <SessionGuard requiredRole={['Superadmin', 'Admin', 'Purchase Officer', 'Staff', 'Employee', 'Operator', 'Executive', 'Supplier']}>
            <AIProvider>
                <LayoutContent>{children}</LayoutContent>
            </AIProvider>
        </SessionGuard>
    );
}
