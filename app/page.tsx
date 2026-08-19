"use client";

import { useEffect, useRef, useState } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Navbar from "./components/Navbar";
import Loader from "./components/Loader";
import CustomCursor from "./components/CustomCursor";
import LogoMarquee from "./pages/landingpage/LogoMarquee";
import Services from "./pages/landingpage/Services";
import HowItWorks from "./pages/landingpage/HowItWorks";
import GallerySection from "./pages/landingpage/GallerySection";
import CoverageArea from "./pages/landingpage/CoverageArea";
import CommandCenter from "./pages/landingpage/CommandCenter";
import Footer from "./components/Footer";
import Hero from "./pages/landingpage/Hero";

export default function Home() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const galleryRef = useRef<HTMLDivElement>(null);
  const lenisRef = useRef<Lenis | null>(null);
  const [loading, setLoading] = useState(true);
  const [heroReady, setHeroReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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
    lenisRef.current = lenis;
    (window as unknown as { __lenis?: Lenis }).__lenis = lenis;

    function raf(time: number) {
      lenis.raf(time * 1000);
    }
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

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
      lenisRef.current = null;
      delete (window as unknown as { __lenis?: Lenis }).__lenis;
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, []);

  useEffect(() => {
    if (menuOpen) {
      lenisRef.current?.stop();
    } else {
      lenisRef.current?.start();
    }
  }, [menuOpen]);

  return (
    <>
      {loading && (
        <Loader
          onComplete={() => {
            setLoading(false);
            setHeroReady(true);
          }}
        />
      )}

      <CustomCursor containerRef={scrollRef} />

      <div
        ref={scrollRef}
        className={`scroll-container relative w-full h-[100dvh] overflow-x-hidden overscroll-none touch-pan-y ios-scroll-fix bg-paper transition-colors duration-500 dark:bg-ink lg:cursor-none ${menuOpen ? "overflow-y-hidden" : "overflow-y-auto"
          }`}
      >
        <div>
          <Navbar onMenuOpenChange={setMenuOpen} ready={heroReady} />

          <Hero ready={heroReady} />

          <LogoMarquee />
          <Services />
          <HowItWorks />

          <div ref={galleryRef}>
            <GallerySection />
          </div>

          <CoverageArea />
          <CommandCenter />

          <Footer />
        </div>
      </div>
    </>
  );
}