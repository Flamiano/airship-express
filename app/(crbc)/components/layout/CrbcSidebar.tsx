"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import Image from "next/image"
import { useState } from "react"
import { logout } from "../../actions/auth"
import {
    Users, FileText, FolderOpen, BarChart2, LogOut,
    ChevronDown, Menu, Settings, ShieldCheck, TrendingUp,
} from "lucide-react"
import AirshipExpressLogo from "../../../../public/images/airship.png"
import { hasPermission, type StaffPermission } from "../../library/auth/rbac"

const topModules = [
    { href: "/crbc/dashboard", label: "Dashboard", icon: BarChart2, permission: "dashboard.view" as StaffPermission },
]

const crmSubModules = [
    // { href: "/crbc/customers", label: "Customer Management", permission: "crm.view" as StaffPermission },
    // { href: "/crbc/customers/interactions", label: "Interaction History", permission: "crm.view" as StaffPermission },
    { href: "/crbc/customers/customercommunication", label: "Customer Communication", permission: "crm.view" as StaffPermission },
    { href: "/crbc/customers/feedbackmanagement", label: "Feedback Management", permission: "crm.view" as StaffPermission },
    { href: "/crbc/complaints&concern", label: "Complaints & Concerns", permission: "crm.view" as StaffPermission }
]

const contractModules = [
    { href: "/crbc/delivery-policies", label: "Delivery Policies", permission: "sla.view" as StaffPermission },
    { href: "/crbc/sla-monitoring", label: "SLA Monitoring", permission: "sla.view" as StaffPermission },
]

const docModules = [
    { href: "/crbc/documents", label: "E-Documentation", permission: "documents.view" as StaffPermission },
    { href: "/crbc/compliance", label: "Compliance Manager", permission: "compliance.view" as StaffPermission },
]

const insightModules = [
    { href: "/crbc/analytics", label: "BI & Freight Analytics", permission: "analytics.view" as StaffPermission },
    { href: "/crbc/analytics/customer", label: "Customer Analytics", permission: "analytics.view" as StaffPermission },
]

const adminSubModules = [
    { href: "/crbc/user-management", label: "User Management", permission: "users.manage" as StaffPermission },
    { href: "/crbc/audit-trail", label: "Audit Trail", permission: "audit.view" as StaffPermission },
]

const systemModules = [
    { href: "/crbc/settings", label: "Settings", icon: Settings, permission: "dashboard.view" as StaffPermission },
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

export default function CrbcSidebar({ collapsed, setCollapsed, role }: { collapsed: boolean, setCollapsed: (v: boolean) => void; role: string }) {
    const showAdmin = hasPermission(role, "users.manage")
    const showAudit = hasPermission(role, "audit.view")
    const pathname = usePathname()
    const isDocActive = pathname.startsWith("/crbc/documents") || pathname.startsWith("/crbc/compliance")
    const isContractActive = pathname.startsWith("/crbc/contracts") || pathname.startsWith("/crbc/delivery-policies") || pathname.startsWith("/crbc/sla-monitoring")
    const isCrmActive = pathname.startsWith("/crbc/customers")
    const isAdminActive = pathname.startsWith("/crbc/user-management") || pathname.startsWith("/crbc/audit-trail")
    const isInsightActive = pathname.startsWith("/crbc/analytics")
    const [docOpen, setDocOpen] = useState(isDocActive)
    const [contractOpen, setContractOpen] = useState(isContractActive)
    const [crmOpen, setCrmOpen] = useState(isCrmActive)
    const [adminOpen, setAdminOpen] = useState(isAdminActive)
    const [insightOpen, setInsightOpen] = useState(isInsightActive)

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
                <div className="h-14 flex bg-background items-center gap-2.5 px-4 border-b border-line shrink-0">
                    {!collapsed && (
                        <Image src={AirshipExpressLogo} alt="Logo" width={36} height={36} className="shrink-0 h-auto" />
                    )}
                    {!collapsed && (
                        <div>
                            <div className="text-[13px] font-semibold text-foreground tracking-tight">Airship Express</div>
                            <div className="text-[10px] text-muted uppercase tracking-wide">CRBC</div>
                        </div>
                    )}
                </div>

                {!collapsed && (
                    <div className="px-4 pt-4 pb-1 bg-background text-[10px] font-semibold text-muted tracking-widest uppercase">
                        Menu
                    </div>
                )}

                {/* Nav */}
                <nav className="flex-1 bg-background px-2 overflow-y-auto space-y-0.5 pt-1">

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

                    {/* CRM */}
                    <SectionLabel collapsed={collapsed}>CRM</SectionLabel>
                    <div>
                        <button
                            onClick={() => collapsed ? (setCollapsed(false), setCrmOpen(true)) : setCrmOpen(!crmOpen)}
                            title={collapsed ? "CRM" : undefined}
                            className={groupBtn(isCrmActive, collapsed)}
                        >
                            <div className="flex items-center gap-2.5">
                                <Users size={15} className="shrink-0" />
                                {!collapsed && <span>CRM</span>}
                            </div>
                            {!collapsed && <ChevronDown size={12} className={`transition-transform text-muted ${crmOpen ? "rotate-180" : ""}`} />}
                        </button>
                        {crmOpen && !collapsed && (
                            <div className="ml-4 mt-0.5 space-y-0.5 border-l border-line pl-3">
                                {crmSubModules.map(({ href, label }) => {
                                    const isActive = pathname === href || (pathname.startsWith(href + "/") && 
                                                    !crmSubModules.some(s => s.href !== href && pathname.startsWith(s.href)))
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

                    <SectionLabel collapsed={collapsed}>Analytics</SectionLabel>
                    <div>
                        <button
                            onClick={() => collapsed ? (setCollapsed(false), setInsightOpen(true)) : setInsightOpen(!insightOpen)}
                            title={collapsed ? "Analytics" : undefined}
                            className={groupBtn(isInsightActive, collapsed)}
                        >
                            <div className="flex items-center gap-2.5">
                                <TrendingUp size={15} className="shrink-0" />
                                {!collapsed && <span>Analytics</span>}
                            </div>
                            {!collapsed && <ChevronDown size={12} className={`transition-transform text-muted ${insightOpen ? "rotate-180" : ""}`} />}
                        </button>
                        {insightOpen && !collapsed && (
                            <div className="ml-4 mt-0.5 space-y-0.5 border-l border-line pl-3">
                                {insightModules
                                    .filter(({ permission }) => hasPermission(role, permission))
                                    .map(({ href, label }) => {
                                        const isActive = pathname === href
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

                    {/* System Administration */}
                    {(showAdmin || showAudit) && (
                        <>
                            <SectionLabel collapsed={collapsed}>System Administration</SectionLabel>
                            <div>
                                <button
                                    onClick={() => collapsed ? (setCollapsed(false), setAdminOpen(true)) : setAdminOpen(!adminOpen)}
                                    title={collapsed ? "System Administration" : undefined}
                                    className={groupBtn(isAdminActive, collapsed)}
                                >
                                    <div className="flex items-center gap-2.5">
                                        <ShieldCheck size={15} className="shrink-0" />
                                        {!collapsed && <span>System Administration</span>}
                                    </div>
                                    {!collapsed && <ChevronDown size={12} className={`transition-transform text-muted ${adminOpen ? "rotate-180" : ""}`} />}
                                </button>
                                {adminOpen && !collapsed && (
                                    <div className="ml-4 mt-0.5 space-y-0.5 border-l border-line pl-3">
                                        {adminSubModules
                                            .filter(({ permission }) => hasPermission(role, permission))
                                            .map(({ href, label }) => {
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
                        </>
                    )}

                    <SectionLabel collapsed={collapsed}>Account</SectionLabel>
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

                <div className="p-2 border-t border-line bg-background">
                    <button
                        onClick={() => logout()}
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