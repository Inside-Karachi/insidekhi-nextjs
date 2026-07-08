import React from "react";

interface HeroSectionStaticProps {
    children: React.ReactNode;
    className?: string;
    floating?: React.ReactNode;
}

/**
 * Lightweight hero section wrapper without framer-motion.
 * Uses CSS for all animations and avoids JavaScript-driven scroll effects.
 * This version is optimized for LCP as it renders immediately without
 * waiting for React hydration or motion library initialization.
 */
export function HeroSectionStatic({
    children,
    className = "",
    floating,
}: HeroSectionStaticProps) {
    return (
        <section
            className={`relative min-h-screen flex items-center justify-center overflow-hidden py-8 sm:py-12 md:py-16 lg:py-20 ${className}`}
        >
            {/* Background gradient */}
            <div
                className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-primary/10"
                aria-hidden
            />

            {/* Subtle 50px grid overlay */}
            <div
                className="absolute inset-0 bg-[linear-gradient(rgba(var(--primary-rgb),0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(var(--primary-rgb),0.02)_1px,transparent_1px)] bg-[size:50px_50px]"
                aria-hidden
            />

            {/* Decorative orbs - CSS-only with subtle animation */}
            <div
                className="hidden sm:block absolute -top-16 sm:-top-32 -right-16 sm:-right-32 w-48 h-48 sm:w-96 sm:h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none animate-float-slow"
                aria-hidden
            />

            <div
                className="hidden sm:block absolute -bottom-16 sm:-bottom-32 -left-16 sm:-left-32 w-48 h-48 sm:w-96 sm:h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none animate-float-slow-reverse"
                aria-hidden
            />

            {/* Floating slot (panels/icons) */}
            {floating}

            {/* Content slot */}
            <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 text-center">
                {children}
            </div>
        </section>
    );
}

export default HeroSectionStatic;
