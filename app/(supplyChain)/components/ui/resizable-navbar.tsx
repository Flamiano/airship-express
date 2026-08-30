"use client";
import { cn } from "@/app/(supplyChain)/lib/utils";
import { IconMenu2, IconX } from "@tabler/icons-react";
import {
  motion,
  AnimatePresence,
  useScroll,
  useMotionValueEvent,
} from "motion/react";
import Image from "next/image";

import React, { useRef, useState, useEffect } from "react";

interface NavbarProps {
  children: React.ReactNode;
  className?: string;
}

interface NavBodyProps {
  children: React.ReactNode;
  className?: string;
  visible?: boolean;
}

interface NavItemsProps {
  items: {
    name: string;
    link: string;
  }[];
  className?: string;
  onItemClick?: () => void;
}

interface MobileNavProps {
  children: React.ReactNode;
  className?: string;
  visible?: boolean;
}

interface MobileNavHeaderProps {
  children: React.ReactNode;
  className?: string;
}

interface MobileNavMenuProps {
  children: React.ReactNode;
  className?: string;
  isOpen: boolean;
  onClose: () => void;
}

export const Navbar = ({ children, className }: NavbarProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const [visible, setVisible] = useState<boolean>(false);

  useMotionValueEvent(scrollY, "change", (latest) => {
    if (latest > 40) {
      setVisible(true);
    } else {
      setVisible(false);
    }
  });

  return (
    <motion.div
      ref={ref}
      className={cn(
        "fixed inset-x-0 top-0 z-50 w-full px-4 sm:px-6 transition-all duration-300",
        className,
      )}
    >
      {React.Children.map(children, (child) =>
        React.isValidElement(child)
          ? React.cloneElement(
            child as React.ReactElement<{ visible?: boolean }>,
            { visible },
          )
          : child,
      )}
    </motion.div>
  );
};

export const NavBody = ({ children, className, visible }: NavBodyProps) => {
  return (
    <motion.div
      animate={{
        backdropFilter: visible ? "blur(16px)" : "blur(8px)",
        boxShadow: visible
          ? "0 12px 36px -8px rgba(0, 0, 0, 0.1), inset 0 1px 0 #ffffff"
          : "0 4px 20px -4px rgba(0, 0, 0, 0.06), inset 0 1px 0 #ffffff",
        width: visible ? "96%" : "100%",
        maxWidth: "1440px",
        y: visible ? 6 : 0,
        borderRadius: "1.25rem",
      }}
      transition={{
        type: "spring",
        stiffness: 260,
        damping: 32,
      }}
      className={cn(
        "relative z-[60] mx-auto hidden w-full flex-row items-center justify-between self-start px-4 xl:px-6 py-2 xl:py-2.5 lg:flex transition-all duration-200 gap-3 xl:gap-6",
        "bg-white/95 border border-slate-200/90 dark:bg-[#181920]/95 dark:border-[#353746] dark:shadow-[0_12px_36px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.08)]",
        className,
      )}
    >
      {children}
    </motion.div>
  );
};

export const NavItems = ({ items, className, onItemClick }: NavItemsProps) => {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <motion.div
      onMouseLeave={() => setHovered(null)}
      className={cn(
        "absolute inset-0 hidden flex-1 flex-row items-center justify-center space-x-1 text-sm font-medium text-slate-600 lg:flex",
        className,
      )}
    >
      {items.map((item, idx) => (
        <a
          onMouseEnter={() => setHovered(idx)}
          onClick={onItemClick}
          className="relative px-4 py-2 text-slate-600 transition-colors duration-150 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          key={`link-${idx}`}
          href={item.link}
        >
          {hovered === idx && (
            <motion.div
              layoutId="hovered-pill"
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="absolute inset-0 h-full w-full rounded-full bg-slate-100 dark:bg-neutral-800/80"
            />
          )}
          <span className="relative z-20">{item.name}</span>
        </a>
      ))}
    </motion.div>
  );
};

export const MobileNav = ({ children, className, visible }: MobileNavProps) => {
  return (
    <motion.div
      animate={{
        backdropFilter: visible ? "blur(16px)" : "blur(12px)",
        boxShadow: visible
          ? "0 10px 25px -5px rgba(0, 0, 0, 0.08), inset 0 1px 0 #ffffff"
          : "0 4px 12px rgba(0,0,0,0.04), inset 0 1px 0 #ffffff",
        width: visible ? "96%" : "100%",
        paddingRight: visible ? "14px" : "12px",
        paddingLeft: visible ? "14px" : "12px",
        borderRadius: "1.25rem",
        y: visible ? 4 : 0,
      }}
      transition={{
        type: "spring",
        stiffness: 260,
        damping: 32,
      }}
      className={cn(
        "relative z-50 mx-auto flex w-full flex-col items-center justify-between bg-white/95 border border-slate-200/90 px-4 py-2.5 lg:hidden dark:bg-[#181920]/95 dark:border-[#353746] dark:shadow-[0_10px_30px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.08)]",
        className,
      )}
    >
      {children}
    </motion.div>
  );
};

export const MobileNavHeader = ({
  children,
  className,
}: MobileNavHeaderProps) => {
  return (
    <div
      className={cn(
        "flex w-full flex-row items-center justify-between",
        className,
      )}
    >
      {children}
    </div>
  );
};

export const MobileNavMenu = ({
  children,
  className,
  isOpen,
  onClose,
}: MobileNavMenuProps) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Blurred Background Overlay - only shows when menu is open */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 top-20 z-30 bg-black/30 backdrop-blur-md dark:bg-black/40"
            onClick={onClose}
          />

          {/* Mobile Menu Dropdown Card */}
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{
              type: "spring",
              stiffness: 350,
              damping: 28,
            }}
            className={cn(
              "fixed left-4 right-4 top-20 z-40 flex flex-col rounded-2xl bg-white/95 backdrop-blur-sm shadow-2xl dark:bg-neutral-900/95",
              "max-h-[calc(100vh-6.5rem)] overflow-hidden border border-slate-200/80 dark:border-neutral-800",
              className,
            )}
          >
            <div className="flex-1 overflow-y-auto overscroll-contain p-3 divide-y divide-slate-100 dark:divide-neutral-800">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export const MobileNavToggle = ({
  isOpen,
  onClick,
}: {
  isOpen: boolean;
  onClick: () => void;
}) => {
  return (
    <button
      onClick={onClick}
      aria-label="Toggle Menu"
      className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700 transition-all hover:bg-slate-200/80 active:scale-95 dark:bg-neutral-800 dark:text-white dark:hover:bg-neutral-700 lg:hidden"
    >
      {isOpen ? <IconX size={18} /> : <IconMenu2 size={18} />}
    </button>
  );
};

export const NavbarLogo = () => {
  return (
    <a
      href="#"
      className="relative z-20 flex items-center space-x-2.5 py-1 text-sm font-medium text-slate-900 group"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 transition-transform group-hover:scale-105 dark:bg-neutral-800 overflow-hidden shadow-xs">
        <Image
          src="/images/logo-remove-bg.png"
          alt="Airship"
          width={36}
          height={36}
          priority
          className="h-7 w-auto object-contain"
        />
      </div>
      <span className="font-semibold tracking-tight text-slate-900 dark:text-white text-base">
        Startup
      </span>
    </a>
  );
};

type NavbarButtonProps<T extends React.ElementType> = {
  as?: T;
  href?: string;
  children: React.ReactNode;
  className?: string;
  variant?: "primary" | "secondary" | "dark" | "gradient";
} & Omit<React.ComponentPropsWithoutRef<T>, "as" | "className">;

export function NavbarButton<T extends React.ElementType = "button">({
  as,
  href,
  children,
  className,
  variant = "primary",
  ...props
}: NavbarButtonProps<T>) {
  const Tag = as || "button";

  const baseStyles =
    "px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 inline-flex items-center justify-center active:scale-95 text-center shadow-xs cursor-pointer";

  const variantStyles = {
    primary:
      "bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100",
    secondary:
      "bg-slate-100 text-slate-700 hover:bg-slate-200/80 shadow-none dark:bg-neutral-800 dark:text-slate-300 dark:hover:bg-neutral-700",
    dark: "bg-slate-900 text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-slate-200",
    gradient:
      "bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-500 hover:to-indigo-500 shadow-blue-500/20 shadow-md",
  };

  return (
    <Tag
      {...props}
      {...(href ? { href } : {})}
      className={cn(baseStyles, variantStyles[variant], className)}
    >
      {children}
    </Tag>
  );
}