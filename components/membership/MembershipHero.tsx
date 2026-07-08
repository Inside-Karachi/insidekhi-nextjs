"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import HeroSection from "@/components/ui/HeroSection";
import HeroPlaceholder from "@/components/ui/HeroPlaceholder";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Users,
  TrendingUp,
  Award,
  ArrowRight,
  Globe,
  Building,
  Target,
  Zap,
  Heart,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function MembershipHero() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Stats - matching homepage pattern with proper color schemes
  const stats = [
    {
      icon: Users,
      label: "Active Members",
      value: "500+",
      colors: {
        bg: "from-blue-500/20 via-blue-500/10 to-blue-500/5",
        border: "border-blue-500/30",
        icon: "text-blue-500",
        accent: "bg-blue-500",
        glow: "hover:shadow-xl hover:shadow-blue-500/25",
      },
    },
    {
      icon: TrendingUp,
      label: "Business Growth",
      value: "85%",
      colors: {
        bg: "from-emerald-500/20 via-emerald-500/10 to-emerald-500/5",
        border: "border-emerald-500/30",
        icon: "text-emerald-500",
        accent: "bg-emerald-500",
        glow: "hover:shadow-xl hover:shadow-emerald-500/25",
      },
    },
    {
      icon: Globe,
      label: "Monthly Reach",
      value: "12M+",
      colors: {
        bg: "from-purple-500/20 via-purple-500/10 to-purple-500/5",
        border: "border-purple-500/30",
        icon: "text-purple-500",
        accent: "bg-purple-500",
        glow: "hover:shadow-xl hover:shadow-purple-500/25",
      },
    },
    {
      icon: Award,
      label: "Premium Access",
      value: "Elite",
      colors: {
        bg: "from-amber-500/20 via-amber-500/10 to-amber-500/5",
        border: "border-amber-500/30",
        icon: "text-amber-500",
        accent: "bg-amber-500",
        glow: "hover:shadow-xl hover:shadow-amber-500/25",
      },
    },
  ];

  const scrollToForm = () => {
    const formSection = document.getElementById("membership-form");
    if (formSection) {
      formSection.scrollIntoView({ behavior: "smooth" });
    }
  };

  const scrollToBenefits = () => {
    const benefitsSection = document.getElementById("membership-benefits");
    if (benefitsSection) {
      benefitsSection.scrollIntoView({ behavior: "smooth" });
    }
  };

  if (!mounted) return <HeroPlaceholder variant="membership" />;

  return (
    <HeroSection
      floating={
        <>
          <motion.div
            animate={{ y: [0, -20, 0], rotate: [0, 5, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-16 sm:top-20 left-4 sm:left-20 p-2 sm:p-3 rounded-lg sm:rounded-xl bg-background/20 backdrop-blur-xl border border-border/30"
          >
            <Heart className="h-4 w-4 sm:h-6 sm:w-6 text-primary" />
          </motion.div>

          <motion.div
            animate={{ y: [0, 15, 0], rotate: [0, -5, 0] }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 2,
            }}
            className="absolute top-24 sm:top-32 right-4 sm:right-32 p-2 sm:p-3 rounded-lg sm:rounded-xl bg-background/20 backdrop-blur-xl border border-border/30"
          >
            <Building className="h-4 w-4 sm:h-6 sm:w-6 text-primary" />
          </motion.div>
        </>
      }
    >
      <motion.div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Badge - matching homepage style */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
          className="mb-8"
        >
          <Badge className="px-6 py-2 text-sm font-semibold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors">
            <Sparkles className="h-4 w-4 mr-2" />
            Premium Membership Program
          </Badge>
        </motion.div>

        {/* Hero Heading - matching homepage typography */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.4, 0, 0.2, 1] }}
          className="space-y-4 sm:space-y-6 mb-8 sm:mb-12"
        >
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold tracking-tight">
            Elevate Your <span className="gradient-text-primary">Business</span>
            <span className="block">in Karachi</span>
          </h1>
          <p className="max-w-3xl mx-auto text-sm sm:text-base md:text-lg lg:text-xl text-muted-foreground leading-relaxed px-4 sm:px-0">
            Join Inside Karachi&apos;s exclusive membership program. Gain
            unprecedented exposure, access vital resources, and make meaningful
            connections in Pakistan&apos;s largest business hub.
          </p>
        </motion.div>

        {/* CTA Buttons - matching homepage style */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4, ease: [0.4, 0, 0.2, 1] }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12 sm:mb-16"
        >
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              size="lg"
              onClick={scrollToForm}
              className="px-8 py-4 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg hover:shadow-xl transition-all duration-300 group"
            >
              <span className="mr-2">Join Membership</span>
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform duration-200" />
            </Button>
          </motion.div>

          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              size="lg"
              variant="outline"
              onClick={scrollToBenefits}
              className="px-8 py-4 border-border/50 hover:bg-primary/5 dark:hover:bg-primary/10 font-semibold"
            >
              <Eye className="h-5 w-5 mr-2" />
              View Benefits
            </Button>
          </motion.div>
        </motion.div>

        {/* Stats Section - matching homepage glassmorphism style */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6, ease: [0.4, 0, 0.2, 1] }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 max-w-4xl mx-auto"
        >
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              whileHover={{
                scale: 1.02,
                y: -4,
                transition: { duration: 0.2, ease: "easeOut" },
              }}
              transition={{
                delay: 0.8 + index * 0.1,
                duration: 0.6,
                ease: [0.4, 0, 0.2, 1],
              }}
              className="group"
            >
              <div
                className={cn(
                  "relative overflow-hidden rounded-xl sm:rounded-2xl p-4 sm:p-6 group cursor-pointer",
                  "backdrop-blur-xl border transition-all duration-500",
                  `bg-gradient-to-br ${stat.colors.bg}`,
                  stat.colors.border,
                  stat.colors.glow,
                  "transform-gpu",
                )}
              >
                {/* Border glow */}
                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                  <div
                    className={cn(
                      "absolute inset-0 rounded-2xl opacity-30 blur-md",
                      stat.colors.accent,
                    )}
                  />
                  <div
                    className={cn(
                      "absolute inset-0 rounded-2xl opacity-10 blur-lg",
                      stat.colors.accent,
                    )}
                  />
                </div>

                {/* Animated accent line */}
                <div
                  className={cn(
                    "absolute top-0 left-0 h-1 w-0 group-hover:w-full transition-all duration-700 ease-out",
                    stat.colors.accent,
                  )}
                />

                <div className="relative z-10">
                  <div className="flex flex-col items-center space-y-3">
                    {/* Icon container */}
                    <div
                      className={cn(
                        "relative p-2 md:p-3 rounded-xl transition-all duration-500",
                        "group-hover:scale-110 group-hover:rotate-6 transform-gpu",
                        `bg-gradient-to-br ${stat.colors.bg}`,
                        "border border-white/20 dark:border-white/10",
                        "shadow-lg group-hover:shadow-xl",
                      )}
                    >
                      <div
                        className={cn(
                          "h-5 w-5 md:h-6 md:w-6",
                          stat.colors.icon,
                        )}
                      >
                        <stat.icon className="h-full w-full" />
                      </div>
                    </div>

                    <div className="text-center">
                      <div className="text-xl sm:text-2xl font-bold text-foreground">
                        {stat.value}
                      </div>
                      <div className="text-xs sm:text-sm text-muted-foreground">
                        {stat.label}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Trust Indicators - refined styling */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.0 }}
          className="flex flex-wrap items-center justify-center gap-6 mt-12 text-muted-foreground"
        >
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            <span className="font-medium">Business Growth Focus</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            <span className="font-medium">Premium Network</span>
          </div>
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-primary" />
            <span className="font-medium">Exclusive Benefits</span>
          </div>
        </motion.div>
      </motion.div>
    </HeroSection>
  );
}
