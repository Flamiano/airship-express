"use client"

import { useState } from "react"
import CustomerSidebar from "./CustomerSidebar"

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
    const [collapsed, setCollapsed] = useState(false)

    return (
        <div className="flex min-h-screen">
            <CustomerSidebar collapsed={collapsed} setCollapsed={setCollapsed} />
            <main className={`${collapsed ? "ml-16" : "ml-56"} flex-1 transition-all duration-200 p-6 md:p-8 bg-zinc-50 overflow-x-auto`}>
                {children}
            </main>
        </div>
    )
}
