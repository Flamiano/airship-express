export const NAV = [
    {
        section: "Operations",
        items: [
            {
                id: "executive",
                label: "Executive Overview",
                href: "/executive",
                icon: "fa-solid fa-grip",
                roles: ["Executive"],
            },
            {
                id: "warehouse",
                label: "Warehousing",
                href: "/warehousing",
                icon: "fa-solid fa-box",
                roles: ["Executive", "Admin", "Operator"],
            },
            {
                id: "inventory",
                label: "Stock Inventory",
                href: "/inventory",
                icon: "fa-solid fa-layer-group",
                roles: ["Executive", "Admin", "Operator"],
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
                roles: ["Executive", "Admin", "Purchase Officer"],
            },
            {
                id: "suppliers",
                label: "Suppliers",
                href: "/suppliers",
                icon: "fa-solid fa-users",
                roles: ["Executive", "Admin", "Purchase Officer"],
            },
            {
                id: "purchase-orders",
                label: "Purchase Orders",
                href: "/purchase-orders",
                icon: "fa-solid fa-file",
                roles: ["Executive", "Admin", "Purchase Officer", "Superadmin", "Operator", "Supervisor", "Staff", "Employee"],
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
                roles: ["Executive", "Admin", "Purchase Officer", "Operator"],
            },
            {
                id: "forecast",
                label: "Forecast",
                href: "/forecast",
                icon: "fa-solid fa-chart-line",
                roles: ["Executive", "Admin"],
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
                roles: ["Executive", "Admin", "Purchase Officer", "Operator"],
            },
            {
                id: "User-Activities",
                label: "User-Activities",
                href: "/user-activity",
                icon: "fa-solid fa-user-clock",
                roles: ["Executive", "Admin"],
            },
            {
                id: "Settings",
                label: "Settings",
                href: "/settings",
                icon: "fa-solid fa-gear",
                roles: ["Executive", "Admin"],
            }
        ]
    }
];