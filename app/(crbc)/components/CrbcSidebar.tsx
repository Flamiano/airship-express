"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import Image from "next/image"
import { useState } from "react"
import { customerServiceLogout } from "../actions/auth"
import {
    Users, FileText, FolderOpen, BarChart2, LogOut,
    ChevronDown, Menu, Settings,
} from "lucide-react"

const topModules = [
    { href: "/crbc/dashboard", label: "Dashboard", icon: BarChart2 },
    { href: "/crbc/customers", label: "CRM", icon: Users },
]

const contractModules = [
    { href: "/crbc/delivery-policies", label: "Delivery Policies" },
    { href: "/crbc/sla-monitoring", label: "SLA Monitoring" },
]

const docModules = [
    { href: "/crbc/documents", label: "E-Documentation" },
    { href: "/crbc/compliance", label: "Compliance Manager" },
]

const insightModules = [
    { href: "/crbc/analytics", label: "BI & Analytics", icon: BarChart2 },
]

const systemModules = [
    { href: "/crbc/settings", label: "Settings", icon: Settings },
]

const navItem = (isActive: boolean, collapsed: boolean) =>
    `flex items-center gap-2.5 rounded-md text-[13px] transition-colors ${collapsed ? "justify-center px-0 py-2.5" : "px-3 py-2"} ${isActive ? "bg-accent/10 text-accent font-medium" : "text-muted hover:text-foreground hover:bg-accent/5"}`

const groupBtn = (isActive: boolean, collapsed: boolean) =>
    `w-full flex items-center justify-between rounded-md text-[13px] transition-colors ${collapsed ? "justify-center px-0 py-2.5" : "px-3 py-2"} ${isActive ? "bg-accent/10 text-accent font-medium" : "text-muted hover:text-foreground hover:bg-accent/5"}`

function SectionLabel({ children, collapsed }: { children: React.ReactNode; collapsed: boolean }) {
    if (collapsed) return <div className="h-2" />
    return (
        <div className="px-3 pt-4 pb-1 text-[10px] font-semibold text-accent tracking-widest uppercase">
            {children}
        </div>
    )
}

export default function CrbcSidebar({ collapsed, setCollapsed }: { collapsed: boolean, setCollapsed: (v: boolean) => void }) {
    const pathname = usePathname()
    const isDocActive = pathname.startsWith("/crbc/documents") || pathname.startsWith("/crbc/compliance")
    const isContractActive = pathname.startsWith("/crbc/contracts") || pathname.startsWith("/crbc/delivery-policies") || pathname.startsWith("/crbc/sla-monitoring")
    const [docOpen, setDocOpen] = useState(isDocActive)
    const [contractOpen, setContractOpen] = useState(isContractActive)

    return (
        <>
            <button
                onClick={() => setCollapsed(!collapsed)}
                className="fixed top-4 z-50 flex items-center justify-center w-8 h-8 rounded-md text-muted hover:text-foreground hover:bg-accent/5 transition-all duration-200 cursor-pointer"
                style={{ left: collapsed ? "1rem" : "calc(14rem - 2.5rem)" }}
            >
                <Menu size={16} />
            </button>

            <aside className={`${collapsed ? "w-16" : "w-56"} bg-paper border-r border-line flex flex-col fixed top-0 left-0 h-screen transition-all duration-200 z-40`}>

                {/* Logo */}
                <div className="h-14 flex items-center gap-2.5 px-4 border-b border-line shrink-0">
                    {!collapsed && (
                        <Image src="/images/logo.jpg" alt="Logo" width={20} height={20} className="shrink-0" />
                    )}
                    {!collapsed && (
                        <div>
                            <div className="text-[13px] font-semibold text-foreground tracking-tight">Airship</div>
                            <div className="text-[10px] text-muted uppercase tracking-wide">CRBC</div>
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

                    <SectionLabel collapsed={collapsed}>Overview</SectionLabel>
                    {topModules.map(({ href, label, icon: Icon }) => {
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

                    {/* Contract & SLA */}
                    <SectionLabel collapsed={collapsed}>Agreements</SectionLabel>
                    <div>
                        <button
                            onClick={() => collapsed ? (setCollapsed(false), setContractOpen(true)) : setContractOpen(!contractOpen)}
                            title={collapsed ? "Contract & SLA" : undefined}
                            className={groupBtn(isContractActive, collapsed)}
                        >
                            <div className="flex items-center gap-2.5">
                                <FileText size={15} className="shrink-0" />
                                {!collapsed && <span>Contract & SLA</span>}
                            </div>
                            {!collapsed && <ChevronDown size={12} className={`transition-transform text-muted ${contractOpen ? "rotate-180" : ""}`} />}
                        </button>
                        {contractOpen && !collapsed && (
                            <div className="ml-4 mt-0.5 space-y-0.5 border-l border-line pl-3">
                                {contractModules.map(({ href, label }) => {
                                    const isActive = pathname.startsWith(href)
                                    return (
                                        <Link key={href} href={href}
                                            className={`flex items-center gap-2 py-1.5 px-2 text-xs rounded-md transition-colors ${isActive ? "text-accent font-medium" : "text-muted hover:text-foreground"}`}
                                        >
                                            <span className="w-1 h-1 rounded-full bg-current shrink-0" />
                                            {label}
                                        </Link>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    {/* E-Doc & Compliance */}
                    <SectionLabel collapsed={collapsed}>Compliance</SectionLabel>
                    <div>
                        <button
                            onClick={() => collapsed ? (setCollapsed(false), setDocOpen(true)) : setDocOpen(!docOpen)}
                            title={collapsed ? "E-Doc & Compliance" : undefined}
                            className={groupBtn(isDocActive, collapsed)}
                        >
                            <div className="flex items-center gap-2.5">
                                <FolderOpen size={15} className="shrink-0" />
                                {!collapsed && <span>E-Doc & Compliance</span>}
                            </div>
                            {!collapsed && <ChevronDown size={12} className={`transition-transform text-muted ${docOpen ? "rotate-180" : ""}`} />}
                        </button>
                        {docOpen && !collapsed && (
                            <div className="ml-4 mt-0.5 space-y-0.5 border-l border-line pl-3">
                                {docModules.map(({ href, label }) => {
                                    const isActive = pathname.startsWith(href)
                                    return (
                                        <Link key={href} href={href}
                                            className={`flex items-center gap-2 py-1.5 px-2 text-xs rounded-md transition-colors ${isActive ? "text-accent font-medium" : "text-muted hover:text-foreground"}`}
                                        >
                                            <span className="w-1 h-1 rounded-full bg-current shrink-0" />
                                            {label}
                                        </Link>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    <SectionLabel collapsed={collapsed}>Insights</SectionLabel>
                    {insightModules.map(({ href, label, icon: Icon }) => {
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

                    <SectionLabel collapsed={collapsed}>System</SectionLabel>
                    {systemModules.map(({ href, label, icon: Icon }) => {
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

                <div className="p-2 border-t border-line">
                    <button
                        onClick={() => customerServiceLogout()}
                        title={collapsed ? "Logout" : undefined}
                        className={`flex items-center gap-2.5 rounded-md text-xs font-medium bg-red-100/70 dark:bg-red-950/40 text-red-700 dark:text-red-400 hover:bg-red-200/70 dark:hover:bg-red-900/50 transition-colors w-full cursor-pointer ${collapsed ? "justify-center px-0 py-2.5" : "px-3 py-2"}`}
                    >
                        <LogOut size={15} className="shrink-0" />
                        {!collapsed && "Logout"}
                    </button>
                </div>
            </aside>
        </>
    )
}