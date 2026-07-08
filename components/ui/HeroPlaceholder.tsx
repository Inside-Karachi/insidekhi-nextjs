"use client";

import React from "react";

type Variant = "default" | "search" | "stats" | "about" | "contact" | "membership";

interface HeroPlaceholderProps {
  variant?: Variant;
}

export function HeroPlaceholder({ variant = "default" }: HeroPlaceholderProps) {
  // Small, composable skeleton blocks rendered per variant so each hero
  // placeholder closely matches its real layout without creating many files.
  return (
    <section className="relative min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            {/* Shared header area */}
            <div className="space-y-4">
              <div className="h-8 w-36 bg-background/60 rounded-full" />
              <div className="h-10 sm:h-12 bg-background/60 rounded-md w-full" />
              <div className="h-4 bg-background/60 rounded-md w-3/4" />
            </div>

            {/* Variant specific areas */}
            <div className="mt-6">
              {variant === "search" && (
                <div className="space-y-3">
                  <div className="h-12 bg-background/60 rounded-md w-full" />
                  <div className="h-3 bg-background/60 rounded-md w-3/4" />
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                    <div className="h-20 bg-background/60 rounded-xl" />
                    <div className="h-20 bg-background/60 rounded-xl" />
                    <div className="h-20 bg-background/60 rounded-xl" />
                    <div className="h-20 bg-background/60 rounded-xl" />
                  </div>
                </div>
              )}

              {variant === "stats" && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="h-20 bg-background/60 rounded-xl" />
                  <div className="h-20 bg-background/60 rounded-xl" />
                  <div className="h-20 bg-background/60 rounded-xl" />
                  <div className="h-20 bg-background/60 rounded-xl" />
                </div>
              )}

              {variant === "about" && (
                <div className="space-y-4">
                  <div className="h-4 bg-background/60 rounded-md w-full" />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <div className="h-28 bg-background/60 rounded-xl" />
                    <div className="h-28 bg-background/60 rounded-xl" />
                    <div className="h-28 bg-background/60 rounded-xl" />
                  </div>
                </div>
              )}

              {variant === "contact" && (
                <div className="space-y-4">
                  <div className="h-12 bg-background/60 rounded-md w-full" />
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                    <div className="h-20 bg-background/60 rounded-xl" />
                    <div className="h-20 bg-background/60 rounded-xl" />
                    <div className="h-20 bg-background/60 rounded-xl" />
                    <div className="h-20 bg-background/60 rounded-xl" />
                  </div>
                </div>
              )}

              {variant === "membership" && (
                <div className="space-y-4">
                  <div className="h-10 bg-background/60 rounded-md w-full" />
                  <div className="h-4 bg-background/60 rounded-md w-3/4" />
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                    <div className="h-20 bg-background/60 rounded-xl" />
                    <div className="h-20 bg-background/60 rounded-xl" />
                    <div className="h-20 bg-background/60 rounded-xl" />
                    <div className="h-20 bg-background/60 rounded-xl" />
                  </div>
                </div>
              )}

              {variant === "default" && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                  <div className="h-20 bg-background/60 rounded-xl" />
                  <div className="h-20 bg-background/60 rounded-xl" />
                  <div className="h-20 bg-background/60 rounded-xl" />
                  <div className="h-20 bg-background/60 rounded-xl" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default HeroPlaceholder;
