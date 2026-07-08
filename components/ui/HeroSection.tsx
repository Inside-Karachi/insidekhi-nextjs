"use client";

import React from "react";
import { motion, useScroll, useTransform } from "framer-motion";

interface HeroSectionProps {
  children: React.ReactNode;
  className?: string;
  floating?: React.ReactNode;
}

// Reusable hero wrapper used across the app to ensure consistent background,
// subtle grid overlay, and decorative orbs. Use the `floating` prop to pass
// absolute-positioned UI (small floating panels) that should sit above the
// orbs but below the main content container.
export function HeroSection({ children, className = "", floating }: HeroSectionProps) {
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 500], [0, 150]);
  const yReverse = useTransform(scrollY, [0, 500], [0, -100]);
  const opacity = useTransform(scrollY, [200, 900], [1, 0]);
  const scale = useTransform(scrollY, [200, 800], [1, 0.95]);

  return (
    <section
      className={`relative min-h-screen flex items-center justify-center overflow-hidden py-8 sm:py-12 md:py-16 lg:py-20 ${className}`}
    >
      {/* background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-primary/10" aria-hidden />

      {/* subtle 50px grid overlay */}
      <div
        className="absolute inset-0 bg-[linear-gradient(rgba(var(--primary-rgb),0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(var(--primary-rgb),0.02)_1px,transparent_1px)] bg-[size:50px_50px]"
        aria-hidden
  />

  {/* decorative orbs */}
      <motion.div
        style={{ y }}
        className="hidden sm:block absolute -top-16 sm:-top-32 -right-16 sm:-right-32 w-48 h-48 sm:w-96 sm:h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none"
        aria-hidden
      />

      <motion.div
        style={{ y: yReverse }}
        className="hidden sm:block absolute -bottom-16 sm:-bottom-32 -left-16 sm:-left-32 w-48 h-48 sm:w-96 sm:h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none"
        aria-hidden
      />

      {/* floating slot (panels/icons) */}
      {floating}

      {/* content slot with unified parallax transforms */}
      <motion.div style={{ opacity, scale }} className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {children}
      </motion.div>
    </section>
  );
}

export default HeroSection;
