"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { X, Search, Utensils, Dessert, Coffee, ChefHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Database } from "@/types/database";

// Re-using types and helpers from PremiumMenuModal.tsx
type MenuSection = Database["public"]["Tables"]["menu_sections"]["Row"] & {
  menu_items: Database["public"]["Tables"]["menu_items"]["Row"][] | null;
};

interface FullScreenMenuProps {
  isOpen: boolean;
  onClose: () => void;
  menuSections: MenuSection[];
  restaurantName: string;
}

const formatPrice = (price: number): string => {
  return `Rs ${price.toLocaleString()}`;
};

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

export function FullScreenMenu({
  isOpen,
  onClose,
  menuSections,
  restaurantName,
}: FullScreenMenuProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      // No need to delay state reset here as it's a full screen takeover
      setActiveTab(0);
      setSearchQuery("");
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const getSectionIcon = (sectionName: string) => {
    const key = Object.keys(sectionIcons).find((k) =>
      sectionName.toLowerCase().includes(k)
    );
    return key ? sectionIcons[key] : Utensils;
  };

  const filteredSections = menuSections
    .map((section) => ({
      ...section,
      menu_items:
        section.menu_items?.filter(
          (item) =>
            item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.description?.toLowerCase().includes(searchQuery.toLowerCase())
        ) || [],
    }))
    .filter((section) => section.menu_items.length > 0);

  const sectionsToShow = searchQuery ? filteredSections : menuSections;
  const activeSection = sectionsToShow[activeTab];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="fixed inset-0 z-[60] flex flex-col bg-background/95 backdrop-blur-xl"
        >
          {/* Header - Styled to match FullScreenNav */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent" />
            <div className="relative flex items-center justify-between p-6 border-b border-border/50">
              <div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  {restaurantName}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">Menu</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="hover:bg-primary/10"
              >
                <X className="h-6 w-6" />
                <span className="sr-only">Close menu</span>
              </Button>
            </div>
          </div>

          {/* Menu Content - Inspired by PremiumMenuModal.tsx */}
          <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
            {/* Search and Category Tabs */}
            <div className="p-4 sm:p-6 space-y-4 border-b border-border/20 bg-background/30">
              <div className="relative w-full">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search the menu..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setActiveTab(0);
                  }}
                  className="h-12 w-full rounded-xl bg-muted/50 border-border/50 pl-10 pr-4"
                />
              </div>

              <div className="overflow-x-auto scrollbar-thin">
                <div className="flex gap-2 min-w-max pb-2">
                  {sectionsToShow.map((section, index) => {
                    const IconComponent = getSectionIcon(section.name || "");
                    const isActive = activeTab === index;
                    return (
                      <motion.button
                        key={section.id}
                        onClick={() => setActiveTab(index)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 whitespace-nowrap ${
                          isActive
                            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                            : "bg-muted/50 text-muted-foreground hover:bg-muted"
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
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.25 }}
                  className="p-4 sm:p-6"
                >
                  {activeSection ? (
                    <div className="space-y-4">
                      <h3 className="text-2xl font-black tracking-tight">
                        <span className="gradient-text-primary">
                          {activeSection.name}
                        </span>
                      </h3>
                      <div className="grid grid-cols-1 gap-4">
                        {(activeSection.menu_items || []).map(
                          (item, itemIndex) => (
                            <motion.div
                              key={item.id}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{
                                duration: 0.3,
                                delay: itemIndex * 0.05,
                              }}
                              className="bg-card/40 border border-border/50 rounded-2xl p-4"
                            >
                              <div className="flex gap-4">
                                <div className="relative h-16 w-16 flex-shrink-0 rounded-xl bg-muted/50 border border-border/50 overflow-hidden">
                                  {item.image_url ? (
                                    <Image
                                      src={item.image_url}
                                      alt={item.image_alt || item.name}
                                      fill
                                      className="object-cover"
                                      sizes="64px"
                                    />
                                  ) : (
                                    <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl flex items-center justify-center">
                                      <Utensils className="h-6 w-6 text-muted-foreground" />
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0 space-y-2">
                                  <div className="flex items-start justify-between gap-2">
                                    <h4 className="font-bold text-foreground leading-tight">
                                      {item.name}
                                    </h4>
                                    <div className="flex-shrink-0 text-base font-black text-primary">
                                      {formatPrice(Number(item.price))}
                                    </div>
                                  </div>
                                  <p className="text-sm text-muted-foreground leading-snug">
                                    {item.description}
                                  </p>
                                </div>
                              </div>
                            </motion.div>
                          )
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-full min-h-[200px] flex-col items-center justify-center text-center p-4">
                      <div className="mb-4 rounded-2xl bg-muted/50 p-4 border border-border/30">
                        <Search className="h-10 w-10 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2">
                        No Results Found
                      </h3>
                      <p className="mt-2 text-sm text-muted-foreground max-w-xs">
                        Your search for &apos;{searchQuery}&apos; did not match
                        any menu items.
                      </p>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
