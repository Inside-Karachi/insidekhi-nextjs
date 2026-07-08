"use client";

import React from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Users,
  Globe,
  Star,
  ArrowRight,
  Smile,
  BarChart2,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function AboutBody() {
  const mission = [
    {
      icon: Star,
      title: "Curated Quality",
      text: "We prioritise trusted places and services — quality listings that help people make better choices.",
      colors: {
        bg: "from-amber-500/20 via-amber-500/10 to-amber-500/5",
        border: "border-amber-500/30",
        icon: "text-amber-500",
        accent: "bg-amber-500",
        glow: "hover:shadow-xl hover:shadow-amber-500/25",
      },
    },
    {
      icon: Users,
      title: "Community & Trust",
      text: "We foster connections between people and local businesses, building trust through verified information and honest reviews.",
      colors: {
        bg: "from-blue-500/20 via-blue-500/10 to-blue-500/5",
        border: "border-blue-500/30",
        icon: "text-blue-500",
        accent: "bg-blue-500",
        glow: "hover:shadow-xl hover:shadow-blue-500/25",
      },
    },
    {
      icon: Globe,
      title: "Local Focus",
      text: "Everything we build is shaped by Karachi — its neighbourhoods, rhythms and local needs.",
      colors: {
        bg: "from-emerald-500/20 via-emerald-500/10 to-emerald-500/5",
        border: "border-emerald-500/30",
        icon: "text-emerald-500",
        accent: "bg-emerald-500",
        glow: "hover:shadow-xl hover:shadow-emerald-500/25",
      },
    },
  ];

  const stats = [
    {
      icon: BarChart2,
      label: "Monthly Visitors",
      value: "12k+",
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
      label: "Verified Businesses",
      value: "2.4k+",
      colors: {
        bg: "from-emerald-500/20 via-emerald-500/10 to-emerald-500/5",
        border: "border-emerald-500/30",
        icon: "text-emerald-500",
        accent: "bg-emerald-500",
        glow: "hover:shadow-xl hover:shadow-emerald-500/25",
      },
    },
    {
      icon: Smile,
      label: "Satisfaction Rating",
      value: "95%",
      colors: {
        bg: "from-purple-500/20 via-purple-500/10 to-purple-500/5",
        border: "border-purple-500/30",
        icon: "text-purple-500",
        accent: "bg-purple-500",
        glow: "hover:shadow-xl hover:shadow-purple-500/25",
      },
    },
    {
      icon: Check,
      label: "Average Approval",
      value: "24hrs",
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
    <>
      <section className="relative border-t border-muted/10 py-12 lg:py-16">
        <div className="hidden sm:block pointer-events-none absolute -top-8 -right-16 w-72 h-72 rounded-full bg-gradient-to-br from-primary/20 to-transparent blur-3xl opacity-40"></div>
        <div className="hidden sm:block pointer-events-none absolute -bottom-12 -left-16 w-56 h-56 rounded-full bg-gradient-to-br from-secondary/10 to-transparent blur-3xl opacity-30"></div>

        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{ duration: 0.6 }}
            className="max-w-4xl mx-auto text-center space-y-16"
          >
            <div className="space-y-6">
              <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold tracking-tight">
                Our <span className="gradient-text-primary">mission</span>
              </h2>
              <p className="max-w-3xl mx-auto text-sm sm:text-base md:text-lg text-muted-foreground leading-relaxed px-4 sm:px-0">
                Karachi&apos;s most trusted local guide, connecting residents
                and visitors with great places and helping businesses grow.
              </p>
            </div>

            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.15 }}
              transition={{ staggerChildren: 0.08 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-6"
            >
              {mission.map((item, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.15 }}
                  transition={{ duration: 0.45, delay: idx * 0.06 }}
                  className={cn(
                    "group relative overflow-hidden rounded-xl p-6 text-left",
                    "backdrop-blur-xl border transition-all duration-500",
                    `bg-gradient-to-br ${item.colors.bg}`,
                    item.colors.border,
                    item.colors.glow,
                  )}
                >
                  <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                    <div
                      className={cn(
                        "absolute inset-0 rounded-xl opacity-30 blur-md",
                        item.colors.accent,
                      )}
                    />
                  </div>
                  <div
                    className={cn(
                      "absolute top-0 left-0 h-1 w-0 group-hover:w-full transition-all duration-700 ease-out",
                      item.colors.accent,
                    )}
                  />

                  <div className="relative z-10 space-y-6">
                    <div
                      className={cn(
                        "relative w-12 h-12 rounded-xl transition-all duration-500",
                        "group-hover:scale-110 group-hover:rotate-6",
                        `bg-gradient-to-br ${item.colors.bg}`,
                        "border border-white/20 dark:border-white/10",
                        "shadow-lg group-hover:shadow-xl flex items-center justify-center",
                      )}
                    >
                      <item.icon className={cn("w-6 h-6", item.colors.icon)} />
                    </div>
                    <div className="space-y-3">
                      <h3 className="text-base font-semibold text-foreground">
                        {item.title}
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {item.text}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      <section className="bg-muted/4">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
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
                    "relative overflow-hidden rounded-xl p-4 sm:p-6",
                    "backdrop-blur-xl border transition-all duration-500",
                    `bg-gradient-to-br ${stat.colors.bg}`,
                    stat.colors.border,
                    stat.colors.glow,
                  )}
                >
                  <div
                    className={cn(
                      "absolute top-0 left-0 h-1 w-0 group-hover:w-full transition-all duration-700 ease-out",
                      stat.colors.accent,
                    )}
                  />
                  <div className="relative z-10 flex flex-col items-center space-y-3">
                    <div
                      className={cn(
                        "relative p-2 md:p-3 rounded-xl transition-all duration-500",
                        "group-hover:scale-110 group-hover:rotate-6",
                        `bg-gradient-to-br ${stat.colors.bg}`,
                        "border border-white/20 dark:border-white/10",
                        "shadow-lg group-hover:shadow-xl",
                      )}
                    >
                      <stat.icon
                        className={cn(
                          "h-5 w-5 md:h-6 md:w-6",
                          stat.colors.icon,
                        )}
                      />
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
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="border-t border-muted/10 py-16 lg:py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.12 }}
            transition={{ duration: 0.6 }}
            className="max-w-4xl mx-auto"
          >
            <div className="text-center space-y-6 mb-16">
              <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold tracking-tight">
                Ready to{" "}
                <span className="gradient-text-primary">
                  grow your business
                </span>
                ?
              </h2>
              <p className="text-xl text-muted-foreground leading-relaxed">
                Join businesses across Karachi. Pick the option that suits your
                needs.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="group relative">
                {/* Background (matching Listing address style) */}
                <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <motion.div
                  whileHover={{ y: -6 }}
                  transition={{ type: "spring", stiffness: 220, damping: 18 }}
                  className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-transparent to-primary/10 backdrop-blur-sm border-2 md:border rounded-3xl p-8 shadow-premium hover:shadow-premium-lg transition-all duration-300"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 opacity-40" />
                  <div className="absolute top-4 right-4 w-10 h-10 bg-gradient-to-br from-primary/10 to-transparent rounded-full blur-lg" />
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <h3 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-foreground">
                        Get Your Business Listed
                      </h3>
                      <p className="text-muted-foreground">
                        Start with our free listing and reach thousands of
                        potential customers in Karachi.
                      </p>
                    </div>

                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-center gap-3">
                        <Check className="w-4 h-4 text-primary" />
                        <span>Free basic listing</span>
                      </li>
                      <li className="flex items-center gap-3">
                        <Check className="w-4 h-4 text-primary" />
                        <span>Business verification</span>
                      </li>
                      <li className="flex items-center gap-3">
                        <Check className="w-4 h-4 text-primary" />
                        <span>Customer reviews</span>
                      </li>
                    </ul>

                    <Link
                      href="/get-listed"
                      aria-label="Get listed on Inside Karachi"
                      className="group/btn inline-flex items-center gap-2 w-full justify-center rounded-xl bg-gradient-to-r from-primary to-primary px-6 py-4 text-base font-semibold text-white shadow-premium hover:shadow-premium-lg transform-gpu hover:-translate-y-1 motion-safe:transition-transform transition-all duration-300"
                    >
                      Get Listed Now
                      <ArrowRight
                        size={18}
                        className="group-hover/btn:translate-x-1 transition-transform"
                      />
                    </Link>
                  </div>
                </motion.div>
              </div>

              <div className="group relative">
                <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <motion.div
                  whileHover={{ y: -6 }}
                  transition={{ type: "spring", stiffness: 220, damping: 18 }}
                  className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-transparent to-primary/10 backdrop-blur-sm border-2 md:border rounded-3xl p-8 shadow-premium hover:shadow-premium-lg transform transition-all duration-300"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 opacity-30 dark:opacity-50" />
                  <div className="absolute top-4 right-4 w-10 h-10 bg-gradient-to-br from-primary/10 to-transparent rounded-full blur-lg" />
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-foreground">
                          Premium Membership
                        </h3>
                      </div>
                      <p className="text-muted-foreground">
                        Unlock exclusive benefits and accelerate your business
                        growth with our membership program.
                      </p>
                    </div>

                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-center gap-3">
                        <Check className="w-4 h-4 text-primary" />
                        <span>Featured placement</span>
                      </li>
                      <li className="flex items-center gap-3">
                        <Check className="w-4 h-4 text-primary" />
                        <span>Priority support</span>
                      </li>
                      <li className="flex items-center gap-3">
                        <Check className="w-4 h-4 text-primary" />
                        <span>Analytics dashboard</span>
                      </li>
                    </ul>

                    <Link
                      href="/membership"
                      aria-label="Join membership"
                      className="group/btn inline-flex items-center gap-2 w-full justify-center rounded-xl bg-gradient-to-r from-primary to-primary px-6 py-4 text-base font-semibold text-white shadow-premium hover:shadow-premium-lg transform-gpu hover:-translate-y-1 motion-safe:transition-transform transition-all duration-300"
                    >
                      Join Membership
                      <ArrowRight
                        size={18}
                        className="group-hover/btn:translate-x-1 transition-transform"
                      />
                    </Link>
                  </div>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </>
  );
}
