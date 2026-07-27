"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Home,
  RefreshCw,
  Clock,
  AlertCircle,
  Zap,
  Cpu,
  Wrench,
  Hammer,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MaintenancePageProps {
  message?: string;
  estimatedEnd?: string | null;
}

export function MaintenancePage({
  message = "We are performing scheduled maintenance to improve your experience. We'll be back shortly!",
  estimatedEnd = null,
}: MaintenancePageProps) {
  const [mounted, setMounted] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<string>("");

  useEffect(() => {
    setMounted(true);

    // Poll the public system config for maintenance.enabled and redirect
    // as soon as an admin disables maintenance mode (Supabase Realtime is
    // no longer available, so this replaces the old postgres_changes sub).
    const POLL_MS = 30000;

    const checkMaintenanceStatus = async () => {
      try {
        const res = await fetch("/api/system/config", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const newValue = data?.config?.["maintenance.enabled"];
        const enabled =
          newValue === true ||
          newValue === "true" ||
          (typeof newValue === "string" && newValue.toLowerCase() === "true");

        if (!enabled) {
          // Maintenance mode disabled - redirect to home
          window.location.href = "/";
        }
      } catch (error) {
        console.error("Error polling maintenance status:", error);
      }
    };

    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      void checkMaintenanceStatus();
    }, POLL_MS);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!estimatedEnd) {
      return;
    }

    const calculateTimeRemaining = () => {
      try {
        const now = new Date().getTime();
        const endDate = new Date(estimatedEnd);
        const end = endDate.getTime();
        const distance = end - now;

        if (distance < 0) {
          setTimeRemaining("Any moment now");
          return;
        }

        const hours = Math.floor(distance / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));

        if (hours > 0) {
          setTimeRemaining(`~${hours}h ${minutes}m`);
        } else {
          setTimeRemaining(`~${minutes}m`);
        }
      } catch (error) {
        console.error("Error calculating maintenance time:", error);
      }
    };

    calculateTimeRemaining();
    const interval = setInterval(calculateTimeRemaining, 60000);

    return () => clearInterval(interval);
  }, [estimatedEnd]);

  if (!mounted) {
    return (
      <div
        data-maintenance
        className="h-screen bg-background relative overflow-hidden flex flex-col"
      >
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  const floatingIcons = [
    { icon: Zap, delay: 0, position: "top-16 left-4 sm:left-20" },
    { icon: Cpu, delay: 2, position: "top-24 right-4 sm:right-32" },
    { icon: Wrench, delay: 4, position: "bottom-32 left-8 sm:left-16" },
    { icon: Clock, delay: 1, position: "bottom-24 right-8 sm:right-16" },
    { icon: Hammer, delay: 3, position: "top-1/2 left-4 sm:left-12" },
    { icon: AlertCircle, delay: 5, position: "top-1/3 right-4 sm:right-12" },
  ];

  return (
    <div
      data-maintenance
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
      {floatingIcons.map((element, index) => (
        <motion.div
          key={index}
          animate={{
            y: [0, -20, 0],
            rotate: [
              0,
              element.icon === Zap || element.icon === AlertCircle ? 4 : -4,
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
          {/* Maintenance Icon */}
          <motion.div
            className="mb-8 flex justify-center"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{
              type: "spring",
              stiffness: 200,
              damping: 15,
              delay: 0.2,
            }}
          >
            <div className="relative">
              <motion.div
                className="absolute inset-0 bg-primary/20 rounded-full blur-xl"
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.5, 0.8, 0.5],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
              <div className="relative bg-primary/10 p-6 rounded-full">
                <AlertCircle className="h-16 w-16 sm:h-20 sm:w-20 text-primary" />
              </div>
            </div>
          </motion.div>

          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-6 flex justify-center"
          >
            <Badge
              variant="outline"
              className="border-primary/20 bg-primary/5 text-primary px-4 py-2 text-sm font-medium"
            >
              <AlertCircle className="h-4 w-4 mr-2" />
              System Under Maintenance
            </Badge>
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-foreground via-foreground to-primary bg-clip-text text-transparent"
          >
            We&apos;ll Be Right Back
          </motion.h1>

          {/* Message */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-lg sm:text-xl text-muted-foreground mb-8 leading-relaxed"
          >
            {message}
          </motion.p>

          {/* Estimated Time */}
          {estimatedEnd && timeRemaining && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="mb-8 inline-flex items-center gap-2 px-6 py-3 bg-card border border-border rounded-full"
            >
              <Clock className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium">
                Estimated downtime:{" "}
                <span className="text-primary">{timeRemaining}</span>
              </span>
            </motion.div>
          )}

          {/* Actions */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link href="/">
              <Button size="lg" className="group gap-2 px-8">
                <Home className="h-5 w-5 group-hover:scale-110 transition-transform" />
                Go to Homepage
              </Button>
            </Link>
            <Button
              size="lg"
              variant="outline"
              onClick={() => window.location.reload()}
              className="gap-2 px-8"
            >
              <RefreshCw className="h-5 w-5" />
              Refresh Page
            </Button>
          </motion.div>

          {/* Additional Info */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-12 text-sm text-muted-foreground"
          >
            Thank you for your patience. If you have urgent questions,
            <br className="hidden sm:inline" />
            please contact us at{" "}
            <a
              href="mailto:support@insidekarachi.com"
              className="text-primary hover:underline font-medium"
            >
              support@insidekarachi.com
            </a>
          </motion.p>
        </div>
      </motion.div>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="pb-8 text-center text-sm text-muted-foreground relative z-10"
      >
        <p>© {new Date().getFullYear()} Inside Karachi. All rights reserved.</p>
      </motion.div>
    </div>
  );
}
