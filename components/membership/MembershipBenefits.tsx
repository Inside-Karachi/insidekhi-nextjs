"use client";

import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import {
  Megaphone,
  BookOpen,
  UserCheck,
  MessageSquare,
  BarChart3,
  Calendar,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function MembershipBenefits() {
  const benefits = [
    {
      id: "advertising",
      icon: Megaphone,
      title: "Advertising Opportunities",
      description:
        "Double down on exposure by advertising in one of our channels. A range of digital opportunities offer the choice of targeting consumers, meeting planners, or members of the travel trade.",
      features: [
        "Premium ad placements",
        "Social media promotion",
        "Newsletter features",
        "Website banner spots",
      ],
      colors: {
        bg: "from-red-500/20 via-red-500/10 to-red-500/5",
        border: "border-red-500/30",
        icon: "text-red-500",
        accent: "bg-red-500",
        glow: "hover:shadow-xl hover:shadow-red-500/25",
      },
    },
    {
      id: "publications",
      icon: BookOpen,
      title: "Guides & Publications",
      description:
        "Every member gets a listing on our website, and additional opportunities are available in our content materials. Advertising opportunities are also available.",
      features: [
        "Website directory listing",
        "Content marketing opportunities",
        "Guide inclusions",
        "Editorial features",
      ],
      colors: {
        bg: "from-blue-500/20 via-blue-500/10 to-blue-500/5",
        border: "border-blue-500/30",
        icon: "text-blue-500",
        accent: "bg-blue-500",
        glow: "hover:shadow-xl hover:shadow-blue-500/25",
      },
    },
    {
      id: "visitor-ready",
      icon: UserCheck,
      title: "Visitor Ready Program",
      description:
        "The Visitor Ready program sets you up for success by providing tools and techniques for working with the national travel trade. Benefits include repeat business and advanced bookings.",
      features: [
        "Business development tools",
        "Customer relationship training",
        "Booking optimization",
        "Revenue growth strategies",
      ],
      colors: {
        bg: "from-emerald-500/20 via-emerald-500/10 to-emerald-500/5",
        border: "border-emerald-500/30",
        icon: "text-emerald-500",
        accent: "bg-emerald-500",
        glow: "hover:shadow-xl hover:shadow-emerald-500/25",
      },
    },
    {
      id: "lifestyle-talks",
      icon: MessageSquare,
      title: "KHI Lifestyle Talks",
      description:
        "This program features a series of discussions with business leaders on timely and lifestyle-relevant topics.",
      features: [
        "Expert speaker sessions",
        "Industry networking",
        "Business insights",
        "Leadership development",
      ],
      colors: {
        bg: "from-purple-500/20 via-purple-500/10 to-purple-500/5",
        border: "border-purple-500/30",
        icon: "text-purple-500",
        accent: "bg-purple-500",
        glow: "hover:shadow-xl hover:shadow-purple-500/25",
      },
    },
    {
      id: "research",
      icon: BarChart3,
      title: "Exclusive Research",
      description:
        "Get exclusive and unlimited access to our industry-leading intel, including fact sheets, trend reports, and more.",
      features: [
        "Market analysis reports",
        "Consumer behavior insights",
        "Industry trend forecasts",
        "Competitive intelligence",
      ],
      colors: {
        bg: "from-amber-500/20 via-amber-500/10 to-amber-500/5",
        border: "border-amber-500/30",
        icon: "text-amber-500",
        accent: "bg-amber-500",
        glow: "hover:shadow-xl hover:shadow-amber-500/25",
      },
    },
    {
      id: "events",
      icon: Calendar,
      title: "Member Events",
      description:
        "Members enjoy an exciting calendar of events including networking mixers, industry conferences, and exclusive business gatherings.",
      features: [
        "Monthly networking events",
        "Industry conferences",
        "Exclusive workshops",
        "VIP business gatherings",
      ],
      colors: {
        bg: "from-indigo-500/20 via-indigo-500/10 to-indigo-500/5",
        border: "border-indigo-500/30",
        icon: "text-indigo-500",
        accent: "bg-indigo-500",
        glow: "hover:shadow-xl hover:shadow-indigo-500/25",
      },
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30, scale: 0.95 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
    },
  };

  return (
    <section id="membership-benefits" className="py-16 lg:py-24 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
          className="text-center space-y-4 lg:space-y-6 mb-16 lg:mb-20"
        >
          <Badge className="px-6 py-2 text-sm font-semibold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors">
            <Star className="w-4 h-4 mr-2" />
            Membership Benefits
          </Badge>

          <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold tracking-tight">
            Unlock Exclusive{" "}
            <span className="gradient-text-primary">Business Benefits</span>
          </h2>

          <p className="max-w-3xl mx-auto text-sm sm:text-base md:text-lg text-muted-foreground leading-relaxed px-4 sm:px-0">
            Membership in Inside Karachi is a worthwhile investment in your
            business and Karachi. Members collectively support the scope of
            Inside Karachi&apos;s work to inspire lifestyles and promote
            business growth.
          </p>
        </motion.div>

        {/* Benefits Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8"
        >
          {benefits.map((benefit) => (
            <motion.div
              key={benefit.id}
              variants={itemVariants}
              className="group relative"
            >
              <div
                className={cn(
                  "relative overflow-hidden rounded-xl sm:rounded-2xl p-6 sm:p-8 group cursor-pointer",
                  "backdrop-blur-xl border transition-all duration-500",
                  `bg-gradient-to-br ${benefit.colors.bg}`,
                  benefit.colors.border,
                  benefit.colors.glow,
                  "transform-gpu",
                )}
              >
                {/* Border glow */}
                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                  <div
                    className={cn(
                      "absolute inset-0 rounded-2xl opacity-30 blur-md",
                      benefit.colors.accent,
                    )}
                  />
                  <div
                    className={cn(
                      "absolute inset-0 rounded-2xl opacity-10 blur-lg",
                      benefit.colors.accent,
                    )}
                  />
                </div>

                {/* Animated accent line */}
                <div
                  className={cn(
                    "absolute top-0 left-0 h-1 w-0 group-hover:w-full transition-all duration-700 ease-out",
                    benefit.colors.accent,
                  )}
                />

                <div className="relative z-10">
                  {/* Icon with gradient background */}
                  <div className="space-y-6">
                    <div
                      className={cn(
                        "relative w-16 h-16 rounded-xl transition-all duration-500",
                        "group-hover:scale-110 group-hover:rotate-6 transform-gpu",
                        `bg-gradient-to-br ${benefit.colors.bg}`,
                        "border border-white/20 dark:border-white/10",
                        "shadow-lg group-hover:shadow-xl flex items-center justify-center",
                      )}
                    >
                      <div className={cn("w-8 h-8", benefit.colors.icon)}>
                        <benefit.icon className="w-full h-full" />
                      </div>
                    </div>

                    {/* Content */}
                    <div className="space-y-4">
                      <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground transition-colors duration-300">
                        {benefit.title}
                      </h3>

                      <p className="text-muted-foreground leading-relaxed">
                        {benefit.description}
                      </p>

                      {/* Feature List */}
                      <div className="space-y-2">
                        {benefit.features.map((feature, featureIndex) => (
                          <div
                            key={featureIndex}
                            className="flex items-center gap-3"
                          >
                            <div
                              className={cn(
                                "w-2 h-2 rounded-full",
                                benefit.colors.accent,
                              )}
                            />
                            <span className="text-sm text-muted-foreground font-medium">
                              {feature}
                            </span>
                          </div>
                        ))}
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
