"use client"

import { useState } from "react"
import CrbcSidebar from "./CrbcSidebar"
import { ThemeProvider } from "@/app/components/ThemeProvider"

export default function CrbcLayout({ children }: { children: React.ReactNode }) {
    const [collapsed, setCollapsed] = useState(false)

    return (
        <ThemeProvider>
            <div className="flex min-h-screen border-line bg-background">
                <CrbcSidebar collapsed={collapsed} setCollapsed={setCollapsed} />
                <main className={`${collapsed ? "ml-16" : "ml-56"} flex-1 transition-all duration-200 md:p-8 overflow-x-auto`}>
                    {children}
                </main>
            </div>
        </ThemeProvider>
    )
}
