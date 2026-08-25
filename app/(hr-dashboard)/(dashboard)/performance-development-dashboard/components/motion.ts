import type { Variants } from "framer-motion";

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  shown: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: "easeOut" },
  },
};

export const staggerContainer: Variants = {
  hidden: {},
  shown: {
    transition: { staggerChildren: 0.05, delayChildren: 0.05 },
  },
};

export const staggerItem: Variants = fadeUp;
