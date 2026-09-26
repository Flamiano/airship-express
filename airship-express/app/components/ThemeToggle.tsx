"use client";

import { motion } from "framer-motion";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "./ThemeProvider";

export default function ThemeToggle({ className = "" }: { className?: string }) {
    const { theme, toggleTheme } = useTheme();
    const dark = theme === "dark";

    return (
        <button
            onClick={toggleTheme}
            aria-label="Toggle dark mode"
            className={`z-30 flex h-9 w-16 items-center rounded-full border p-1 transition-colors border-line bg-white dark:border-paper/15 dark:bg-paper/10 ${className}`}
        >
            <motion.span
                animate={{ x: dark ? 26 : 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-paper dark:bg-accent"
            >
                {dark ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
            </motion.span>
        </button>
    );
}