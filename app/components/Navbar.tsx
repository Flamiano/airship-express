"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, ArrowRight } from "lucide-react";
import moment from "moment-timezone";

const links = [
  { label: "Home", href: "/" },
  { label: "Services", href: "#services" },
  { label: "Track", href: "#track" },
  { label: "Contact", href: "#contact" },
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

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const isOpen = useIsOpenNow();

  return (
    <motion.header
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="sticky top-4 z-50 w-full px-4"
    >
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between rounded-full border border-[#EAEAEA] bg-white/80 px-4 py-2.5 shadow-sm backdrop-blur-md sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/images/logo-remove-bg.png"
            alt="Airship Express"
            width={130}
            height={36}
            priority
            className="h-7 sm:h-8 w-auto object-contain"
          />
        </Link>

        <nav className="hidden md:flex items-center gap-7 font-rethink text-sm font-medium text-[#6F6F6F]">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="relative transition-colors hover:text-[#262525] group"
            >
              {l.label}
              <span className="absolute -bottom-1 left-0 h-[1.5px] w-0 bg-[#262525] transition-all duration-300 group-hover:w-full" />
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-4">
          {isOpen !== null && (
            <span className="hidden lg:flex items-center gap-1.5 text-xs font-medium text-[#6F6F6F] font-rethink">
              <span
                className={`h-1.5 w-1.5 rounded-full ${isOpen ? "bg-emerald-500" : "bg-red-400"
                  }`}
              />
              {isOpen ? "Open now" : "Closed now"} · Manila
            </span>
          )}
          <a
            href="https://web.facebook.com/profile.php?id=61571986650033"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex h-10 items-center justify-center gap-1.5 rounded-full bg-[#262525] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#3a3a3a] font-rethink"
          >
            Book a Delivery
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
          </a>
        </div>

        <button
          onClick={() => setOpen(!open)}
          className="md:hidden text-[#262525]"
          aria-label="Toggle menu"
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto mt-2 w-full max-w-5xl overflow-hidden rounded-3xl border border-[#EAEAEA] bg-white shadow-sm md:hidden"
          >
            <div className="flex flex-col gap-1 px-6 py-4 font-rethink">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="py-2.5 text-sm font-medium text-[#6F6F6F] hover:text-[#262525]"
                >
                  {l.label}
                </Link>
              ))}
              {isOpen !== null && (
                <span className="mt-1 flex items-center gap-1.5 py-1 text-xs font-medium text-[#6F6F6F] font-rethink">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${isOpen ? "bg-emerald-500" : "bg-red-400"
                      }`}
                  />
                  {isOpen ? "Open now" : "Closed now"} · Manila
                </span>
              )}
              <a
                href="https://web.facebook.com/profile.php?id=61571986650033"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex h-11 items-center justify-center rounded-full bg-[#262525] text-sm font-semibold text-white"
              >
                Book a Delivery
              </a>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </motion.header>
  );
}