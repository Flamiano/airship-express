"use client";

import ThemeToggle from "@/app/components/ThemeToggle";
import { Shield, Bell, User, Key } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="w-full py-4 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">
          Settings
        </h1>
        <p className="text-muted text-sm mt-1">
          Manage your account preferences and security.
        </p>
      </div>

      <section className="bg-background border border-line rounded-2xl overflow-hidden">
        <div className="px-5 py-5 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-foreground text-sm font-semibold">Appearance</h2>
              <p className="text-muted text-xs mt-1 max-w-sm leading-relaxed">
                Toggle between light and dark mode.
              </p>
            </div>
            <ThemeToggle className="cursor-pointer" />
          </div>
        </div>
      </section>

      <section className="bg-background border border-line rounded-2xl overflow-hidden">
        <div className="px-5 py-5 sm:px-6">
          <h2 className="text-foreground text-sm font-semibold mb-4">Account</h2>
          <div className="space-y-3">
            <button className="w-full flex items-center gap-3 rounded-lg p-3 text-left hover:bg-accent/5 transition-colors">
              <Shield size={18} className="text-accent shrink-0" />
              <div>
                <p className="text-foreground text-sm font-medium">Security</p>
                <p className="text-muted text-xs">Password, 2FA, and sessions</p>
              </div>
            </button>
            <button className="w-full flex items-center gap-3 rounded-lg p-3 text-left hover:bg-accent/5 transition-colors">
              <Bell size={18} className="text-accent shrink-0" />
              <div>
                <p className="text-foreground text-sm font-medium">Notifications</p>
                <p className="text-muted text-xs">Email and push preferences</p>
              </div>
            </button>
            <button className="w-full flex items-center gap-3 rounded-lg p-3 text-left hover:bg-accent/5 transition-colors">
              <User size={18} className="text-accent shrink-0" />
              <div>
                <p className="text-foreground text-sm font-medium">Profile</p>
                <p className="text-muted text-xs">Name, avatar, and contact info</p>
              </div>
            </button>
            <button className="w-full flex items-center gap-3 rounded-lg p-3 text-left hover:bg-accent/5 transition-colors">
              <Key size={18} className="text-accent shrink-0" />
              <div>
                <p className="text-foreground text-sm font-medium">API Keys</p>
                <p className="text-muted text-xs">Manage integration tokens</p>
              </div>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}