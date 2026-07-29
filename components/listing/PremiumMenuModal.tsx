"use client";

import { useState, useEffect, useMemo, Fragment, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { X, Search, Utensils, Dessert, Coffee, ChefHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Database } from "@/types/database";

type MenuSection = Database["public"]["Tables"]["menu_sections"]["Row"] & {
  menu_items: Database["public"]["Tables"]["menu_items"]["Row"][] | null;
};

interface PremiumMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  menuSections: MenuSection[];
  restaurantName: string;
}

// Helper function to format price
const formatPrice = (price: number): string => {
  return `Rs ${price.toLocaleString()}`;
};

// Section icons mapping
const sectionIcons: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  appetizers: Utensils,
  starters: Utensils,
  "main courses": ChefHat,
  mains: ChefHat,
  main: ChefHat,
  desserts: Dessert,
  drinks: Coffee,
  beverages: Coffee,
};

export function PremiumMenuModal({
  isOpen,
  onClose,
  menuSections,
  restaurantName,
}: PremiumMenuModalProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");

  // Reset state and lock scroll when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      // Reset state on close for a fresh open next time
      const timer = setTimeout(() => {
        setActiveTab(0);
        setSearchQuery("");
        setDebouncedSearchQuery("");
      }, 300); // Delay reset until after exit animation
      document.body.style.overflow = "";
      return () => clearTimeout(timer);
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Debounce search query to prevent excessive filtering
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300); // 300ms debounce delay

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Memoize expensive filtering operation to prevent recalculation on every render
  const filteredSections = useMemo(() => {
    if (!debouncedSearchQuery.trim()) return menuSections;

    const query = debouncedSearchQuery.toLowerCase().trim();

    return menuSections
      .map((section) => ({
        ...section,
        menu_items:
          section.menu_items?.filter(
            (item) =>
              item.name?.toLowerCase().includes(query) ||
              item.description?.toLowerCase().includes(query),
          ) || [],
      }))
      .filter((section) => section.menu_items.length > 0);
  }, [menuSections, debouncedSearchQuery]);

  // Memoize section icon mapping for better performance
  const getSectionIcon = useMemo(() => {
    return (sectionName: string) => {
      const key = Object.keys(sectionIcons).find((k) =>
        sectionName.toLowerCase().includes(k),
      );
      return key ? sectionIcons[key] : Utensils;
    };
  }, []);

  const activeSection = debouncedSearchQuery
    ? filteredSections[activeTab]
    : menuSections[activeTab];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[9999] bg-black/60"
          />

          {/* Main Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{
              duration: 0.15,
              ease: "easeOut",
            }}
            className="fixed inset-x-4 top-20 bottom-4 md:inset-x-8 md:top-24 md:bottom-8 lg:inset-x-16 lg:top-28 lg:bottom-12 xl:inset-x-32 xl:top-32 xl:bottom-16 z-[10000] flex overflow-hidden rounded-2xl md:rounded-3xl border border-border/20 bg-card/95 shadow-2xl"
            role="dialog"
            aria-modal="true"
          >
            {/* 1. Left Sidebar for Categories */}
            <div className="hidden h-full w-[260px] lg:w-[280px] flex-col bg-background/70 p-4 md:p-6 lg:flex border-r border-border/30">
              <div className="mb-4 md:mb-6 flex items-center gap-3">
                <div className="rounded-xl bg-primary/15 p-2 border border-primary/20">
                  <Utensils className="h-5 w-5 text-primary" />
                </div>
                <h2 className="text-lg md:text-xl font-bold text-foreground">
                  Menu
                </h2>
              </div>
              <div className="flex-1 space-y-1 md:space-y-2 overflow-y-auto pr-1 md:pr-2 scrollbar-thin">
                {(debouncedSearchQuery ? filteredSections : menuSections)
                  .slice(0, 20) // Limit sidebar sections for performance
                  .map((section, index) => {
                    const IconComponent = getSectionIcon(section.name || "");
                    const isActive = activeTab === index;
                    return (
                      <motion.button
                        key={section.id}
                        onClick={() => setActiveTab(index)}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 md:px-4 md:py-3 text-left text-sm font-medium transition-all duration-200 ${
                          isActive
                            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                            : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                        }`}
                      >
                        <div
                          className={`p-1 rounded-lg transition-all duration-300 ${
                            isActive
                              ? "bg-white/20"
                              : "bg-muted/50 group-hover:bg-primary/20"
                          }`}
                        >
                          <IconComponent className="h-4 w-4" />
                        </div>
                        <span className="truncate">{section.name}</span>
                      </motion.button>
                    );
                  })}
              </div>
            </div>

            {/* 2. Right Content Pane */}
            <div className="flex flex-1 flex-col min-w-0">
              {/* Header with Search and Close */}
              <div className="flex items-center justify-between border-b border-border/20 p-4 md:p-6 bg-background/50">
                <div className="relative w-full max-w-md lg:max-w-lg">
                  <Search className="absolute left-3 md:left-4 top-1/2 h-4 w-4 md:h-5 md:w-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder={`Search in ${restaurantName}'s menu...`}
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setActiveTab(0); // Reset to first tab on search
                    }}
                    className="h-10 md:h-12 w-full rounded-xl bg-muted/50 border-border/50 pl-10 md:pl-12 pr-4 text-sm md:text-base focus:border-primary/50 focus:ring-primary/20 transition-all duration-300"
                  />
                </div>
                <Button
                  onClick={onClose}
                  variant="ghost"
                  size="icon"
                  className="ml-3 md:ml-4 h-10 w-10 md:h-12 md:w-12 rounded-xl hover:bg-muted/80 transition-all duration-300 flex-shrink-0"
                >
                  <X className="h-4 w-4 md:h-5 md:w-5" />
                </Button>
              </div>

              {/* Mobile Category Tabs (visible only on mobile) */}
              <div className="lg:hidden border-b border-border/20 bg-background/30">
                <div className="flex overflow-x-auto scrollbar-thin px-4 py-3">
                  <div className="flex gap-2 min-w-max">
                    {(debouncedSearchQuery
                      ? filteredSections
                      : menuSections
                    ).map((section, index) => {
                      const IconComponent = getSectionIcon(section.name || "");
                      const isActive = activeTab === index;
                      return (
                        <motion.button
                          key={section.id}
                          onClick={() => setActiveTab(index)}
                          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                            isActive
                              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                              : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                          }`}
                        >
                          <IconComponent className="h-4 w-4" />
                          <span>{section.name}</span>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Scrollable Menu Items */}
              <div className="flex-1 overflow-y-auto scrollbar-thin">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${activeTab}-${activeSection?.id || ""}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.1 }}
                    className="p-4 md:p-6 lg:p-8"
                  >
                    {activeSection ? (
                      <div className="space-y-4 md:space-y-6">
                        <h3 className="text-2xl md:text-3xl font-black tracking-tight">
                          <span className="gradient-text-primary">
                            {activeSection.name}
                          </span>
                        </h3>
                        <div className="grid grid-cols-1 gap-4 md:gap-6 xl:grid-cols-2">
                          {(activeSection.menu_items || [])
                            .slice(0, 50) // Limit to 50 items for performance
                            .map((item, _itemIndex) => (
                              <motion.div
                                key={item.id}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{
                                  duration: 0.1,
                                }}
                                className="group relative bg-card/40 border border-border/50 rounded-2xl p-4 md:p-6 hover:bg-card/60 transition-all duration-200 hover:shadow-xl hover:shadow-primary/10 cursor-default"
                              >
                                {/* Content wrapper */}
                                <div className="flex gap-4">
                                  {/* Menu Item Image */}
                                  <div className="relative h-20 w-20 md:h-24 md:w-24 flex-shrink-0 rounded-xl bg-muted/50 border border-border/50 overflow-hidden">
                                    {item.image_url ? (
                                      <Image
                                        src={item.image_url}
                                        alt={item.image_alt || item.name}
                                        fill
                                        className="object-cover"
                                        sizes="(max-width: 768px) 80px, 96px"
                                        loading="lazy"
                                        priority={false}
                                        quality={75}
                                      />
                                    ) : (
                                      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl flex items-center justify-center">
                                        <Utensils className="h-8 w-8 text-muted-foreground" />
                                      </div>
                                    )}
                                  </div>{" "}
                                  <div className="flex-1 min-w-0 space-y-3">
                                    <div className="flex items-start justify-between gap-3">
                                      <h4 className="text-sm sm:text-base md:text-lg font-bold text-foreground group-hover:text-primary transition-colors duration-300 leading-tight">
                                        {item.name}
                                      </h4>
                                      <div className="flex-shrink-0 text-lg md:text-xl font-black text-primary">
                                        {formatPrice(Number(item.price))}
                                      </div>
                                    </div>

                                    {/* Price and Availability */}
                                    <div className="flex items-center justify-between">
                                      <p
                                        className="text-xs md:text-sm text-muted-foreground leading-relaxed flex-1 mr-3"
                                        style={{
                                          display: "-webkit-box",
                                          WebkitLineClamp: 2,
                                          WebkitBoxOrient: "vertical",
                                          overflow: "hidden",
                                        }}
                                      >
                                        {item.description}
                                      </p>
                                      {/* <Badge variant="outline" className="text-xs border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400">
                                      Available
                                    </Badge> */}
                                    </div>
                                  </div>
                                </div>

                                {/* Subtle Hover Glow Effect - Like Listing Page */}
                                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl pointer-events-none" />
                              </motion.div>
                            ))}
                        </div>
                      </div>
                    ) : (
                      <div className="flex h-full min-h-[300px] md:min-h-[400px] flex-col items-center justify-center text-center">
                        <div className="mb-4 md:mb-6 rounded-2xl bg-muted/50 p-4 md:p-6 border border-border/30">
                          <Search className="h-10 w-10 md:h-12 md:w-12 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg md:text-xl font-semibold mb-2">
                          No Results Found
                        </h3>
                        <p className="mt-2 text-sm md:text-base text-muted-foreground mb-4 md:mb-6 max-w-sm">
                          Try a different search term or clear the search to see
                          all menu items.
                        </p>
                        <Button
                          variant="outline"
                          onClick={() => setSearchQuery("")}
                          className="px-4 py-2 md:px-6 md:py-3 rounded-xl hover:bg-primary hover:text-primary-foreground transition-all duration-300"
                        >
                          Clear Search
                        </Button>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default memo(PremiumMenuModal);
