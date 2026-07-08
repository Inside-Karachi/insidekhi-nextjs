"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";
import {
  sectionVariants,
  viewportSettings,
} from "@/lib/utils/listing-animations";

interface AnimatedSectionProps {
  children: ReactNode;
  className?: string;
}

/**
 * Reusable animated section wrapper for consistent animations across event pages
 * This component provides a standardized fade-in animation for sections
 */
export function AnimatedSection({ children, className }: AnimatedSectionProps) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={viewportSettings}
      variants={sectionVariants}
    >
      {children}
    </motion.div>
  );
}
