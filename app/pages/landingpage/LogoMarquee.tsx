"use client";

import Image from "next/image";
import Marquee from "react-fast-marquee";

function FacebookIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
            <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.51 1.49-3.9 3.77-3.9 1.09 0 2.23.2 2.23.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.89h2.78l-.44 2.91h-2.34V22c4.78-.76 8.44-4.92 8.44-9.94Z" />
        </svg>
    );
}

function InstagramIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
            <path d="M12 2c-2.72 0-3.06.01-4.12.06-1.06.05-1.79.22-2.43.47a4.9 4.9 0 0 0-1.77 1.15A4.9 4.9 0 0 0 2.53 5.45c-.25.64-.42 1.37-.47 2.43C2.01 8.94 2 9.28 2 12s.01 3.06.06 4.12c.05 1.06.22 1.79.47 2.43a4.9 4.9 0 0 0 1.15 1.77c.5.5 1.1.9 1.77 1.15.64.25 1.37.42 2.43.47C8.94 21.99 9.28 22 12 22s3.06-.01 4.12-.06c1.06-.05 1.79-.22 2.43-.47a4.9 4.9 0 0 0 1.77-1.15 4.9 4.9 0 0 0 1.15-1.77c.25-.64.42-1.37.47-2.43.05-1.06.06-1.4.06-4.12s-.01-3.06-.06-4.12c-.05-1.06-.22-1.79-.47-2.43a4.9 4.9 0 0 0-1.15-1.77 4.9 4.9 0 0 0-1.77-1.15c-.64-.25-1.37-.42-2.43-.47C15.06 2.01 14.72 2 12 2Zm0 1.8c2.67 0 2.99.01 4.04.06.98.04 1.5.2 1.86.34.47.18.8.4 1.15.75.35.35.57.68.75 1.15.14.36.3.88.34 1.86.05 1.05.06 1.37.06 4.04s-.01 2.99-.06 4.04c-.04.98-.2 1.5-.34 1.86-.18.47-.4.8-.75 1.15-.35.35-.68.57-1.15.75-.36.14-.88.3-1.86.34-1.05.05-1.37.06-4.04.06s-2.99-.01-4.04-.06c-.98-.04-1.5-.2-1.86-.34a3.1 3.1 0 0 1-1.15-.75 3.1 3.1 0 0 1-.75-1.15c-.14-.36-.3-.88-.34-1.86-.05-1.05-.06-1.37-.06-4.04s.01-2.99.06-4.04c.04-.98.2-1.5.34-1.86.18-.47.4-.8.75-1.15.35-.35.68-.57 1.15-.75.36-.14.88-.3 1.86-.34C9.01 3.81 9.33 3.8 12 3.8Zm0 3.06a5.14 5.14 0 1 0 0 10.28 5.14 5.14 0 0 0 0-10.28Zm0 8.48a3.34 3.34 0 1 1 0-6.68 3.34 3.34 0 0 1 0 6.68Zm5.34-8.68a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0Z" />
        </svg>
    );
}

const logos = [
    { src: "/images/partners/shopee.png", alt: "Shopee" },
    { src: "/images/partners/lazada.png", alt: "Lazada" },
    { src: "/images/partners/jnt.png", alt: "J&T Express" },
    { src: "/images/partners/flash.png", alt: "Flash Express" },
    { src: "/images/partners/lbc.png", alt: "LBC" },
    { src: "/images/partners/tiktok.png", alt: "TikTok Shop" },
    { src: "/images/partners/gogo.png", alt: "GoGo Xpress" },
];

const rowA = logos.slice(0, 4);
const rowB = logos.slice(4);

function LogoItem({ src, alt }: { src: string; alt: string }) {
    return (
        <div className="mx-6 flex h-16 w-28 shrink-0 items-center justify-center sm:mx-8 sm:h-20 sm:w-36 md:mx-10 md:h-24 md:w-40">
            <Image
                src={src}
                alt={alt}
                width={220}
                height={90}
                className="h-full w-full object-contain dark:opacity-90 dark:brightness-110 dark:grayscale-0"
            />
        </div>
    );
}

function LogoRow({
    items,
    direction,
    speed,
}: {
    items: { src: string; alt: string }[];
    direction: "left" | "right";
    speed: number;
}) {
    return (
        <div
            className="overflow-hidden"
            style={{
                maskImage:
                    "linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)",
                WebkitMaskImage:
                    "linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)",
            }}
        >
            <Marquee
                direction={direction}
                speed={speed}
                pauseOnHover
                gradient={false}
                autoFill
            >
                {items.map((logo) => (
                    <LogoItem key={logo.alt} {...logo} />
                ))}
            </Marquee>
        </div>
    );
}

export default function LogoMarquee() {
    return (
        <section className="w-full bg-[#FAFAFA] px-6 py-20 transition-colors duration-500 dark:bg-ink sm:py-28">
            <div className="mx-auto mb-14 flex max-w-3xl flex-col items-center text-center sm:mb-20">
                <h2 className="text-[32px] font-extrabold leading-[1.1] tracking-[-0.02em] text-[#1C1B1F] font-bricolage dark:text-paper sm:text-5xl md:text-[56px]">
                    Our Partners &amp; Clients
                </h2>
                <p className="mt-4 text-base text-[#6B6B76] font-rethink dark:text-paper/60 sm:text-lg">
                    Trusted by leading platforms across the Philippines.
                </p>
                <div className="mt-6 flex items-center gap-3">

                    <a href="https://web.facebook.com/profile.php?id=61571986650033"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Facebook"
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E4E4E4] bg-white text-[#1C1B1F] transition-colors hover:bg-[#E5167E] hover:text-white dark:border-paper/15 dark:bg-paper/5 dark:text-paper"
                    >
                        <FacebookIcon />
                    </a>

                    <a href="https://www.instagram.com/airshipexpresss"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Instagram"
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E4E4E4] bg-white text-[#1C1B1F] transition-colors hover:bg-[#E5167E] hover:text-white dark:border-paper/15 dark:bg-paper/5 dark:text-paper"
                    >
                        <InstagramIcon />
                    </a>
                </div>
            </div>

            <div className="flex flex-col gap-10 sm:gap-14">
                <LogoRow items={rowA} direction="left" speed={38} />
                <LogoRow items={rowB} direction="right" speed={34} />
            </div>
        </section>
    );
}