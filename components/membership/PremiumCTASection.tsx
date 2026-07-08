"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  Users,
  TrendingUp,
  Globe,
  Sparkles,
  Award,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function PremiumCTASection() {
  const scrollToForm = () => {
    const formSection = document.getElementById("membership-form");
    if (formSection) {
      formSection.scrollIntoView({ behavior: "smooth" });
    }
  };

  const stats = [
    {
      icon: Users,
      value: "500+",
      label: "Business Partners",
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
      value: "85%",
      label: "Growth Rate",
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
      value: "12M+",
      label: "Monthly Reach",
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
      value: "Premium",
      label: "Network Access",
      colors: {
        bg: "from-amber-500/20 via-amber-500/10 to-amber-500/5",
        border: "border-amber-500/30",
        icon: "text-amber-500",
        accent: "bg-amber-500",
        glow: "hover:shadow-xl hover:shadow-amber-500/25",
      },
    },
  ];

  return (
    <section className="py-16 lg:py-24 pb-32 lg:pb-40 relative overflow-hidden bg-gradient-to-b from-background via-primary/[0.02] to-background">
      {/* Subtle Top Border */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      {/* Minimal Background Elements - different from footer */}
      <div className="absolute top-1/4 right-10 w-32 h-32 bg-primary/5 rounded-full blur-2xl" />
      <div className="absolute bottom-1/4 left-10 w-40 h-40 bg-primary/3 rounded-full blur-3xl" />

      {/* Subtle Grid Pattern - lighter than footer */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(var(--primary-rgb),0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(var(--primary-rgb),0.01)_1px,transparent_1px)] bg-[size:60px_60px]" />

      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center space-y-8 lg:space-y-12">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="space-y-6"
          >
            <Badge className="px-6 py-2 text-sm font-semibold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors">
              <Sparkles className="w-4 h-4 mr-2" />
              Start Your Journey
            </Badge>

            <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold tracking-tight">
              Ready to Transform{" "}
              <span className="gradient-text-primary">Your Business?</span>
            </h2>

            <p className="max-w-3xl mx-auto text-sm sm:text-base md:text-lg text-muted-foreground leading-relaxed px-4 sm:px-0">
              Join hundreds of successful businesses that have already chosen
              Inside Karachi as their growth partner. Your premium membership
              journey starts today.
            </p>
          </motion.div>

          {/* Stats Grid */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 max-w-4xl mx-auto"
          >
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20, scale: 0.9 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.1 * index }}
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

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="flex justify-center items-center"
          >
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                size="lg"
                onClick={scrollToForm}
                className="px-8 py-4 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg hover:shadow-xl transition-all duration-300 group"
              >
                <span className="mr-2">Apply for Membership</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-200" />
              </Button>
            </motion.div>
          </motion.div>

          {/* Trust Message */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 lg:gap-8 text-muted-foreground"
          >
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              <span className="font-medium">Quick Setup</span>
            </div>
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-primary" />
              <span className="font-medium">Premium Support</span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              <span className="font-medium">Guaranteed Growth</span>
            </div>
          </motion.div>

          {/* Bottom Note */}
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="text-muted-foreground text-sm font-medium"
          >
            Join the premier business network in Karachi. No long-term
            contracts, cancel anytime.
          </motion.p>
        </div>
      </div>
    </section>
  );
}
