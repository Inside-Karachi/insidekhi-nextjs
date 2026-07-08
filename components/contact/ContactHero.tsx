"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import HeroSection from "@/components/ui/HeroSection";
import HeroPlaceholder from "@/components/ui/HeroPlaceholder";
import {
  Mail,
  Phone,
  MapPin,
  ArrowRight,
  Sparkles,
  Clock,
  HeartHandshake,
  Zap,
} from "lucide-react";

export function ContactHero() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <HeroPlaceholder variant="contact" />;
  }

  return (
    <HeroSection
      floating={
        <>
          <motion.div
            animate={{ y: [0, -20, 0], rotate: [0, 5, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-16 sm:top-20 left-4 sm:left-20 p-2 sm:p-3 rounded-lg sm:rounded-xl bg-background/20 backdrop-blur-xl border border-border/30"
          >
            <HeartHandshake className="h-4 w-4 sm:h-6 sm:w-6 text-primary" />
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
            <Zap className="h-4 w-4 sm:h-6 sm:w-6 text-primary" />
          </motion.div>
        </>
      }
    >
      <motion.div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
          className="mb-8"
        >
          <Badge className="px-6 py-2 text-sm font-semibold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors">
            <Sparkles className="h-4 w-4 mr-2" />
            Let&apos;s Connect & Collaborate
          </Badge>
        </motion.div>

        {/* Hero Heading */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.4, 0, 0.2, 1] }}
          className="space-y-4 sm:space-y-6 mb-8 sm:mb-12"
        >
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold tracking-tight">
            Get in <span className="gradient-text-primary">Touch</span>
          </h1>
          <p className="max-w-3xl mx-auto text-sm sm:text-base md:text-lg lg:text-xl text-muted-foreground leading-relaxed px-4 sm:px-0">
            Have questions, ideas, or want to collaborate? We&apos;d love to
            hear from you.
            <span className="hidden sm:inline">
              {" "}
              Our team is here to help bring your vision to life.
            </span>
          </p>
        </motion.div>

        {/* Contact Methods Grid */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4, ease: [0.4, 0, 0.2, 1] }}
          className="max-w-4xl mx-auto mb-12 sm:mb-16 px-4 sm:px-0"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            <motion.div whileHover={{ scale: 1.05 }} className="group">
              <div className="relative p-4 sm:p-6 rounded-2xl bg-background/50 backdrop-blur-xl border border-border/50 hover:bg-background/70 transition-all duration-300 shadow-premium hover:shadow-premium-lg transform-gpu">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent rounded-2xl" />

                {/* Stronger colored glow overlay */}
                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-50 transition-opacity duration-500 pointer-events-none">
                  <div className="absolute inset-0 rounded-2xl opacity-50 blur-lg bg-gradient-to-br from-primary/40 to-transparent" />
                  <div className="absolute inset-0 rounded-2xl opacity-20 blur-2xl bg-gradient-to-br from-primary/20 to-transparent" />
                </div>

                {/* Animated accent line */}
                <div className="absolute top-0 left-0 h-1 w-0 group-hover:w-full transition-all duration-700 ease-out bg-primary/80 rounded-t" />

                <div className="relative text-center space-y-2 sm:space-y-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 mx-auto rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Mail className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm sm:text-base">
                      Email Us
                    </h3>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Quick Response
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div whileHover={{ scale: 1.05 }} className="group">
              <div className="relative p-4 sm:p-6 rounded-2xl bg-background/50 backdrop-blur-xl border border-border/50 hover:bg-background/70 transition-all duration-300 shadow-premium hover:shadow-premium-lg transform-gpu">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent rounded-2xl" />

                {/* Stronger colored glow overlay (appears on hover) */}
                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-50 transition-opacity duration-500 pointer-events-none">
                  <div className="absolute inset-0 rounded-2xl opacity-50 blur-lg bg-gradient-to-br from-emerald-500/40 to-transparent" />
                  <div className="absolute inset-0 rounded-2xl opacity-20 blur-2xl bg-gradient-to-br from-emerald-500/20 to-transparent" />
                </div>

                {/* Animated accent line (more visible) */}
                <div className="absolute top-0 left-0 h-1 w-0 group-hover:w-full transition-all duration-700 ease-out bg-emerald-500/80 rounded-t" />

                <div className="relative text-center space-y-2 sm:space-y-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 mx-auto rounded-xl bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
                    <Phone className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm sm:text-base">
                      Call Us
                    </h3>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Direct Line
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div whileHover={{ scale: 1.05 }} className="group">
              <div className="relative p-4 sm:p-6 rounded-2xl bg-background/50 backdrop-blur-xl border border-border/50 hover:bg-background/70 transition-all duration-300 shadow-premium hover:shadow-premium-lg transform-gpu">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent rounded-2xl" />

                {/* Stronger colored glow overlay (appears on hover) */}
                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-50 transition-opacity duration-500 pointer-events-none">
                  <div className="absolute inset-0 rounded-2xl opacity-50 blur-lg bg-gradient-to-br from-purple-500/40 to-transparent" />
                  <div className="absolute inset-0 rounded-2xl opacity-20 blur-2xl bg-gradient-to-br from-purple-500/20 to-transparent" />
                </div>

                {/* Animated accent line (more visible) */}
                <div className="absolute top-0 left-0 h-1 w-0 group-hover:w-full transition-all duration-700 ease-out bg-purple-500/80 rounded-t" />

                <div className="relative text-center space-y-2 sm:space-y-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 mx-auto rounded-xl bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
                    <MapPin className="h-5 w-5 sm:h-6 sm:w-6 text-purple-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm sm:text-base">
                      Visit Us
                    </h3>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Meet in Person
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div whileHover={{ scale: 1.05 }} className="group">
              <div className="relative p-4 sm:p-6 rounded-2xl bg-background/50 backdrop-blur-xl border border-border/50 hover:bg-background/70 transition-all duration-300 shadow-premium hover:shadow-premium-lg transform-gpu">
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent rounded-2xl" />

                {/* Stronger colored glow overlay (appears on hover) */}
                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-50 transition-opacity duration-500 pointer-events-none">
                  <div className="absolute inset-0 rounded-2xl opacity-50 blur-lg bg-gradient-to-br from-orange-500/40 to-transparent" />
                  <div className="absolute inset-0 rounded-2xl opacity-20 blur-2xl bg-gradient-to-br from-orange-500/20 to-transparent" />
                </div>

                {/* Animated accent line (appears on hover) */}
                <div className="absolute top-0 left-0 h-1 w-0 group-hover:w-full transition-all duration-700 ease-out bg-orange-500/80 rounded-t" />

                <div className="relative text-center space-y-2 sm:space-y-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 mx-auto rounded-xl bg-orange-500/10 flex items-center justify-center group-hover:bg-orange-500/20 transition-colors">
                    <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-orange-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm sm:text-base">
                      Schedule
                    </h3>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Book a Meeting
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* CTA Button */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6, ease: [0.4, 0, 0.2, 1] }}
          className="mb-12 sm:mb-16"
        >
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              size="lg"
              className="px-8 py-4 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg hover:shadow-xl transition-all duration-300 group"
              onClick={() => {
                document.getElementById("contact-form")?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                });
              }}
            >
              <span className="mr-2">Start Conversation</span>
              <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 group-hover:translate-x-1 transition-transform duration-200" />
            </Button>
          </motion.div>
        </motion.div>
      </motion.div>
    </HeroSection>
  );
}

export default ContactHero;
