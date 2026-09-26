"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark";

interface ThemeContextValue {
    theme: Theme;
    toggleTheme: () => void;
    setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setThemeState] = useState<Theme>("light");

    useEffect(() => {
        const storedTheme = window.localStorage.getItem("airship-theme") as Theme | null;
        const nextTheme = storedTheme === "dark" || storedTheme === "light"
            ? storedTheme
            : window.matchMedia("(prefers-color-scheme: dark)").matches
                ? "dark"
                : "light";

        document.documentElement.classList.toggle("dark", nextTheme === "dark");
        setThemeState(nextTheme);
    }, []);

    const setTheme = (next: Theme) => {
        setThemeState(next);
        document.documentElement.classList.toggle("dark", next === "dark");
        window.localStorage.setItem("airship-theme", next);
    };

    const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
    return ctx;
}
