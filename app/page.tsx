"use client";

import { useEffect, useRef } from "react";
import { motion, type Variants } from "framer-motion";
import { ArrowRight, MapPin } from "lucide-react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Navbar from "./components/Navbar";
import LogoMarquee from "./components/LogoMarquee";
import GallerySection from "./components/GallerySection";
import Footer from "./components/Footer";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] },
  }),
};

export default function Home() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const galleryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrapper = scrollRef.current;
    if (!wrapper) return;

    gsap.registerPlugin(ScrollTrigger);

    const lenis = new Lenis({
      wrapper,
      content: wrapper.firstElementChild as HTMLElement,
      duration: 1.1,
      smoothWheel: true,
    });

    // Keep GSAP's ticker and ScrollTrigger in sync with Lenis's raf loop.
    function raf(time: number) {
      lenis.raf(time * 1000);
    }
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    // Lenis moves scrollTop on the wrapper itself, so ScrollTrigger just
    // needs to know this div is the scroller instead of the window.
    ScrollTrigger.defaults({ scroller: wrapper });
    lenis.on("scroll", ScrollTrigger.update);

    let ctx: gsap.Context | undefined;
    if (galleryRef.current) {
      ctx = gsap.context(() => {
        gsap.from(galleryRef.current, {
          opacity: 0,
          y: 40,
          duration: 0.8,
          ease: "power3.out",
          scrollTrigger: {
            trigger: galleryRef.current,
            start: "top 85%",
          },
        });
      });
    }

    return () => {
      gsap.ticker.remove(raf);
      ctx?.revert();
      lenis.destroy();
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, []);

  return (
    <div
      ref={scrollRef}
      className="scroll-container relative w-full h-[100dvh] overflow-y-auto overflow-x-hidden overscroll-none touch-pan-y ios-scroll-fix bg-[#FEFEFE]"
    >
      <div>
        <Navbar />

        <section className="w-full h-[800px] flex flex-col items-center justify-center relative overflow-hidden bg-[#F9F9F9]">
          {/* Decorative background blurs */}
          <div className="pointer-events-none absolute -top-32 -left-32 h-72 w-72 rounded-full bg-emerald-100 blur-3xl opacity-60" />
          <div className="pointer-events-none absolute -top-20 -right-24 h-72 w-72 rounded-full bg-orange-100 blur-3xl opacity-50" />

          <div className="relative z-10 flex-1 w-full flex justify-center items-center px-4 sm:px-6 md:!px-12 lg:px-8 py-12 md:py-16">
            <div className="mx-auto flex w-full max-w-5xl flex-col items-center">
              {/* Eyebrow tag */}
              <motion.div
                variants={fadeUp}
                initial="hidden"
                animate="show"
                custom={0}
                className="mb-6 flex items-center gap-2 rounded-full border border-[#EAEAEA] bg-white px-4 py-1.5 text-xs sm:text-sm font-medium text-[#6F6F6F] font-rethink"
              >
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                Fast &amp; Reliable Courier Service
              </motion.div>

              {/* Heading */}
              <motion.h1
                variants={fadeUp}
                initial="hidden"
                animate="show"
                custom={1}
                className="w-full max-w-[700px] text-[2rem] sm:text-[42px] md:text-[52px] lg:text-[60px] font-extrabold leading-[1.1] sm:leading-[1.15] md:leading-[1.2] lg:leading-[60px] tracking-[-0.03em] text-center font-bricolage text-[#262525]"
              >
                Delivering your packages, on time, every time
              </motion.h1>

              {/* Subtext */}
              <motion.p
                variants={fadeUp}
                initial="hidden"
                animate="show"
                custom={2}
                className="mt-5 sm:mt-6 max-w-full sm:max-w-[560px] text-sm sm:text-base lg:text-lg font-normal leading-relaxed font-rethink text-[#6F6F6F] text-center"
              >
                Airship Express Courier Services gets your parcels where they need
                to go, quickly and securely, with real-time tracking every step of
                the way.
              </motion.p>

              {/* CTA buttons */}
              <motion.div
                variants={fadeUp}
                initial="hidden"
                animate="show"
                custom={3}
                className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:justify-center"
              >
                <motion.a
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  href="https://web.facebook.com/profile.php?id=61571986650033"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex h-12 items-center justify-center gap-2 rounded-full bg-[#262525] px-8 text-sm sm:text-base font-semibold text-white transition-colors hover:bg-[#3a3a3a] font-rethink"
                >
                  Book a Delivery
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </motion.a>
                <motion.a
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  href="#"
                  className="group flex h-12 items-center justify-center gap-2 rounded-full border border-[#E4E4E4] bg-white px-8 text-sm sm:text-base font-semibold text-[#262525] transition-colors hover:bg-[#FAFAFA] font-rethink"
                >
                  <MapPin className="h-4 w-4" />
                  Track Your Package
                </motion.a>
              </motion.div>
            </div>
          </div>
        </section>

        <LogoMarquee />

        <div ref={galleryRef}>
          <GallerySection />
        </div>

        <Footer />
      </div>
    </div>
  );
}