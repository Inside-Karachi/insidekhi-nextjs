// Shared fade-in-up animation configs for listing page sections.

import { Variants } from "framer-motion";

// ============================================================================
// PERFORMANCE-OPTIMIZED SECTION ANIMATIONS
// Reduced durations for faster perceived load time
// ============================================================================

/**
 * Standard fade-in-up animation for page sections
 * All sections should use this for consistent entry animations
 * Duration: 0.35s (reduced from 0.5s for faster UX)
 */
export const sectionVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 15,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.35,
      ease: [0.25, 0.1, 0.25, 1], // Smooth easeOut
    },
  },
};

/**
 * Section container that orchestrates staggered children
 * Reduced stagger for faster overall animation completion
 */
export const sectionContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.05,
    },
  },
};

// ============================================================================
// CARD/ITEM ANIMATIONS
// Used for grid items, feature cards, review cards, etc.
// ============================================================================

/**
 * Standard card animation with subtle scale effect
 * Duration: 0.3s (reduced from 0.4s)
 */
export const cardVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.97,
    y: 8,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
};

/**
 * Staggered container for card grids
 * Fast stagger for snappy card appearance
 */
export const cardGridVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.03,
    },
  },
};

// ============================================================================
// HERO ANIMATIONS
// Special animations for hero sections (kept slightly longer for impact)
// ============================================================================

/**
 * Hero image/background animation
 * Duration: 0.5s (reduced from 0.8s)
 */
export const heroImageVariants: Variants = {
  hidden: {
    scale: 1.05,
    opacity: 0,
  },
  visible: {
    scale: 1,
    opacity: 1,
    transition: {
      duration: 0.5,
      ease: "easeOut",
    },
  },
};

/**
 * Hero content animation (title, badges, etc.)
 * Duration: 0.4s, delay: 0.1s (reduced from 0.6s/0.2s)
 */
export const heroContentVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 20,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      delay: 0.1,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
};

/**
 * Hero badge container with fast stagger
 */
export const heroBadgeContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.15,
    },
  },
};

export const heroBadgeVariants: Variants = {
  hidden: {
    opacity: 0,
    x: -8,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.3,
      ease: "easeOut",
    },
  },
};

// Sidebar animations (sticky components), reduced delay.

export const sidebarVariants: Variants = {
  hidden: {
    opacity: 0,
    x: 15,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.4,
      delay: 0.15, // Reduced delay
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
};

// List item animations (opening hours, reviews), fast.

export const listItemVariants: Variants = {
  hidden: {
    opacity: 0,
    x: -8,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.25,
      ease: "easeOut",
    },
  },
};

export const listContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.05,
    },
  },
};

// ============================================================================
// LIGHTBOX/MODAL ANIMATIONS
// ============================================================================

export const lightboxOverlayVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.2 },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.2 },
  },
};

export const lightboxContentVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.9,
  },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.3,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    transition: {
      duration: 0.2,
    },
  },
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Creates a staggered delay based on index
 * Use this for items in a grid/list that should animate in sequence
 *
 * @param index - The item's index in the list
 * @param baseDelay - Starting delay (default: 0)
 * @param staggerAmount - Delay between each item (default: 0.08s)
 */
export function getStaggerDelay(
  index: number,
  baseDelay: number = 0,
  staggerAmount: number = 0.08,
): number {
  return baseDelay + index * staggerAmount;
}

/**
 * Creates custom transition with standard easing
 */
export function createTransition(
  duration: number = 0.4,
  delay: number = 0,
): { duration: number; delay: number; ease: number[] } {
  return {
    duration,
    delay,
    ease: [0.25, 0.1, 0.25, 1],
  };
}

// ============================================================================
// VIEWPORT ANIMATION SETTINGS
// For scroll-triggered animations using whileInView
// ============================================================================

export const viewportSettings = {
  once: true, // Only animate once
  amount: 0.2, // Trigger when 20% of element is visible
  margin: "-50px", // Start animation slightly before element enters viewport
};

// ============================================================================
// REDUCED MOTION SUPPORT
// ============================================================================

/**
 * Returns simplified variants for users with reduced motion preferences
 * Components should check for this preference and use these instead
 */
export const reducedMotionVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.01 },
  },
};

/**
 * Hook-friendly check for reduced motion preference
 * Usage: const prefersReducedMotion = useReducedMotion();
 */
export function checkReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
