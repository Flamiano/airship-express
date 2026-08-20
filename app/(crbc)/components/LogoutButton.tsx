"use client";

import { logout } from "../actions/auth";
import { LogOut } from "lucide-react";

export default function LogoutButton() {
  return (
    <form action={logout}>
      <button
        type="submit"
        className="flex items-center gap-2.5 px-3 py-2 rounded-md text-xs text-zinc-400 hover:text-zinc-700 hover:bg-zinc-50 transition-colors w-full"
      >
        <LogOut size={14} />
        Logout
      </button>
    </form>
  );
}