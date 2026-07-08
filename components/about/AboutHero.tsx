"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import HeroSection from "@/components/ui/HeroSection";
import HeroPlaceholder from "@/components/ui/HeroPlaceholder";
import { Heart, TrendingUp, Shield, MapPin, Sparkles, ArrowRight, Store } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function AboutHero() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <HeroPlaceholder variant="about" />;
  // Parallax handled by HeroSection wrapper

  return (
    <HeroSection
      floating={
        <>
          <motion.div
            animate={{ y: [0, -20, 0], rotate: [0, 4, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-16 sm:top-20 left-4 sm:left-20 p-2 sm:p-3 rounded-lg sm:rounded-xl bg-background/20 backdrop-blur-xl border border-border/30"
          >
            <Heart className="h-4 w-4 sm:h-6 sm:w-6 text-primary" />
          </motion.div>

          <motion.div
            animate={{ y: [0, 15, 0], rotate: [0, -4, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 2 }}
            className="absolute top-24 sm:top-32 right-4 sm:right-32 p-2 sm:p-3 rounded-lg sm:rounded-xl bg-background/20 backdrop-blur-xl border border-border/30"
          >
            <TrendingUp className="h-4 w-4 sm:h-6 sm:w-6 text-primary" />
          </motion.div>
        </>
      }
    >
      <motion.div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 text-center text-foreground">
        <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="space-y-4"
            >
            <Badge className="px-5 py-2 text-sm font-semibold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors inline-flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>About Inside Karachi</span>
            </Badge>

            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold tracking-tight leading-tight">
              Discover <span className="gradient-text-primary">Karachi</span>
            </h1>

            <p className="text-base sm:text-lg md:text-lg lg:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              We hand‑pick and verify local favourites so you can find great
              spots fast — a simple, trusted guide for residents, visitors,
              and businesses across Karachi.
            </p>

            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.36 }} className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-6 sm:mb-8 pt-3">
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  asChild
                  size="lg"
                  className="px-8 py-4 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg hover:shadow-xl transition-all duration-300 group"
                >
                  <Link href="/listings" className="inline-flex items-center">
                    <span className="mr-2">Explore Karachi</span>
                    <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform duration-200" />
                  </Link>
                </Button>
              </motion.div>

              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="px-8 py-4 border-border/50 hover:bg-primary/5 dark:hover:bg-primary/10 font-semibold"
                >
                  <Link href="/get-listed" className="inline-flex items-center">
                    <Store className="h-5 w-5 mr-2" />
                    Get Listed
                  </Link>
                </Button>
              </motion.div>
            </motion.div>
          </motion.div>

          {/* Our Promise - centered 3-up grid */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="mt-10"
          >
            <h3 className="text-sm font-medium text-muted-foreground mb-4 inline-flex items-center justify-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Our Promise
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { icon: Heart, title: "Local First", description: "Built by Karachi, for Karachi" },
                { icon: Shield, title: "Trusted Guide", description: "Curated experiences you can rely on" },
                { icon: MapPin, title: "Always Authentic", description: "Verified listings and genuine reviews" },
              ].map((item, idx) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 + idx * 0.08 }}
                  whileHover={{ scale: 1.03 }}
                  className="relative group bg-background/80 backdrop-blur-xl border border-border/30 rounded-xl p-4 text-center overflow-hidden transition-all duration-300 shadow-none hover:shadow-premium hover:shadow-premium-lg"
                >
                  <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-30 transition-opacity duration-300 bg-gradient-to-br from-primary/10 to-transparent" />
                  <div className="relative flex flex-col items-center gap-2">
                    <div className="p-2 rounded-md bg-primary/10 border border-primary/20 inline-flex">
                      <item.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="text-sm font-semibold text-foreground">{item.title}</div>
                    <div className="text-xs text-muted-foreground">{item.description}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </motion.div>
    </HeroSection>
  );
}

export default AboutHero;
