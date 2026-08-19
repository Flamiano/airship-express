"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { Menu, X, ArrowRight, ChevronDown, Phone, Mail, Search, Plane } from "lucide-react";
import moment from "moment-timezone";
import ThemeToggle from "./ThemeToggle";

function FacebookIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M13.5 21v-7.5h2.5l.5-3h-3V8.5c0-.9.25-1.5 1.55-1.5H16.5V4.36c-.27-.04-1.2-.11-2.28-.11-2.26 0-3.8 1.38-3.8 3.9V10.5H8v3h2.42V21h3.08Z" />
    </svg>
  );
}

type Child = { label: string; desc: string; href: string };
type NavLink = { label: string; href: string; children?: Child[]; wide?: boolean };

const links: NavLink[] = [
  { label: "Home", href: "/" },
  { label: "About", href: "#about" },
  {
    label: "Services",
    href: "#services",
    wide: true,
    children: [
      { label: "Metro Manila Delivery", desc: "Same-day pickup and drop-off within the metro.", href: "#services" },
      { label: "Nationwide Shipping", desc: "Door-to-door delivery across the Philippines.", href: "#services" },
      { label: "Freight & Cargo Forwarding", desc: "Bulk and palletized cargo handled end to end.", href: "#services" },
      { label: "E-commerce Drop-off", desc: "Authorized drop-off for Shopee, Lazada, TikTok Shop & more.", href: "#services" },
      { label: "Warehousing & Storage", desc: "Short and long-term storage for your inventory.", href: "#services" },
      { label: "Free Pickup & Packaging", desc: "We collect and pack your parcel at no extra cost.", href: "#services" },
    ],
  },
  {
    label: "Track & Trace",
    href: "#track",
    children: [
      { label: "Track a Package", desc: "Check the live status of your delivery.", href: "#track" },
      { label: "Bulk Tracking", desc: "Track multiple waybills at once.", href: "#track" },
      { label: "Delivery Timelines", desc: "Expected delivery windows by area.", href: "#track" },
    ],
  },
  {
    label: "Partners",
    href: "#partners",
    children: [
      { label: "Become a Reseller", desc: "Offer Airship Express delivery under your brand.", href: "#partners" },
      { label: "Drop-off Locations", desc: "Find an authorized branch near you.", href: "#partners" },
      { label: "Franchise Opportunities", desc: "Open an Airship Express branch in your area.", href: "#partners" },
    ],
  },
  {
    label: "Support",
    href: "#support",
    children: [
      { label: "FAQs", desc: "Common questions about rates and delivery.", href: "#support" },
      { label: "Shipping Guide", desc: "How to prepare and label a parcel.", href: "#support" },
      { label: "Claims & Insurance", desc: "Report a lost or damaged shipment.", href: "#support" },
    ],
  },
  {
    label: "Contact",
    href: "#contact",
    children: [
      { label: "Message us on Facebook", desc: "Fastest way to reach our team.", href: "https://web.facebook.com/profile.php?id=61571986650033" },
      { label: "Call or text", desc: "0945 441 8789 · (02) 8911-1888", href: "tel:+639454418789" },
      { label: "Email us", desc: "airshipexpress.s@gmail.com", href: "mailto:airshipexpress.s@gmail.com" },
      { label: "Visit our branch", desc: "352 Escolta St., Tomas Pinpin, Binondo, Manila", href: "#contact" },
    ],
  },
];

function useIsOpenNow() {
  const [isOpen, setIsOpen] = useState<boolean | null>(null);

  useEffect(() => {
    const check = () => {
      const hour = moment().tz("Asia/Manila").hour();
      setIsOpen(hour >= 8 && hour < 20);
    };
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, []);

  return isOpen;
}

const panelVariants: Variants = {
  hidden: { clipPath: "inset(0 0 100% 0)" },
  show: { clipPath: "inset(0 0 0% 0)", transition: { duration: 0.65, ease: [0.76, 0, 0.24, 1] } },
  exit: { clipPath: "inset(0 0 100% 0)", transition: { duration: 0.45, ease: [0.76, 0, 0.24, 1] } },
};

const listVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.055, delayChildren: 0.4 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, x: -18 },
  show: { opacity: 1, x: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
};

// entrance sequence, plays once `ready` flips true after the loader exits
const topBarVariants: Variants = {
  hidden: { opacity: 0, y: -10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};

const logoVariants: Variants = {
  hidden: { opacity: 0, y: -8, filter: "blur(4px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

const navItemVariants: Variants = {
  hidden: { opacity: 0, y: -6 },
  show: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, delay: 0.15 + i * 0.05, ease: [0.22, 1, 0.36, 1] },
  }),
};

const actionsVariants: Variants = {
  hidden: { opacity: 0, y: -8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, delay: 0.4, ease: [0.22, 1, 0.36, 1] } },
};

interface NavbarProps {
  onMenuOpenChange?: (open: boolean) => void;
  ready?: boolean;
}

export default function Navbar({ onMenuOpenChange, ready = true }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileChild, setMobileChild] = useState<number | null>(null);
  const isOpen = useIsOpenNow();
  const itemRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const scrollEl = document.querySelector<HTMLElement>(".scroll-container");
    if (!scrollEl) return;

    const handleScroll = () => setScrolled(scrollEl.scrollTop > 12);
    handleScroll();
    scrollEl.addEventListener("scroll", handleScroll, { passive: true });
    return () => scrollEl.removeEventListener("scroll", handleScroll);
  }, []);

  const onMenuOpenChangeRef = useRef(onMenuOpenChange);
  useEffect(() => {
    onMenuOpenChangeRef.current = onMenuOpenChange;
  }, [onMenuOpenChange]);

  useEffect(() => {
    onMenuOpenChangeRef.current?.(mobileOpen);
    if (!mobileOpen) setMobileChild(null);

    if (typeof document === "undefined") return;
    const scrollEl = document.querySelector<HTMLElement>(".scroll-container");
    if (!scrollEl) return;

    if (mobileOpen) {
      scrollEl.dataset.prevOverflowY = scrollEl.style.overflowY;
      scrollEl.dataset.prevTouchAction = scrollEl.style.touchAction;
      scrollEl.style.overflowY = "hidden";
      scrollEl.style.touchAction = "none";
      (window as unknown as { __lenis?: { stop?: () => void } }).__lenis?.stop?.();
    } else {
      scrollEl.style.overflowY = scrollEl.dataset.prevOverflowY ?? "";
      scrollEl.style.touchAction = scrollEl.dataset.prevTouchAction ?? "";
      (window as unknown as { __lenis?: { start?: () => void } }).__lenis?.start?.();
    }

    return () => {
      scrollEl.style.overflowY = scrollEl.dataset.prevOverflowY ?? "";
      scrollEl.style.touchAction = scrollEl.dataset.prevTouchAction ?? "";
    };
  }, [mobileOpen]);

  useEffect(() => {
    if (mobileChild === null) return;
    const el = itemRefs.current[mobileChild];
    if (!el) return;
    const id = setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 280);
    return () => clearTimeout(id);
  }, [mobileChild]);

  return (
    <header className="sticky top-0 z-50 w-full">
      {/* desktop info bar */}
      <motion.div
        variants={topBarVariants}
        initial="hidden"
        animate={ready ? "show" : "hidden"}
        className="hidden border-b border-white/10 bg-[#1c1b1f] lg:block"
      >
        <div className="mx-auto flex h-9 max-w-7xl items-center justify-between px-6 font-rethink text-xs text-white/70 lg:px-8">
          <div className="flex items-center gap-5">
            <a href="tel:+639454418789" className="flex items-center gap-1.5 transition-colors hover:text-white">
              <Phone className="h-3 w-3" />
              0945 441 8789
            </a>

            <a href="mailto:airshipexpress.s@gmail.com"
              className="flex items-center gap-1.5 transition-colors hover:text-white"
            >
              <Mail className="h-3 w-3" />
              airshipexpress.s@gmail.com
            </a>
          </div>
          <div className="flex items-center gap-5">
            {isOpen !== null && (
              <span className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${isOpen ? "bg-accent" : "bg-red-400"}`} />
                {isOpen ? "Open now" : "Closed now"} · Manila
              </span>
            )}

            <a href="https://web.facebook.com/profile.php?id=61571986650033"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-white"
              aria-label="Facebook"
            >
              <FacebookIcon className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </motion.div >

      {/* main bar */}
      <div
        className={`relative z-50 w-full border-b transition-all duration-300 ${scrolled
          ? "border-line bg-paper/90 shadow-sm shadow-ink/5 backdrop-blur-md dark:border-paper/10 dark:bg-ink/90 dark:shadow-black/20"
          : "border-transparent bg-transparent backdrop-blur-0"
          }`
        }
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <motion.div variants={logoVariants} initial="hidden" animate={ready ? "show" : "hidden"}>
            <Link href="/" className="flex shrink-0 items-center">
              <Image
                src="/images/logo-remove-bg.png"
                alt="Airship Express"
                width={130}
                height={36}
                priority
                className="h-7 w-auto object-contain sm:h-8 dark:brightness-0 dark:invert"
              />
            </Link>
          </motion.div>

          <nav className="hidden items-center gap-0.5 lg:flex">
            {links.map((link, i) => (
              <motion.div
                key={link.href}
                custom={i}
                variants={navItemVariants}
                initial="hidden"
                animate={ready ? "show" : "hidden"}
                className="group relative"
              >
                <Link
                  href={link.href}
                  className="flex items-center gap-1 rounded-md px-2.5 py-2 font-rethink text-sm font-medium text-muted transition-colors hover:bg-line/40 hover:text-ink dark:text-paper/60 dark:hover:bg-paper/10 dark:hover:text-paper"
                >
                  {link.label}
                  {link.children && (
                    <ChevronDown className="h-3.5 w-3.5 text-muted transition-transform duration-200 group-hover:rotate-180 dark:text-paper/40" />
                  )}
                </Link>

                {link.children && (
                  <div
                    className={`invisible absolute left-0 top-full z-10 mt-1 translate-y-1 rounded-xl border border-line bg-paper p-2 opacity-0 shadow-lg shadow-ink/5 transition-all duration-150 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100 dark:border-paper/10 dark:bg-[#232227] dark:shadow-black/30 ${link.wide ? "grid w-[34rem] grid-cols-2 gap-1" : "w-72"
                      }`}
                  >
                    {link.children.map((child) => (
                      <a
                        key={child.label}
                        href={child.href}
                        className="flex flex-col gap-0.5 rounded-lg px-3 py-2 transition-colors hover:bg-line/50 dark:hover:bg-paper/10"
                      >
                        <span className="font-rethink text-sm font-medium text-ink dark:text-paper">{child.label}</span>
                        <span className="font-rethink text-xs text-muted dark:text-paper/50">{child.desc}</span>
                      </a>
                    ))}
                  </div>
                )}
              </motion.div>
            ))}
          </nav>

          <motion.div
            variants={actionsVariants}
            initial="hidden"
            animate={ready ? "show" : "hidden"}
            className="hidden items-center gap-2 lg:flex xl:gap-3"
          >
            <ThemeToggle />
            <a
              href="#track"
              className="flex h-10 items-center justify-center gap-1.5 rounded-full border border-line px-4 font-rethink text-sm font-medium text-ink transition-colors hover:bg-line/40 dark:border-paper/15 dark:text-paper dark:hover:bg-paper/10"
            >
              <Search className="h-3.5 w-3.5" />
              Track Shipment
            </a>
            <a
              href="https://web.facebook.com/profile.php?id=61571986650033"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex h-10 items-center justify-center gap-1.5 rounded-full bg-ink px-5 font-rethink text-sm font-semibold text-paper transition-colors hover:bg-accent dark:bg-accent dark:hover:bg-accent-dark"
            >
              Book a Delivery
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </a>
          </motion.div>

          <motion.div
            variants={actionsVariants}
            initial="hidden"
            animate={ready ? "show" : "hidden"}
            className="flex items-center gap-2 lg:hidden"
          >
            <ThemeToggle />
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="relative flex h-10 w-10 items-center justify-center rounded-full text-ink transition-colors hover:bg-line/40 dark:text-paper dark:hover:bg-paper/10"
              aria-label="Toggle menu"
              aria-expanded={mobileOpen}
            >
              <AnimatePresence mode="wait" initial={false}>
                {mobileOpen ? (
                  <motion.span
                    key="close"
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex"
                  >
                    <X className="h-5 w-5" />
                  </motion.span>
                ) : (
                  <motion.span
                    key="open"
                    initial={{ rotate: 90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: -90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex"
                  >
                    <Menu className="h-5 w-5" />
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </motion.div>
        </div>
      </ div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            key="mobile-manifest"
            variants={panelVariants}
            initial="hidden"
            animate="show"
            exit="exit"
            className="fixed inset-x-0 top-16 bottom-0 z-40 overflow-hidden bg-paper dark:bg-ink lg:hidden"
          >
            <motion.div
              initial={{ top: "0%", opacity: 1 }}
              animate={{ top: "100%", opacity: 0 }}
              transition={{ duration: 0.75, ease: "easeInOut" }}
              className="pointer-events-none absolute left-0 right-0 z-10 h-20 bg-gradient-to-b from-transparent via-accent/25 to-transparent"
            />

            <div className="pointer-events-none absolute bottom-0 left-0 top-0 flex w-7 items-center justify-center border-r border-dashed border-line dark:border-paper/10">
              <span
                className="whitespace-nowrap font-mono text-[9px] font-medium uppercase tracking-[0.35em] text-muted/50 dark:text-paper/25"
                style={{ writingMode: "vertical-rl" }}
              >
                AX · TRACKING MANIFEST · AIRSHIP EXPRESS
              </span>
            </div>

            <div className="flex h-full flex-col pl-7">
              <motion.nav
                variants={listVariants}
                initial="hidden"
                animate="show"
                className="flex-1 touch-pan-y overflow-y-auto overscroll-contain px-5 pt-4"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                {links.map((link, i) => (
                  <motion.div
                    key={link.href}
                    ref={(el) => {
                      itemRefs.current[i] = el;
                    }}
                    variants={itemVariants}
                    className="border-b border-dashed border-line last:border-none dark:border-paper/10"
                  >
                    <div className="flex items-center justify-between">
                      <Link
                        href={link.href}
                        onClick={() => !link.children && setMobileOpen(false)}
                        className="flex flex-1 items-baseline gap-3 py-3.5"
                      >
                        <span className="font-mono text-[11px] font-semibold text-accent">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="font-bricolage text-lg font-bold tracking-[-0.01em] text-ink dark:text-paper">
                          {link.label}
                        </span>
                      </Link>
                      {link.children && (
                        <button
                          type="button"
                          onClick={() => setMobileChild(mobileChild === i ? null : i)}
                          className="p-3.5 text-muted dark:text-paper/50"
                          aria-label="Expand submenu"
                        >
                          <ChevronDown
                            className={`h-4 w-4 transition-transform duration-200 ${mobileChild === i ? "rotate-180 text-accent" : ""
                              }`}
                          />
                        </button>
                      )}
                    </div>
                    <AnimatePresence>
                      {link.children && mobileChild === i && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                          className="overflow-hidden pb-3 pl-9"
                        >
                          {link.children.map((child) => (
                            <a
                              key={child.label}
                              href={child.href}
                              onClick={() => setMobileOpen(false)}
                              className="flex items-start gap-2 rounded-lg py-2 pr-2 transition-colors hover:bg-line/40 dark:hover:bg-paper/10"
                            >
                              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
                              <span className="flex flex-col">
                                <span className="font-rethink text-sm font-medium text-ink dark:text-paper">
                                  {child.label}
                                </span>
                                <span className="font-rethink text-xs text-muted dark:text-paper/50">
                                  {child.desc}
                                </span>
                              </span>
                            </a>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
              </motion.nav>

              <motion.div
                variants={itemVariants}
                initial="hidden"
                animate="show"
                className="relative shrink-0 border-t border-line px-5 pb-6 pt-5 dark:border-paper/10"
              >
                <div aria-hidden className="absolute -top-2.5 left-0 right-0 flex justify-between px-1">
                  {Array.from({ length: 14 }).map((_, i) => (
                    <span key={i} className="h-1.5 w-1.5 rounded-full bg-paper dark:bg-ink" />
                  ))}
                </div>

                <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted dark:text-paper/40">
                  <span className="flex items-center gap-1.5">
                    <Plane className="h-3 w-3 -rotate-45 text-accent" />
                    AX 4471 0562 PH
                  </span>
                  {isOpen !== null && (
                    <span className="flex items-center gap-1.5 normal-case tracking-normal">
                      <span className={`h-1.5 w-1.5 rounded-full ${isOpen ? "bg-accent" : "bg-red-400"}`} />
                      {isOpen ? "Open now" : "Closed"}
                    </span>
                  )}
                </div>

                <div className="mt-3 flex flex-col gap-1.5 font-rethink text-xs text-muted dark:text-paper/50">
                  <a href="tel:+639454418789" className="flex items-center gap-1.5">
                    <Phone className="h-3 w-3" />
                    0945 441 8789
                  </a>
                  <a href="mailto:airshipexpress.s@gmail.com" className="flex items-center gap-1.5">
                    <Mail className="h-3 w-3" />
                    airshipexpress.s@gmail.com
                  </a>
                </div>

                <div className="mt-4 flex gap-2.5">
                  <a
                    href="#track"
                    onClick={() => setMobileOpen(false)}
                    className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full border border-line font-rethink text-sm font-medium text-ink dark:border-paper/15 dark:text-paper"
                  >
                    <Search className="h-3.5 w-3.5" />
                    Track
                  </a>
                  <a
                    href="https://web.facebook.com/profile.php?id=61571986650033"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setMobileOpen(false)}
                    className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-ink font-rethink text-sm font-semibold text-paper dark:bg-accent"
                  >
                    Book a Delivery
                    <ArrowRight className="h-3.5 w-3.5" />
                  </a>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header >
  );
}