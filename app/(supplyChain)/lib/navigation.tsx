export const NAV = [
    {
        section: "Operations",
        items: [
            {
                id: "executive",
                label: "Executive Overview",
                href: "/executive",
                icon: "fa-solid fa-grip",
                roles: ["Superadmin", "Executive"],
            },
            {
                id: "warehouse",
                label: "Warehousing",
                href: "/warehousing",
                icon: "fa-solid fa-box",
                roles: ["Superadmin", "Operator"],
            },
            {
                id: "inventory",
                label: "Stock Inventory",
                href: "/inventory",
                icon: "fa-solid fa-layer-group",
                roles: ["Superadmin", "Admin"],
            },
        ],
    },
    {
        section: "Procurement",
        items: [
            {
                id: "procurement",
                label: "Procurement",
                href: "/procurement",
                icon: "fa-solid fa-clipboard",
                roles: ["Superadmin", "Purchase Officer"],
            },
            {
                id: "suppliers",
                label: "Suppliers",
                href: "/suppliers",
                icon: "fa-solid fa-users",
                roles: ["Superadmin", "Purchase Officer"],
            },
            {
                id: "purchase-orders",
                label: "Purchase Orders",
                href: "/purchase-orders",
                icon: "fa-solid fa-file",
                roles: ["Superadmin", "Admin", "Purchase Officer"],
            },
        ],
    },
    {
        section: "Intelligence",
        items: [
            {
                id: "documents",
                label: "Documents",
                href: "/documents",
                icon: "fa-solid fa-folder",
                roles: ["Superadmin", "Purchase Officer"],
            },
            {
                id: "forecast",
                label: "Forecast",
                href: "/forecast",
                icon: "fa-solid fa-chart-line",
                roles: ["Superadmin", "Executive", "Admin"],
            },
        ],
    },
    {
        section: "Others",
        items: [
            {
                id: "Trash",
                label: "Trash",
                href: "/trash",
                icon: "fa-solid fa-trash",
                roles: ["Superadmin", "Admin", "Purchase Officer"],
            },
            {
                id: "User-Activities",
                label: "User-Activities",
                href: "/user-activity",
                icon: "fa-solid fa-user-clock",
                roles: ["Superadmin", "Executive"],
            },
            {
                id: "Settings",
                label: "Settings",
                href: "/settings",
                icon: "fa-solid fa-gear",
                roles: ["Superadmin", "Executive"],
            }
        ]
    }
];