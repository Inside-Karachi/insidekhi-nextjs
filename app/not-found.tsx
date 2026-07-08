"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Home,
  Search,
  ArrowLeft,
  MapPin,
  Compass,
  Heart,
  Star,
  Coffee,
  Camera,
  Calendar,
  Store,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function NotFound() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        data-nextjs-not-found
        className="h-screen bg-background relative overflow-hidden flex flex-col"
      >
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  // Floating decorative elements
  const floatingElements = [
    { icon: Heart, delay: 0, position: "top-16 left-4 sm:left-20" },
    { icon: Star, delay: 2, position: "top-24 right-4 sm:right-32" },
    { icon: Coffee, delay: 4, position: "bottom-32 left-8 sm:left-16" },
    { icon: Camera, delay: 1, position: "bottom-24 right-8 sm:right-16" },
    { icon: Calendar, delay: 3, position: "top-1/2 left-4 sm:left-12" },
    { icon: Store, delay: 5, position: "top-1/3 right-4 sm:right-12" },
  ];

  return (
    <div
      data-nextjs-not-found
      className="h-screen bg-background relative overflow-hidden flex flex-col"
    >
      {/* Background gradient */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-primary/10"
        aria-hidden
      />

      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 bg-[linear-gradient(rgba(var(--primary-rgb),0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(var(--primary-rgb),0.02)_1px,transparent_1px)] bg-[size:50px_50px]"
        aria-hidden
      />

      {/* Decorative orbs */}
      <motion.div
        animate={{
          y: [0, 50, 0],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="hidden sm:block absolute -top-16 sm:-top-32 -right-16 sm:-right-32 w-48 h-48 sm:w-96 sm:h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none"
        aria-hidden
      />

      <motion.div
        animate={{
          y: [0, -30, 0],
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 2,
        }}
        className="hidden sm:block absolute -bottom-16 sm:-bottom-32 -left-16 sm:-left-32 w-48 h-48 sm:w-96 sm:h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none"
        aria-hidden
      />

      {/* Floating decorative elements */}
      {floatingElements.map((element, index) => (
        <motion.div
          key={index}
          animate={{
            y: [0, -20, 0],
            rotate: [
              0,
              element.icon === Heart || element.icon === Star ? 4 : -4,
              0,
            ],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 6 + index,
            repeat: Infinity,
            ease: "easeInOut",
            delay: element.delay,
          }}
          className={cn(
            "absolute p-2 sm:p-3 rounded-lg sm:rounded-xl bg-background/20 backdrop-blur-xl border border-border/30",
            element.position,
          )}
        >
          <element.icon className="h-4 w-4 sm:h-6 sm:w-6 text-primary" />
        </motion.div>
      ))}

      {/* Main content - flex-1 ensures it takes remaining space */}
      <motion.div
        className="relative z-10 flex-1 flex flex-col justify-center container mx-auto px-4 sm:px-6 lg:px-8 text-center text-foreground"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        <div className="max-w-4xl mx-auto space-y-8">
          {/* 404 Number with Animation */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{
              duration: 0.8,
              type: "spring",
              stiffness: 100,
              damping: 15,
            }}
            className="relative"
          >
            <motion.h1
              className="text-8xl sm:text-9xl md:text-[12rem] lg:text-[14rem] font-bold tracking-tighter leading-none"
              animate={{
                backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
              }}
              transition={{
                duration: 8,
                repeat: Infinity,
                ease: "linear",
              }}
              style={{
                background:
                  "linear-gradient(45deg, hsl(var(--primary)), hsl(var(--primary)/0.8), hsl(var(--primary)), hsl(var(--primary)/0.6))",
                backgroundSize: "400% 400%",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              404
            </motion.h1>

            {/* Animated background glow */}
            <motion.div
              className="absolute inset-0 -z-10"
              animate={{
                opacity: [0.1, 0.3, 0.1],
                scale: [1, 1.05, 1],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <div className="w-full h-full bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 rounded-full blur-3xl" />
            </motion.div>
          </motion.div>

          {/* Error Message */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="space-y-4"
          >
            <Badge className="px-5 py-2 text-sm font-semibold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors inline-flex items-center gap-2 mx-auto">
              <Compass className="h-4 w-4 text-primary" />
              <span>Page Not Found</span>
            </Badge>

            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight">
              Oops! This page got lost in{" "}
              <span className="gradient-text-primary">Karachi</span>
            </h2>

            <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              The page you&apos;re looking for seems to have wandered off into
              the bustling streets of Karachi. Don&apos;t worry, let&apos;s get
              you back to exploring the city!
            </p>
          </motion.div>

          {/* Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4"
          >
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                asChild
                size="lg"
                className="px-8 py-4 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg hover:shadow-xl transition-all duration-300 group"
              >
                <Link href="/" className="inline-flex items-center">
                  <Home className="h-5 w-5 mr-2 group-hover:scale-110 transition-transform duration-200" />
                  <span>Back to Home</span>
                </Link>
              </Button>
            </motion.div>

            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="px-8 py-4 border-border/50 hover:bg-primary/5 dark:hover:bg-primary/10 font-semibold group"
              >
                <Link href="/listings" className="inline-flex items-center">
                  <Search className="h-5 w-5 mr-2 group-hover:rotate-12 transition-transform duration-200" />
                  <span>Explore Listings</span>
                </Link>
              </Button>
            </motion.div>

            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                size="lg"
                variant="ghost"
                className="px-8 py-4 hover:bg-accent/50 font-semibold group"
                onClick={() => window.history.back()}
              >
                <ArrowLeft className="h-5 w-5 mr-2 group-hover:-translate-x-1 transition-transform duration-200" />
                <span>Go Back</span>
              </Button>
            </motion.div>
          </motion.div>

          {/* Popular Destinations */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="pt-8"
          >
            <h3 className="text-lg sm:text-xl font-semibold mb-6 text-muted-foreground">
              Or explore these popular spots in Karachi:
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-w-2xl mx-auto">
              {[
                {
                  name: "Restaurants",
                  href: "/listings?category=eat-drink",
                  icon: Coffee,
                },
                { name: "Events", href: "/events", icon: Calendar },
                {
                  name: "Hotels",
                  href: "/listings?category=where-to-stay",
                  icon: MapPin,
                },
                {
                  name: "Shopping",
                  href: "/listings?category=shopping",
                  icon: Store,
                },
              ].map((destination, index) => (
                <motion.div
                  key={destination.name}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{
                    duration: 0.5,
                    delay: 0.8 + index * 0.1,
                    type: "spring",
                    stiffness: 200,
                  }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Link
                    href={destination.href}
                    className="group block p-4 rounded-lg glass-card-hover text-center transition-all duration-300"
                  >
                    <destination.icon className="h-6 w-6 mx-auto mb-2 text-primary group-hover:scale-110 transition-transform duration-200" />
                    <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors duration-200">
                      {destination.name}
                    </span>
                  </Link>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Fun Message */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 1.2 }}
            className="pt-8"
          >
            <p className="text-sm text-muted-foreground italic">
              &ldquo;In Karachi, even the 404s lead to great discoveries!&rdquo;
              ✨
            </p>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
