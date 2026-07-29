"use client";

import { motion } from "framer-motion";
import { Database } from "@/types/database";
import { ChefHat, Clock, Star, Tag, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { PremiumHeading } from "@/components/brand/Typography";

type Listing = Database["public"]["Views"]["listings_with_details"]["Row"];

interface QuickNavigationProps {
  listing: Listing;
  hasMenu?: boolean;
  hasDeals?: boolean;
  hasOpeningHours?: boolean;
  hasReviews?: boolean;
}

interface NavItem {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  sectionId: string;
  available: boolean;
  label: string;
  description: string;
  colors: {
    bg: string;
    border: string;
    icon: string;
    accent: string;
    glow: string;
  };
}

export function QuickNavigation({
  listing,
  hasMenu = false,
  hasDeals = false,
  hasOpeningHours = false,
  hasReviews = false,
}: QuickNavigationProps) {
  // Determine listing type for conditional rendering
  const listingType = listing.category_name?.toLowerCase() || "";
  const isRestaurant =
    listingType.includes("eat") ||
    listingType.includes("drink") ||
    listingType.includes("restaurant") ||
    listingType.includes("food");

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      const headerOffset = 100;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition =
        elementPosition + window.pageYOffset - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
    }
  };

  const navigationItems: NavItem[] = [
    {
      id: "menu",
      icon: ChefHat,
      sectionId: "menu-section",
      available: isRestaurant && hasMenu,
      label: "Menu",
      description: "View delicious menu options",
      colors: {
        bg: "from-orange-500/20 via-orange-500/10 to-orange-500/5",
        border: "border-orange-500/30",
        icon: "text-orange-600",
        accent: "bg-orange-500",
        glow: "hover:shadow-xl hover:shadow-orange-500/25",
      },
    },
    {
      id: "deals",
      icon: Tag,
      sectionId: "deals-section",
      available: hasDeals,
      label: "Deals",
      description: "Check out special offers",
      colors: {
        bg: "from-green-500/20 via-green-500/10 to-green-500/5",
        border: "border-green-500/30",
        icon: "text-green-600",
        accent: "bg-green-500",
        glow: "hover:shadow-xl hover:shadow-green-500/25",
      },
    },
    {
      id: "hours",
      icon: Clock,
      sectionId: "opening-hours-section",
      available: hasOpeningHours,
      label: "Hours",
      description: "Opening hours & schedule",
      colors: {
        bg: "from-blue-500/20 via-blue-500/10 to-blue-500/5",
        border: "border-blue-500/30",
        icon: "text-blue-600",
        accent: "bg-blue-500",
        glow: "hover:shadow-xl hover:shadow-blue-500/25",
      },
    },
    {
      id: "reviews",
      icon: Star,
      sectionId: "reviews-section",
      available: hasReviews,
      label: "Reviews",
      description: "Customer reviews & ratings",
      colors: {
        bg: "from-purple-500/20 via-purple-500/10 to-purple-500/5",
        border: "border-purple-500/30",
        icon: "text-purple-600",
        accent: "bg-purple-500",
        glow: "hover:shadow-xl hover:shadow-purple-500/25",
      },
    },
  ];

  const availableItems = navigationItems.filter((item) => item.available);

  // Don't render if no sections are available
  if (availableItems.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Quick Access Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
        className="relative overflow-hidden rounded-2xl p-6 md:p-8 backdrop-blur-xl border-2 md:border border-border/50 bg-gradient-to-br from-primary/5 via-transparent to-primary/10"
      >
        {/* Background effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 opacity-50" />
        <div className="absolute top-4 right-4 w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-primary/10 to-transparent rounded-full blur-xl" />

        <div className="relative space-y-6 md:space-y-8">
          {/* Header Section */}
          <div className="text-center space-y-3 md:space-y-4">
            <div className="flex items-center justify-center space-x-3">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 border border-primary/20 shadow-premium">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <PremiumHeading level={2} dense className="text-foreground">
                Quick <span className="gradient-text-primary">Access</span>
              </PremiumHeading>
            </div>
            <p className="text-sm sm:text-base md:text-lg text-muted-foreground font-medium max-w-sm mx-auto leading-relaxed md:mt-1">
              Jump to any section instantly
            </p>
          </div>

          {/* Navigation Grid */}
          <div className="flex items-center justify-center gap-3 md:gap-4">
            {availableItems.map((item, index) => {
              const IconComponent = item.icon;
              return (
                <div key={item.id} className="relative group">
                  {/* Tooltip */}
                  <div className="absolute -top-12 md:-top-14 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none z-20">
                    <div className="bg-foreground text-background text-xs font-medium px-2 md:px-3 py-1.5 md:py-2 rounded-lg shadow-lg whitespace-nowrap">
                      {item.label}
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-foreground"></div>
                    </div>
                  </div>

                  {/* Navigation Button */}
                  <motion.button
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{
                      duration: 0.5,
                      delay: 0.1 * index,
                      type: "spring",
                      stiffness: 200,
                      damping: 15,
                    }}
                    onClick={() => scrollToSection(item.sectionId)}
                    className={cn(
                      "relative overflow-hidden w-14 h-14 md:w-16 md:h-16 rounded-xl transition-all duration-300",
                      "backdrop-blur-xl border-2 md:border hover:scale-110 group/btn",
                      `bg-gradient-to-br ${item.colors.bg}`,
                      item.colors.border,
                      item.colors.glow,
                      "transform-gpu hover:rotate-3 shadow-lg hover:shadow-xl",
                      "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2"
                    )}
                    aria-label={`Navigate to ${item.label} section - ${item.description}`}
                    role="button"
                    tabIndex={0}
                  >
                    {/* Glow effect */}
                    <div className="absolute inset-0 rounded-xl opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300 pointer-events-none">
                      <div
                        className={cn(
                          "absolute inset-0 rounded-xl opacity-30 blur-md",
                          item.colors.accent
                        )}
                      />
                      <div
                        className={cn(
                          "absolute inset-0 rounded-xl opacity-10 blur-lg",
                          item.colors.accent
                        )}
                      />
                    </div>

                    <div className="relative flex items-center justify-center h-full">
                      <IconComponent
                        className={cn(
                          "h-5 w-5 md:h-6 md:w-6 transition-transform duration-300 group-hover/btn:scale-110",
                          item.colors.icon
                        )}
                      />
                    </div>
                  </motion.button>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
