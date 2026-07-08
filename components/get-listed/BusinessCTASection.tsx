"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  Store,
  Users,
  Eye,
  Zap,
  CheckCircle,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function BusinessCTASection() {
  const scrollToForm = () => {
    const formSection = document.getElementById("listing-form");
    if (formSection) {
      formSection.scrollIntoView({ behavior: "smooth" });
    }
  };

  const stats = [
    {
      icon: Store,
      value: "2,500+",
      label: "Listed Businesses",
      colors: {
        bg: "from-blue-500/20 via-blue-500/10 to-blue-500/5",
        border: "border-blue-500/30",
        icon: "text-blue-500",
        accent: "bg-blue-500",
        glow: "hover:shadow-xl hover:shadow-blue-500/25",
      },
    },
    {
      icon: Users,
      value: "95%",
      label: "Customer Reach",
      colors: {
        bg: "from-emerald-500/20 via-emerald-500/10 to-emerald-500/5",
        border: "border-emerald-500/30",
        icon: "text-emerald-500",
        accent: "bg-emerald-500",
        glow: "hover:shadow-xl hover:shadow-emerald-500/25",
      },
    },
    {
      icon: Eye,
      value: "500K+",
      label: "Monthly Views",
      colors: {
        bg: "from-purple-500/20 via-purple-500/10 to-purple-500/5",
        border: "border-purple-500/30",
        icon: "text-purple-500",
        accent: "bg-purple-500",
        glow: "hover:shadow-xl hover:shadow-purple-500/25",
      },
    },
    {
      icon: Zap,
      value: "24hrs",
      label: "Quick Approval",
      colors: {
        bg: "from-amber-500/20 via-amber-500/10 to-amber-500/5",
        border: "border-amber-500/30",
        icon: "text-amber-500",
        accent: "bg-amber-500",
        glow: "hover:shadow-xl hover:shadow-amber-500/25",
      },
    },
  ];

  const benefits = [
    "Free business listing",
    "Instant customer visibility",
    "Local SEO optimization",
    "Customer review system",
    "Analytics dashboard",
    "Social media integration",
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
              Start Growing Today
            </Badge>

            <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold tracking-tight">
              Ready to Boost{" "}
              <span className="gradient-text-primary">Your Business?</span>
            </h2>

            <p className="max-w-3xl mx-auto text-lg lg:text-xl text-muted-foreground leading-relaxed">
              Join thousands of successful businesses already thriving on Inside
              Karachi. Start reaching new customers today with our premium
              listing platform.
            </p>
          </motion.div>

          {/* Benefits List */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto mb-8"
          >
            {benefits.map((benefit, index) => (
              <motion.div
                key={benefit}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.1 * index }}
                className="flex items-center gap-3 justify-center sm:justify-start"
              >
                <CheckCircle className="w-5 h-5 text-primary flex-shrink-0" />
                <span className="text-foreground font-medium">{benefit}</span>
              </motion.div>
            ))}
          </motion.div>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12"
          >
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                size="lg"
                onClick={scrollToForm}
                className="px-8 py-4 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg hover:shadow-xl transition-all duration-300 group"
              >
                <span className="mr-2">List My Business</span>
                <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform duration-200" />
              </Button>
            </motion.div>
          </motion.div>

          {/* Stats Grid - matching membership benefits style */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto"
          >
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.8 + index * 0.1 }}
                className="group relative"
              >
                <div
                  className={cn(
                    "relative overflow-hidden rounded-xl sm:rounded-2xl p-4 sm:p-6 group cursor-pointer text-center",
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

                  <div className="relative z-10 space-y-3">
                    {/* Icon container */}
                    <div
                      className={cn(
                        "relative w-12 h-12 md:w-16 md:h-16 rounded-xl transition-all duration-500 mx-auto",
                        "group-hover:scale-110 group-hover:rotate-6 transform-gpu",
                        `bg-gradient-to-br ${stat.colors.bg}`,
                        "border border-white/20 dark:border-white/10",
                        "shadow-lg group-hover:shadow-xl flex items-center justify-center",
                      )}
                    >
                      <div
                        className={cn(
                          "w-6 h-6 md:w-8 md:h-8",
                          stat.colors.icon,
                        )}
                      >
                        <stat.icon className="w-full h-full" />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="text-2xl lg:text-3xl font-black text-foreground">
                        {stat.value}
                      </div>
                      <div className="text-sm text-muted-foreground font-medium">
                        {stat.label}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Success Story - temporarily disabled */}
          {false && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8, delay: 0.8 }}
              className="mt-12 max-w-2xl mx-auto"
            >
              <div className="p-6 rounded-2xl bg-card/50 border border-border/50 backdrop-blur-sm">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-semibold text-foreground">
                      Success Story
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Local Restaurant
                    </div>
                  </div>
                </div>
                <blockquote className="text-muted-foreground italic mt-4">
                  &quot;Listing with Inside Karachi increased our customer base
                  by 300% in just 3 months. The platform&apos;s reach is
                  incredible!&quot;
                </blockquote>
              </div>
            </motion.div>
          )}

          {/* Final CTA Text */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 1.0 }}
          >
            <p className="text-muted-foreground text-sm font-medium max-w-2xl mx-auto">
              Join the community of successful businesses. Start your journey
              with Inside Karachi today and watch your business grow beyond
              expectations.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
