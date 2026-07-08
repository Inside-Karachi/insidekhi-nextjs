"use client";

import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import {
  Eye,
  Users,
  BarChart3,
  MessageSquare,
  Star,
  Share2,
  MapPin,
  Store,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function GetListedBenefits() {
  const benefits = [
    {
      id: "visibility",
      icon: Eye,
      title: "Increased Visibility",
      description:
        "Get your business in front of thousands of potential customers actively searching for services in Karachi. Our platform reaches over 500,000 monthly visitors.",
      features: [
        "Premium search placement",
        "Featured business spotlight",
        "Category-specific listings",
        "Mobile-optimized display",
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
      id: "customer-engagement",
      icon: Users,
      title: "Customer Engagement",
      description:
        "Connect directly with customers through reviews, ratings, and easy direct contact options. Build long-lasting trust and strong credibility in the competitive local market.",
      features: [
        "Customer review system",
        "Direct contact forms",
        "Business messaging",
        "Social proof display",
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
      id: "analytics",
      icon: BarChart3,
      title: "Business Analytics",
      description:
        "Track your listing performance with detailed analytics. Understand customer behavior, peak viewing times, and optimize your business presence.",
      features: [
        "View tracking",
        "Customer insights",
        "Performance metrics",
        "Competitor analysis",
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
      id: "reviews",
      icon: Star,
      title: "Review Management",
      description:
        "Build credibility with authentic customer reviews and ratings. Respond to feedback and showcase your excellent service quality.",
      features: [
        "Verified reviews",
        "Rating system",
        "Review responses",
        "Trust badges",
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
      id: "social-sharing",
      icon: Share2,
      title: "Social Integration",
      description:
        "Amplify your reach with built-in social media integration. Share your business updates and engage with the community.",
      features: [
        "Social media links",
        "Content sharing",
        "Community engagement",
        "Brand awareness",
      ],
      colors: {
        bg: "from-pink-500/20 via-pink-500/10 to-pink-500/5",
        border: "border-pink-500/30",
        icon: "text-pink-500",
        accent: "bg-pink-500",
        glow: "hover:shadow-xl hover:shadow-pink-500/25",
      },
    },
    {
      id: "local-seo",
      icon: MapPin,
      title: "Local SEO Boost",
      description:
        "Improve your local search rankings with optimized business listings. Get found when customers search for businesses in your area.",
      features: [
        "Local search optimization",
        "Google Maps integration",
        "Location-based discovery",
        "SEO-friendly listings",
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
    <section id="listing-benefits" className="py-16 lg:py-24 bg-background">
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
            <Store className="w-4 h-4 mr-2" />
            Listing Benefits
          </Badge>

          <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold tracking-tight">
            Why Choose{" "}
            <span className="gradient-text-primary">Inside Karachi?</span>
          </h2>

          <p className="max-w-3xl mx-auto text-sm sm:text-base md:text-lg text-muted-foreground leading-relaxed px-4 sm:px-0">
            By listing your business with Inside Karachi, you&apos;re not just
            promoting yourself, but also contributing to the growth of our city.
            Enjoy increased visibility, exclusive benefits, and valuable
            connections.
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

        {/* Success Story Section */}
        {false && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="mt-16 lg:mt-20 text-center"
          >
            <div className="max-w-4xl mx-auto relative">
              {/* Background Elements */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 rounded-3xl" />
              <div className="absolute top-4 right-4 w-32 h-32 bg-primary/5 rounded-full blur-2xl" />
              <div className="absolute bottom-4 left-4 w-24 h-24 bg-primary/3 rounded-full blur-xl" />

              {/* Main Card */}
              <div className="relative backdrop-blur-xl border border-border/50 rounded-3xl p-8 lg:p-12 bg-card/50 shadow-premium hover:shadow-premium-lg transition-all duration-500">
                {/* Quote Icon */}
                <div className="relative mb-8">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center border border-primary/20">
                    <MessageSquare className="w-8 h-8 text-primary" />
                  </div>
                  {/* Floating sparkles */}
                  <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                  </div>
                  <div className="absolute -bottom-1 -left-1 w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center">
                    <div className="w-1 h-1 rounded-full bg-primary/60" />
                  </div>
                </div>

                {/* Quote Content */}
                <div className="space-y-6">
                  <blockquote className="text-xl lg:text-2xl text-foreground font-semibold leading-relaxed italic">
                    &quot;Listing with Inside Karachi increased our customer
                    base by{" "}
                    <span className="gradient-text-primary font-bold">
                      300%
                    </span>{" "}
                    in just 3 months. The platform is incredibly effective for
                    reaching local customers.&quot;
                  </blockquote>

                  {/* Attribution */}
                  <div className="flex items-center justify-center space-x-4 pt-4 border-t border-border/30">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-foreground to-primary flex items-center justify-center text-white font-bold text-lg">
                      A
                    </div>
                    <div className="text-left">
                      <cite className="text-foreground font-semibold not-italic">
                        Ahmed Hassan
                      </cite>
                      <div className="text-sm text-muted-foreground">
                        Restaurant Owner
                      </div>
                    </div>
                  </div>
                </div>

                {/* Trust Indicators */}
                <div className="grid grid-cols-3 gap-4 mt-8 pt-8 border-t border-border/30">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">300%</div>
                    <div className="text-xs text-muted-foreground">
                      Growth Rate
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">3</div>
                    <div className="text-xs text-muted-foreground">Months</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">★★★★★</div>
                    <div className="text-xs text-muted-foreground">
                      5 Star Rating
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </section>
  );
}
