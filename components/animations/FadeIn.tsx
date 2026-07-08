/**
 * Lightweight Animation Wrapper
 * Replaces framer-motion for simple fade-in animations
 * Reduces bundle size by ~80KB when used instead of framer-motion
 */

import { cn } from "@/lib/utils";
import { CSSProperties, ReactNode } from "react";

interface FadeInProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  style?: CSSProperties;
}

/**
 * Simple CSS-based fade-in animation
 * Use this instead of framer-motion for basic entrance animations
 */
export function FadeIn({
  children,
  className,
  delay = 0,
  duration = 0.5,
  style,
}: FadeInProps) {
  return (
    <div
      className={cn("animate-fade-in", className)}
      style={{
        ...style,
        animationDelay: `${delay}s`,
        animationDuration: `${duration}s`,
        animationFillMode: "both",
      }}
    >
      {children}
    </div>
  );
}

/**
 * Stagger children animations
 * Automatically applies incremental delays to children
 */
export function StaggerChildren({
  children,
  staggerDelay = 0.1,
  className,
}: {
  children: ReactNode[];
  staggerDelay?: number;
  className?: string;
}) {
  return (
    <div className={className}>
      {Array.isArray(children) &&
        children.map((child, index) => (
          <FadeIn key={index} delay={index * staggerDelay}>
            {child}
          </FadeIn>
        ))}
    </div>
  );
}
