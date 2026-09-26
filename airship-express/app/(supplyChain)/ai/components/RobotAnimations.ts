// app/components/ai/components/RobotAnimations.ts

import { Easing } from 'framer-motion';

const easeInOut: Easing = [0.42, 0, 0.58, 1];
const easeOut: Easing = [0, 0, 0.58, 1];

export const robotAnimations = {
    idle: {
        y: [0, -12, 0, -8, 0],
        rotate: [0, 3, 0, -3, 0],
        transition: {
            y: {
                duration: 3,
                repeat: Infinity,
                ease: easeInOut,
                repeatType: "loop" as const,
            },
            rotate: {
                duration: 5,
                repeat: Infinity,
                ease: easeInOut,
                repeatType: "loop" as const,
            },
        },
    },
    hover: {
        scale: 1.08,
        y: -8,
        transition: {
            duration: 0.3,
            ease: easeOut,
        },
    },
    thinking: {
        y: [0, -15, -8, -15, 0],
        rotate: [0, -12, 0, 12, 0],
        transition: {
            y: {
                duration: 1.5,
                repeat: Infinity,
                ease: easeInOut,
                repeatType: "loop" as const,
            },
            rotate: {
                duration: 1.5,
                repeat: Infinity,
                ease: easeInOut,
                repeatType: "loop" as const,
            },
        },
    },
    listening: {
        y: [0, -4, 0, -4, 0],
        rotate: [0, 2, -2, 2, 0],
        transition: {
            y: {
                duration: 0.6,
                repeat: Infinity,
                ease: easeInOut,
                repeatType: "loop" as const,
            },
            rotate: {
                duration: 0.6,
                repeat: Infinity,
                ease: easeInOut,
                repeatType: "loop" as const,
            },
        },
    },
    responding: {
        y: [0, -5, 0, -5, 0],
        rotate: [0, 3, 0, 3, 0],
        transition: {
            y: {
                duration: 0.8,
                repeat: Infinity,
                ease: easeInOut,
                repeatType: "loop" as const,
            },
            rotate: {
                duration: 0.8,
                repeat: Infinity,
                ease: easeInOut,
                repeatType: "loop" as const,
            },
        },
    },
    wave: {
        rotate: [0, -35, 0, -35, 0, -15, 0],
        transition: {
            duration: 0.8,
            ease: easeOut,
            times: [0, 0.2, 0.3, 0.5, 0.6, 0.8, 1],
        },
    },
    jump: {
        y: [0, -40, 0],
        scale: [1, 1.2, 1],
        transition: {
            y: {
                duration: 0.5,
                ease: easeOut,
                times: [0, 0.5, 1],
            },
            scale: {
                duration: 0.5,
                ease: easeOut,
                times: [0, 0.5, 1],
            },
        },
    },
    greeting: {
        y: [0, -25, -15, -20, 0],
        rotate: [0, 15, 0, -10, 0],
        scale: [1, 1.15, 1.05, 1.1, 1],
        transition: {
            y: {
                duration: 0.8,
                ease: easeOut,
                times: [0, 0.3, 0.5, 0.7, 1],
            },
            rotate: {
                duration: 0.8,
                ease: easeOut,
                times: [0, 0.2, 0.4, 0.6, 1],
            },
            scale: {
                duration: 0.8,
                ease: easeOut,
                times: [0, 0.3, 0.5, 0.7, 1],
            },
        },
    },
    happy: {
        y: [0, -20, -10, -15, 0],
        rotate: [0, 10, -5, 5, 0],
        scale: [1, 1.1, 1.05, 1.08, 1],
        transition: {
            y: {
                duration: 0.6,
                ease: easeOut,
                times: [0, 0.25, 0.5, 0.75, 1],
            },
            rotate: {
                duration: 0.6,
                ease: easeOut,
                times: [0, 0.25, 0.5, 0.75, 1],
            },
            scale: {
                duration: 0.6,
                ease: easeOut,
                times: [0, 0.25, 0.5, 0.75, 1],
            },
        },
    },
    mad: {
        rotate: [0, -25, 25, -20, 20, 0],
        scale: [1, 1.08, 0.92, 1.05, 0.95, 1],
        transition: {
            duration: 0.6,
            ease: easeInOut,
            times: [0, 0.2, 0.4, 0.6, 0.8, 1],
        },
    },
    confused: {
        rotate: [0, -15, 15, -10, 10, 0],
        scale: [1, 0.95, 1, 0.97, 1],
        transition: {
            duration: 0.7,
            ease: easeInOut,
            times: [0, 0.2, 0.4, 0.6, 0.8, 1],
        },
    },
    sad: {
        y: [0, -8, -4, -6, 0],
        rotate: [0, -5, 5, -3, 0],
        transition: {
            y: {
                duration: 0.8,
                ease: easeOut,
                times: [0, 0.25, 0.5, 0.75, 1],
            },
            rotate: {
                duration: 0.8,
                ease: easeOut,
                times: [0, 0.25, 0.5, 0.75, 1],
            },
        },
    },
};

export const glowAnimation = {
    idle: {
        opacity: [0.25, 0.5, 0.25],
        scale: [0.9, 1.1, 0.9],
        transition: {
            duration: 3,
            repeat: Infinity,
            ease: easeInOut,
            repeatType: "loop" as const,
        },
    },
    hover: {
        opacity: 0.7,
        scale: 1.3,
        transition: {
            duration: 0.3,
            ease: easeOut,
        },
    },
    thinking: {
        opacity: [0.4, 0.8, 0.4],
        scale: [1, 1.4, 1],
        transition: {
            duration: 1.5,
            repeat: Infinity,
            ease: easeInOut,
            repeatType: "loop" as const,
        },
    },
    listening: {
        opacity: [0.3, 0.6, 0.3],
        scale: [1, 1.3, 1],
        transition: {
            duration: 1.2,
            repeat: Infinity,
            ease: easeInOut,
            repeatType: "loop" as const,
        },
    },
    happy: {
        opacity: [0.3, 0.7, 0.3],
        scale: [1, 1.5, 1],
        transition: {
            duration: 0.8,
            repeat: Infinity,
            ease: easeInOut,
            repeatType: "loop" as const,
        },
    },
};