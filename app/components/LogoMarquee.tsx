"use client";

import Image from "next/image";
import Marquee from "react-fast-marquee";

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
        <div className="mx-8 flex shrink-0 items-center justify-center grayscale opacity-70 transition-all duration-300 hover:opacity-100 hover:grayscale-0 sm:mx-10 md:mx-14">
            <Image
                src={src}
                alt={alt}
                width={220}
                height={90}
                className="h-12 w-auto object-contain sm:h-16 md:h-20"
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
           
            <Marquee direction={direction} speed={speed} pauseOnHover gradient={false}>
                {items.map((logo) => (
                    <LogoItem key={logo.alt} {...logo} />
                ))}
            </Marquee>
        </div>
    );
}

export default function LogoMarquee() {
    return (
        <section className="w-full bg-[#FAFAFA] px-6 py-20 sm:py-28">
            <div className="mx-auto mb-14 flex max-w-3xl flex-col items-center text-center sm:mb-20">
                <h2 className="text-[32px] font-extrabold leading-[1.1] tracking-[-0.02em] text-[#262525] font-bricolage sm:text-5xl md:text-[56px]">
                    Our Partners &amp; Clients
                </h2>
                <p className="mt-4 text-base text-[#6F6F6F] font-rethink sm:text-lg">
                    Trusted by leading platforms across the Philippines.
                </p>
            </div>

            <div className="flex flex-col gap-10 sm:gap-14">
                <LogoRow items={rowA} direction="left" speed={38} />
                <LogoRow items={rowB} direction="right" speed={34} />
            </div>
        </section>
    );
}