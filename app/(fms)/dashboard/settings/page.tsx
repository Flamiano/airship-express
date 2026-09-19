"use client";

import React, { useEffect, useState } from "react";
import { useTheme } from "@/app/components/ThemeProvider";
import { Moon, Sun, User, Lock, Bell, Shield } from "lucide-react";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="p-6 md:p-10 bg-background min-h-screen text-foreground transition-colors duration-200">
      
      {/* Centered wrapper guarantees perfect alignment during sidebar collapse */}
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="border-b border-border pb-5">
          <span className="text-xs text-[#e5167e] dark:text-[#ff4d9b] font-extrabold tracking-widest uppercase">
            Preferences
          </span>
          <h1 className="text-3xl font-extrabold text-foreground mt-0.5 tracking-tight">
            System Settings
          </h1>
          <p className="text-sm text-foreground/60 mt-0.5">
            Manage system theme appearance, user profiles, and financial ledger rules.
          </p>
        </div>

        <div className="space-y-6">
          {/* Global Theme Toggle Card */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm transition-all space-y-4">
            <div>
              <h3 className="text-base font-bold text-foreground">
                App Theme Appearance
              </h3>
              <p className="text-xs text-foreground/60">
                Select your visual mode. This changes all submodules, navigation, and page layouts immediately.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 max-w-md">
              <button
                onClick={() => setTheme("light")}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all ${
                  theme === "light"
                    ? "bg-[#e5167e] text-white border-[#e5167e] shadow-md"
                    : "bg-background text-foreground border-border hover:border-[#e5167e]/50"
                }`}
              >
                <Sun size={16} /> Light Mode
              </button>

              <button
                onClick={() => setTheme("dark")}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all ${
                  theme === "dark"
                    ? "bg-[#e5167e] text-white border-[#e5167e] shadow-md"
                    : "bg-background text-foreground border-border hover:border-[#e5167e]/50"
                }`}
              >
                <Moon size={16} /> Dark Mode
              </button>
            </div>
          </div>

          {/* Other Settings Cards */}
          {[
            { icon: User, title: "Profile & User Info", desc: "Manage your account details and display name." },
            { icon: Lock, title: "Security & Passwords", desc: "Update 2FA authentication settings and API tokens." },
            { icon: Bell, title: "Notification Preferences", desc: "Configure email alerts for overdue accounts and postings." },
            { icon: Shield, title: "Financial Ledger Rules", desc: "Set approval thresholds and period-closing locks." },
          ].map((setting, i) => {
            const Icon = setting.icon;
            return (
              <div
                key={i}
                className="bg-card border border-border rounded-2xl p-6 shadow-sm flex items-center justify-between hover:border-[#e5167e]/40 transition"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-background border border-border rounded-xl text-[#e5167e] dark:text-[#ff4d9b]">
                    <Icon size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground">
                      {setting.title}
                    </h3>
                    <p className="text-xs text-foreground/60">
                      {setting.desc}
                    </p>
                  </div>
                </div>
                <button className="px-4 py-2 text-xs font-bold text-foreground bg-background border border-border rounded-xl hover:bg-border/40 transition">
                  Configure
                </button>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}