import Image from "next/image";
import Link from "next/link";
import { Phone, Mail, MapPin } from "lucide-react";

function FacebookIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
            <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.51 1.49-3.9 3.77-3.9 1.09 0 2.23.2 2.23.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.89h2.78l-.44 2.91h-2.34V22c4.78-.76 8.44-4.92 8.44-9.94Z" />
        </svg>
    );
}

function TikTokIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
            <path d="M16.6 5.82c-1-.86-1.6-2.13-1.6-3.52h-3.06v13.9c0 1.47-1.2 2.66-2.67 2.66a2.67 2.67 0 0 1-2.67-2.66 2.67 2.67 0 0 1 2.67-2.67c.29 0 .57.04.83.13V10.6a5.7 5.7 0 0 0-.83-.06 5.72 5.72 0 0 0-5.72 5.72A5.72 5.72 0 0 0 9.27 22a5.72 5.72 0 0 0 5.72-5.72V9.01a8.34 8.34 0 0 0 4.88 1.56V7.52c-1.17 0-2.25-.4-3.27-1.7Z" />
        </svg>
    );
}

function InstagramIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="5" />
            <circle cx="12" cy="12" r="3.6" />
            <circle cx="17.4" cy="6.6" r="0.9" fill="currentColor" stroke="none" />
        </svg>
    );
}

const linkColumns = [
    {
        title: "Company",
        links: [
            { label: "About", href: "#about" },
            { label: "Services", href: "#services" },
            { label: "Careers", href: "#careers" },
        ],
    },
    {
        title: "Services",
        links: [
            { label: "Same-Day Delivery", href: "#services" },
            { label: "Nationwide Shipping", href: "#services" },
            { label: "Bulk & Business", href: "#services" },
        ],
    },
    {
        title: "Support",
        links: [
            { label: "Track Package", href: "#track" },
            { label: "Contact Us", href: "#contact" },
            { label: "FAQs", href: "#faq" },
        ],
    },
];

export default function Footer() {
    return (
        <footer className="relative w-full overflow-hidden rounded-t-[2.5rem] bg-[#0B1E3D] pt-16">
            <span className="pointer-events-none absolute -bottom-6 left-4 select-none text-[7rem] sm:text-[10rem] md:text-[13rem] font-extrabold leading-none tracking-tight text-white/[0.04] font-bricolage">
                AIRSHIP
            </span>

            <div className="relative mx-auto grid w-full max-w-6xl grid-cols-1 gap-12 px-6 pb-16 sm:grid-cols-2 md:grid-cols-4">
                <div className="flex flex-col gap-4">
                    <Link href="/" className="flex items-center gap-2">
                        <Image
                            src="/images/logo-remove-bg.png"
                            alt="Airship Express"
                            width={140}
                            height={40}
                            className="h-9 w-auto object-contain brightness-0 invert"
                        />
                    </Link>
                    <p className="text-sm leading-relaxed text-white/55 font-rethink">
                        Fast, reliable courier and delivery services you can trust —
                        every parcel, every time.
                    </p>

                    <div>
                        <h4 className="mb-3 text-sm font-semibold text-white font-bricolage">
                            Socials
                        </h4>
                        <div className="flex items-center gap-3">
                            <a
                                href="https://web.facebook.com/profile.php?id=61571986650033"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white transition-colors hover:bg-white/10"
                            >
                                <FacebookIcon />
                            </a>
                            <a
                                href="#"
                                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white transition-colors hover:bg-white/10"
                            >
                                <InstagramIcon />
                            </a>
                            <a
                                href="#"
                                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white transition-colors hover:bg-white/10"
                            >
                                <TikTokIcon />
                            </a>
                        </div>
                    </div>
                </div>

                {linkColumns.map((col) => (
                    <div key={col.title}>
                        <h4 className="mb-4 text-sm font-semibold text-white font-bricolage">
                            {col.title}
                        </h4>
                        <ul className="flex flex-col gap-2.5 text-sm text-white/55 font-rethink">
                            {col.links.map((l) => (
                                <li key={l.label}>
                                    <Link href={l.href} className="transition-colors hover:text-white">
                                        {l.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>

            <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-3 border-t border-white/10 px-6 py-6 text-sm text-white/55 font-rethink sm:flex-row sm:items-center sm:justify-center sm:gap-8">
                <span className="flex items-center gap-2">
                    <Phone className="h-4 w-4" /> +63 900 000 0000
                </span>
                <span className="flex items-center gap-2">
                    <Mail className="h-4 w-4" /> hello@airshipexpress.ph
                </span>
                <span className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" /> Metro Manila, PH
                </span>
            </div>

            <div className="relative flex w-full flex-col items-center justify-between gap-3 border-t border-white/10 px-6 py-6 text-xs text-white/40 font-rethink sm:flex-row">
                <span>© {new Date().getFullYear()} Airship Express. All rights reserved.</span>
                <div className="flex items-center gap-6">
                    <Link href="#" className="hover:text-white/70 transition-colors">
                        Privacy Policy
                    </Link>
                    <Link href="#" className="hover:text-white/70 transition-colors">
                        Terms of Service
                    </Link>
                </div>
            </div>
        </footer>
    );
}