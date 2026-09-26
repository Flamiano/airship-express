import { useEffect, useState } from "react";

interface UseResponsiveItemsPerPageOptions {
    mobileBreakpoint?: number;
    mobileItems?: number;
    desktopItems?: number;
}

export function useResponsiveItemsPerPage({
    mobileBreakpoint = 768,
    mobileItems = 5,
    desktopItems = 10,
}: UseResponsiveItemsPerPageOptions = {}) {
    const [itemsPerPage, setItemsPerPage] = useState(desktopItems);

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < mobileBreakpoint) {
                setItemsPerPage(mobileItems);
            } else {
                setItemsPerPage(desktopItems);
            }
        };

        handleResize();

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [mobileBreakpoint, mobileItems, desktopItems]);

    return itemsPerPage;
}