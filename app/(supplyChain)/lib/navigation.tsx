export const NAV = [
    {
        section: "Operations",
        items: [
            {
                id: "executive",
                label: "Executive Overview",
                href: "/executive",
                icon: "fa-solid fa-grip",
                roles: ["Executive", "Admin"],
            },
            {
                id: "warehouse",
                label: "Warehousing",
                href: "/warehousing",
                icon: "fa-solid fa-box",
                roles: ["Executive", "Admin", "Manager", "Operator"],
            },
            {
                id: "inventory",
                label: "Parcel Inventory",
                href: "/inventory",
                icon: "fa-solid fa-layer-group",
                roles: ["Executive", "Admin", "Manager", "Employee", "Operator"],
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
                roles: ["Executive", "Admin", "Manager"],
            },
            {
                id: "suppliers",
                label: "Suppliers",
                href: "/suppliers",
                icon: "fa-solid fa-users",
                roles: ["Executive", "Admin", "Manager"],
            },
            {
                id: "purchase-orders",
                label: "Purchase Orders",
                href: "/purchase-orders",
                icon: "fa-solid fa-file",
                roles: ["Executive", "Admin", "Manager"],
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
                roles: ["Executive", "Admin", "Manager", "Employee"],
            },
            {
                id: "forecast",
                label: "Forecast",
                href: "/forecast",
                icon: "fa-solid fa-chart-line",
                roles: ["Executive", "Admin", "Manager"],
            },
        ],
    },
    {
        section: "Others",
        items: [
            {
                id: "Gallery",
                label: "Gallery",
                href: "/gallery",
                icon: "fa-solid fa-images",
                roles: ["Executive", "Admin", "Manager", "Employee"],
            },
            {
                id: "Trash",
                label: "Trash",
                href: "/trash",
                icon: "fa-solid fa-trash",
                roles: ["Executive", "Admin", "Manager", "Employee"],
            },
            {
                id: "User-Activities",
                label: "User-Activities",
                href: "/user-activity",
                icon: "fa-solid fa-user-clock",
                roles: ["Executive", "Admin"],
            }
        ]
    }
];