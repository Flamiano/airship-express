"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import Image from "next/image"
import { LayoutDashboard, Package, FileText, Bell, User, LogOut, Menu } from "lucide-react"
import { logout } from "../actions/auth"

const nav = [
    { href: "/customer/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/customer/shipments", label: "My Shipments", icon: Package },
    { href: "/customer/documents", label: "My Documents", icon: FileText },
    { href: "/customer/notifications", label: "Notifications", icon: Bell },
    { href: "/customer/profile", label: "Profile", icon: User },
]

const navItem = (isActive: boolean, collapsed: boolean) =>
    `flex items-center gap-2.5 rounded-md text-[13px] transition-colors ${collapsed ? "justify-center px-0 py-2.5" : "px-3 py-2"} ${isActive ? "bg-zinc-100 text-zinc-900 font-medium" : "text-zinc-700 hover:text-zinc-900 hover:bg-zinc-50"}`

export default function CustomerSidebar({ collapsed, setCollapsed }: { collapsed: boolean, setCollapsed: (v: boolean) => void }) {
    const pathname = usePathname()

    return (
        <>
            <button
                onClick={() => setCollapsed(!collapsed)}
                className="fixed top-4 z-50 flex items-center justify-center w-8 h-8 rounded-md text-zinc-600 hover:text-zinc-900 transition-all duration-200 cursor-pointer"
                style={{ left: collapsed ? "1rem" : "calc(14rem - 2.5rem)" }}
            >
                <Menu size={16} />
            </button>

            <aside className={`${collapsed ? "w-16" : "w-56"} bg-white border-r border-zinc-100 flex flex-col fixed top-0 left-0 h-screen transition-all duration-200 z-40`}>

                {/* Logo */}
                <div className="h-14 flex items-center gap-2.5 px-4 border-b border-zinc-100 shrink-0">
                    {!collapsed && <Image src="/airship.png" alt="Logo" width={20} height={20} className="shrink-0" />}
                    {!collapsed && (
                        <div>
                            <div className="text-[13px] font-semibold text-zinc-800 tracking-tight">Airship</div>
                            <div className="text-[10px] text-zinc-400 uppercase tracking-wide">Customer</div>
                        </div>
                    )}
                </div>

                {!collapsed && (
                    <div className="px-4 pt-4 pb-1 text-[10px] font-semibold text-zinc-400 tracking-widest uppercase">
                        Menu
                    </div>
                )}

                {/* Nav */}
                <nav className="flex-1 px-2 overflow-y-auto space-y-0.5 pt-1">
                    {nav.map(({ href, label, icon: Icon }) => {
                        const isActive = pathname.startsWith(href)
                        return (
                            <Link key={href} href={href} title={collapsed ? label : undefined}
                                className={navItem(isActive, collapsed)}
                            >
                                <Icon size={15} className="shrink-0" />
                                {!collapsed && <span>{label}</span>}
                            </Link>
                        )
                    })}
                </nav>

                {/* Bottom */}
                <div className="p-2 border-t border-zinc-100">
                    <button
                        onClick={() => logout()}
                        title={collapsed ? "Logout" : undefined}
                        className={`flex items-center gap-2.5 rounded-md text-xs text-zinc-600 hover:text-zinc-900 hover:bg-red-200 bg-red-100 transition-colors w-full cursor-pointer ${collapsed ? "justify-center px-0 py-2.5" : "px-3 py-2"}`}
                    >
                        <LogOut size={15} className="shrink-0" />
                        {!collapsed && "Logout"}
                    </button>
                </div>
            </aside>
        </>
    )
}
