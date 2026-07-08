"use client";

import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Phone, Mail, Sparkles, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ContactInfo() {
  // Contact methods with styling and information
  const contactMethods = [
    {
      icon: MapPin,
      title: "Visit Our Office",
      primary: "Office #703, Roshan Trade Center",
      secondary: "Bahadurabad, Karachi",
      action: "Get Directions",
      actionHref: "https://maps.google.com/?q=24.8785625,67.0674375",
      colors: {
        bg: "from-blue-500/20 via-blue-500/10 to-blue-500/5",
        border: "border-blue-500/30",
        icon: "text-blue-500",
        accent: "bg-blue-500",
        glow: "hover:shadow-xl hover:shadow-blue-500/25",
      },
    },
    {
      icon: Phone,
      title: "Call Us Directly",
      primary: "0328-5272244",
      secondary: "Available 9 AM - 6 PM (PKT)",
      action: "Call Now",
      actionHref: "tel:+923285272244",
      colors: {
        bg: "from-emerald-500/20 via-emerald-500/10 to-emerald-500/5",
        border: "border-emerald-500/30",
        icon: "text-emerald-500",
        accent: "bg-emerald-500",
        glow: "hover:shadow-xl hover:shadow-emerald-500/25",
      },
    },
    {
      icon: Mail,
      title: "Email Support",
      primary: "info@insidekarachi.com",
      secondary: "We respond within 24 hours",
      action: "Send Email",
      actionHref: "mailto:info@insidekarachi.com",
      colors: {
        bg: "from-purple-500/20 via-purple-500/10 to-purple-500/5",
        border: "border-purple-500/30",
        icon: "text-purple-500",
        accent: "bg-purple-500",
        glow: "hover:shadow-xl hover:shadow-purple-500/25",
      },
    },
  ];

  return (
    <section
      id="contact-details"
      className="py-12 lg:py-16 relative overflow-hidden"
    >
      {/* Background - matching homepage pattern */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-primary/10" />

      {/* Animated Background Elements */}
      <div className="absolute -top-16 sm:-top-32 -right-16 sm:-right-32 w-48 h-48 sm:w-96 sm:h-96 bg-primary/10 rounded-full blur-lg sm:blur-3xl" />
      <div className="absolute -bottom-16 sm:-bottom-32 -left-16 sm:-left-32 w-48 h-48 sm:w-96 sm:h-96 bg-primary/5 rounded-full blur-lg sm:blur-3xl" />

      {/* Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(var(--primary-rgb),0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(var(--primary-rgb),0.02)_1px,transparent_1px)] bg-[size:50px_50px]" />

      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
          className="text-center space-y-4 lg:space-y-6 mb-12 lg:mb-16"
        >
          <Badge className="px-6 py-2 text-sm font-semibold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors">
            <Sparkles className="w-4 h-4 mr-2" />
            Contact Information
          </Badge>
          <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold tracking-tight">
            Multiple Ways to{" "}
            <span className="gradient-text-primary">Reach Us</span>
          </h2>
          <p className="max-w-3xl mx-auto text-sm sm:text-base md:text-lg text-muted-foreground leading-relaxed">
            Choose the best way to connect with our team. We&apos;re here to
            help with any questions or collaboration opportunities.
          </p>
        </motion.div>

        {/* Contact Methods Grid */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.8 }}
          className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8"
        >
          {contactMethods.map((method, index) => (
            <motion.div
              key={method.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="group relative"
            >
              <div
                className={cn(
                  "relative overflow-hidden rounded-xl sm:rounded-2xl p-6 sm:p-8 group cursor-pointer",
                  "backdrop-blur-xl border transition-all duration-500",
                  `bg-gradient-to-br ${method.colors.bg}`,
                  method.colors.border,
                  method.colors.glow,
                  "transform-gpu",
                )}
              >
                {/* Accent glow overlay shown on hover */}
                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                  <div
                    className={cn(
                      "absolute inset-0 rounded-2xl opacity-30 blur-md",
                      method.colors.accent,
                    )}
                  />
                  <div
                    className={cn(
                      "absolute inset-0 rounded-2xl opacity-10 blur-lg",
                      method.colors.accent,
                    )}
                  />
                </div>

                {/* Animated accent line */}
                <div
                  className={cn(
                    "absolute top-0 left-0 h-1 w-0 group-hover:w-full transition-all duration-700 ease-out",
                    method.colors.accent,
                  )}
                />

                <div className="relative z-10">
                  <div className="space-y-6 text-center">
                    <div
                      className={cn(
                        "relative w-16 h-16 rounded-xl transition-all duration-500",
                        "group-hover:scale-110 group-hover:rotate-6 transform-gpu",
                        `bg-gradient-to-br ${method.colors.bg}`,
                        "border border-white/20 dark:border-white/10",
                        "shadow-lg group-hover:shadow-xl flex items-center justify-center mx-auto",
                      )}
                    >
                      <div className={cn("w-8 h-8", method.colors.icon)}>
                        <method.icon className="w-full h-full" />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground transition-colors duration-300">
                        {method.title}
                      </h3>

                      <p className="font-semibold text-foreground">
                        {method.primary}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {method.secondary}
                      </p>

                      <div className="mt-3">
                        <Button asChild className="w-full">
                          <a
                            href={method.actionHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={
                              "inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-primary hover:bg-primary/90 shadow-lg hover:shadow-xl transition-all"
                            }
                          >
                            {method.action}
                            <ExternalLink className="ml-2 h-4 w-4" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
