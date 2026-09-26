"use client";

import Link from "next/link";

interface ViewLinkProps {
    link: string;
    name: string;
}

const ViewLink = ({ link, name }: ViewLinkProps) => {
    return (
        <Link
            href={link}
            className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider 
                    text-pink-600 dark:text-pink-400 
                    hover:text-pink-700 dark:hover:text-pink-300 
                    transition-colors duration-200"
        >
            <span>{name}</span>
            <i className="fas fa-arrow-right text-[10px]"></i>
        </Link>
    );
};

export default ViewLink;