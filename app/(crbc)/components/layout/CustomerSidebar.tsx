"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
    LayoutDashboard,
    Package,
    PlusCircle,
    FileText,
    Bell,
    User,
    Settings,
    LogOut,
    Menu,
    Sun,
    Moon,
} from "lucide-react"
import { logout } from "../../actions/auth"
import { useTheme } from "@/app/components/ThemeProvider"
import type { Customers as Customer } from "../../types/customer"

const nav = [
    { href: "/customer/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/customer/shipments", label: "My Shipments", icon: Package },
    { href: "/customer/shipments/new", label: "Request Shipment", icon: PlusCircle },
    { href: "/customer/documents", label: "Documents", icon: FileText },
    { href: "/customer/notifications", label: "Notifications", icon: Bell },
    { href: "/customer/profile", label: "My Profile", icon: User },
    { href: "/customer/settings", label: "Settings", icon: Settings },
]

const navItem = (isActive: boolean, collapsed: boolean) =>
    `flex items-center gap-2.5 rounded-md text-[13px] transition-colors ${collapsed ? "justify-center px-0 py-2.5" : "px-3 py-2"} ${isActive ? "bg-accent/10 text-accent font-medium" : "text-muted hover:text-foreground hover:bg-line/50"}`
type CustomerSidebarProps = {
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
  customer: Customer;
};
export default function CustomerSidebar({
    collapsed,
    setCollapsed,
    customer
}: CustomerSidebarProps) {
    const pathname = usePathname()
    const { theme, toggleTheme } = useTheme()

    return (
        <>
            <button
                onClick={() => setCollapsed(!collapsed)}
                className="fixed top-4 z-50 flex items-center justify-center w-8 h-8 rounded-md text-muted hover:text-foreground transition-all duration-200 cursor-pointer"
                style={{ left: collapsed ? "1rem" : "calc(14rem - 2.5rem)" }}
            >
                <Menu size={16} />
            </button>
     
            <aside
                className={`${collapsed ? "w-16" : "w-56"} bg-paper border-r border-line flex flex-col fixed top-0 left-0 h-screen transition-all duration-200 z-40`}
            >

               <div className="h-14 flex items-center justify-start border-b border-line shrink-0 px-4">
                    {!collapsed && (
                        <div className="text-left">
                        <p className="text-sm font-medium text-foreground">
                            {customer.full_name || "Customer"}
                        </p>

                        <p className="text-[10px] text-muted uppercase tracking-wide">
                            {customer.role}
                        </p>
                        </div>
                    )}
                    </div>



               
                {!collapsed && (
                    <div className="px-4 pt-4 pb-1 text-[10px] font-semibold text-muted tracking-widest uppercase">
                        Menu
                    </div>
                )}

                {/* Nav */}
                <nav className="flex-1 px-2 overflow-y-auto space-y-0.5 pt-1">
                    {nav.map(({ href, label, icon: Icon }) => {
                        const isActive = pathname === href
                        return (
                            <Link
                                key={href}
                                href={href}
                                title={collapsed ? label : undefined}
                                className={navItem(isActive, collapsed)}
                            >
                                <Icon size={15} className="shrink-0" />
                                {!collapsed && <span>{label}</span>}
                            </Link>
                        )
                    })}
                </nav>

                {/* Theme toggle */}
                {!collapsed && (
                    <div className="px-4 py-2 border-b border-line">
                        <button
                            onClick={toggleTheme}
                            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                            className="flex items-center gap-3 w-full rounded-md text-[13px] text-muted hover:text-foreground hover:bg-line/50 transition-colors px-3 py-2"
                        >
                            {theme === "dark" ? (
                                <Sun size={16} className="shrink-0" />
                            ) : (
                                <Moon size={16} className="shrink-0" />
                            )}
                            <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
                        </button>
                    </div>
                )}

                {/* Bottom */}
                <div className="p-2 border-t border-line">
                    <button
                        onClick={() => logout()}
                        title={collapsed ? "Logout" : undefined}
                        className={`flex items-center gap-2.5 rounded-md text-[13px] text-muted hover:text-foreground hover:bg-line/50 transition-colors w-full cursor-pointer ${collapsed ? "justify-center px-0 py-2.5" : "px-3 py-2"}`}
                    >
                        <LogOut size={15} className="shrink-0" />
                        {!collapsed && "Logout"}
                    </button>
                </div>
            </aside>
        </>
    )
}