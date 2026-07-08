"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

// Define the structure of the links object we'll receive
type LinkItem = { name: string; href?: string; slug?: string };
interface FooterLinks {
  explore: LinkItem[];
  forBusinesses: LinkItem[];
  company: LinkItem[];
}

interface FooterLinkTabsProps {
  links: FooterLinks;
}

// Define the keys for our tabs for type safety
type TabKey = keyof FooterLinks;

export function FooterLinkTabs({ links }: FooterLinkTabsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("explore");

  const tabKeys: TabKey[] = ["explore", "forBusinesses", "company"];
  const tabNames: { [key in TabKey]: string } = {
    explore: "Explore",
    forBusinesses: "For Businesses",
    company: "Company",
  };

  const linkVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        staggerChildren: 0.1,
      },
    },
    exit: {
      opacity: 0,
      y: -15,
      transition: {
        duration: 0.4,
      },
    },
  };

  return (
    <div className="w-full space-y-4 sm:space-y-6 max-w-sm sm:max-w-md mx-auto px-2 sm:px-4">
      {/* Revolutionary Floating Tab System */}
      <div className="relative">
        {/* Ambient glow system */}
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/20 to-primary/10 rounded-3xl blur-2xl opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/20 via-transparent to-background/20 rounded-3xl" />

        {/* Glassmorphism container - Mobile Optimized */}
        <div className="relative flex bg-background/20 dark:bg-background/10 backdrop-blur-xl border border-border/30 dark:border-white/10 rounded-2xl p-1.5 shadow-lg">
          {/* Floating background indicator */}
          <motion.div
            className="absolute top-1.5 bottom-1.5 bg-gradient-to-r from-primary/90 via-primary to-primary/90 rounded-xl shadow-lg"
            style={{
              left: `${
                (tabKeys.indexOf(activeTab) * 100) / tabKeys.length + 0.5
              }%`,
              width: `${100 / tabKeys.length - 1}%`,
            }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
          />

          {tabKeys.map((tab) => (
            <motion.button
              key={tab}
              onClick={() => setActiveTab(tab)}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "relative py-2.5 px-3 text-xs sm:text-sm font-semibold transition-all duration-300 rounded-xl flex-1 z-10 group min-h-[40px] flex items-center justify-center",
                activeTab === tab
                  ? "text-white shadow-md"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {/* Hover glow effect */}
              <motion.div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/20 to-primary/10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

              {/* Tab text - Mobile optimized */}
              <span className="relative z-10 tracking-wide text-center leading-tight">
                {tabNames[tab]}
              </span>

              {/* Active state glow */}
              {activeTab === tab && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="absolute inset-0 bg-primary/20 rounded-xl blur-md"
                  transition={{ duration: 0.4, ease: "easeOut" }}
                />
              )}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Revolutionary Content Cards */}
      <div className="relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            variants={linkVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="space-y-4 sm:space-y-6"
          >
            {/* Mobile-Optimized Grid */}
            <motion.div className="grid grid-cols-2 gap-3 sm:gap-4">
              {links[activeTab].map((link) => {
                const href =
                  "href" in link ? link.href : `/listings/${link.slug}`;
                return (
                  <div key={link.name}>
                    <Link
                      href={href || "#"}
                      className="flex aspect-[2.5/1] sm:aspect-[3/2] items-center justify-center text-center rounded-2xl bg-background/80 backdrop-blur-sm border border-border/50 hover:bg-primary/5 dark:hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all duration-200 text-xs sm:text-sm font-semibold text-muted-foreground px-2 sm:px-4 tracking-wide"
                    >
                      {link.name}
                    </Link>
                  </div>
                );
              })}
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
