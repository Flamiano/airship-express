"use client";

import { useRef, type KeyboardEvent } from "react";
import { useTheme } from "@/app/components/ThemeProvider";
import ThemeToggle from "@/app/components/ThemeToggle";
import { Sun, Moon, Check } from "lucide-react";

const themes = [
  { key: "light", label: "Light", icon: Sun, desc: "Bright and crisp — ideal for daytime." },
  { key: "dark", label: "Dark", icon: Moon, desc: "Easy on the eyes in low light." },
] as const;

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const activeIndex = themes.findIndex((t) => t.key === theme);

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      next = (index + 1) % themes.length;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      next = (index - 1 + themes.length) % themes.length;
    } else {
      return;
    }
    e.preventDefault();
    setTheme(themes[next].key);
    optionRefs.current[next]?.focus();
  };

  return (
    <div className="w-full py-4 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">
          Preferences
        </h1>
        <p className="text-muted text-sm mt-1">
          Customize how the workspace looks and feels.
        </p>
      </div>

      <section className="bg-paper border border-line rounded-2xl overflow-hidden">
        <div className="px-5 py-5 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-foreground text-sm font-semibold">Appearance</h2>
              <p className="text-muted text-xs mt-1 max-w-sm leading-relaxed">
                Choose how the interface looks. Your selection is applied
                instantly and saved on this device.
              </p>
            </div>
            <ThemeToggle className="cursor-pointer"/>
          </div>

          <div
            role="radiogroup"
            aria-label="Theme"
            className="relative grid grid-cols-2 gap-1 mt-5 rounded-xl bg-background p-1 border border-line"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-1 bottom-1 rounded-lg bg-paper border border-line shadow-sm transition-[left,right] duration-300 ease-out"
              style={{
                left: theme === "dark" ? "50%" : "0.25rem",
                right: theme === "dark" ? "0.25rem" : "50%",
              }}
            />

            {themes.map((t, i) => {
              const active = theme === t.key;
              const Icon = t.icon;
              return (
                <button
                  key={t.key}
                  ref={(el) => {
                    optionRefs.current[i] = el;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  tabIndex={i === activeIndex ? 0 : -1}
                  onClick={() => setTheme(t.key)}
                  onKeyDown={(e) => onKeyDown(e, i)}
                  className={`relative cursor-pointer z-10 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
                    active
                      ? "text-foreground"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  <Icon
                    size={16}
                    className={active ? "text-accent" : "text-muted"}
                  />
                  {t.label}
                  {active && <Check size={14} className="text-accent" />}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted">
            You&rsquo;re using the{" "}
            <span className="text-foreground font-medium capitalize">
              {theme}
            </span>{" "}
            theme. {themes[activeIndex]?.desc}
          </p>

        </div>
      </section>
    </div>
  );
}
