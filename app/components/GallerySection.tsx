"use client";

import Image from "next/image";
import useEmblaCarousel from "embla-carousel-react";
import AutoScroll from "embla-carousel-auto-scroll";

const photos = [
    "/images/723562191_122113968482732888_3268815767835544895_n.jpg",
    "/images/727519680_122115371912732888_9195368293136817016_n.jpg",
    "/images/735317471_122116417382732888_4342694971203913098_n.jpg",
    "/images/740425573_122117122490732888_1639837946380566561_n.jpg",
];

export default function GallerySection() {
    const [emblaRef] = useEmblaCarousel({ loop: true, dragFree: true, align: "start" }, [
        AutoScroll({ speed: 0.6, stopOnInteraction: false, stopOnMouseEnter: true }),
    ]);

    return (
        <section id="gallery" className="w-full bg-white px-6 py-20 sm:py-28">
            <div className="mx-auto mb-12 flex max-w-3xl flex-col items-center text-center sm:mb-16">
                <h2 className="text-[32px] font-extrabold leading-[1.1] tracking-[-0.02em] text-[#262525] font-bricolage sm:text-5xl md:text-[56px]">
                    On the Road, Every Day
                </h2>
                <p className="mt-4 text-base text-[#6F6F6F] font-rethink sm:text-lg">
                    A look at real deliveries handled by our team across Metro Manila.
                </p>
            </div>

            <div className="overflow-hidden" ref={emblaRef}>
                <div className="flex gap-5 sm:gap-6">
                    {photos.map((src) => (
                        <div
                            key={src}
                            className="relative h-64 w-[75vw] shrink-0 overflow-hidden rounded-3xl sm:h-80 sm:w-[420px] md:h-96"
                        >
                            <Image
                                src={src}
                                alt="Airship Express delivery in progress"
                                fill
                                sizes="(max-width: 640px) 75vw, 420px"
                                className="object-cover"
                            />
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}