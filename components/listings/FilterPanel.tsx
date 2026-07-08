"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  X,
  Sparkles,
  Percent,
  Tag,
  Clock,
  MapPin,
  ChevronRight,
  Star,
  TrendingUp,
  Zap,
  Building,
  Utensils,
  ShoppingBag,
  Gamepad2,
  GraduationCap,
  Heart,
  Ticket,
  Compass,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PremiumToggleSwitch } from "@/components/brand/ToggleSwitch";

// Define the shape of data we expect from the DB
interface Bank {
  id: number;
  name: string;
}
interface Category {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
}
interface CardVariant {
  id: number;
  card_name: string;
  bank_id: number;
}
interface SortOption {
  key: string;
  label: string;
  icon_name: string;
  is_default: boolean;
}

// This object defines the structure for our temporary filter state
export interface FilterState {
  sort: string | null;
  deals: boolean;
  open_now: boolean;
  near: boolean;
  bank: string | null;
  card: string | null;
  category: string | null;
  subCategory: string | null;
}

interface FilterPanelProps {
  // Data props
  banks: Bank[];
  categories: Category[];
  sortOptions: SortOption[];

  // State & function props
  initialFilters: FilterState;
  onApply: (filters: FilterState) => void;
  onClose: () => void;
}

// Reusable components
const DarkPremiumPill = ({
  active,
  onClick,
  children,
  icon: Icon,
  variant = "default",
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon?: React.ElementType;
  variant?: "default" | "gradient" | "outlined";
}) => {
  const baseClasses =
    "group relative flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl transition-all duration-300 overflow-hidden";

  const variantClasses = {
    default: active
      ? "bg-gradient-to-r from-primary via-primary to-primary/90 text-white shadow-lg shadow-primary/30 scale-105"
      : "bg-gray-800/60 hover:bg-gray-700/60 border border-gray-700/50 hover:border-gray-600/80 text-gray-300 hover:text-white hover:scale-105",
    gradient: active
      ? "bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500 text-white shadow-lg shadow-purple-500/30 scale-105"
      : "bg-gradient-to-r from-gray-800/60 to-gray-700/40 hover:from-gray-700/70 hover:to-gray-600/50 border border-gray-700/50 text-gray-300 hover:text-white hover:scale-105",
    outlined: active
      ? "bg-primary/20 border-2 border-primary text-primary shadow-lg shadow-primary/20"
      : "border-2 border-gray-700/50 hover:border-primary/50 hover:bg-primary/10 text-gray-300 hover:text-primary",
  };

  return (
    <motion.button
      onClick={onClick}
      className={cn(baseClasses, variantClasses[variant])}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      layout
    >
      {active && (
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-xl"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        />
      )}
      {Icon && <Icon className="h-4 w-4 flex-shrink-0" />}
      <span className="relative z-10">{children}</span>
    </motion.button>
  );
};

const CategoryIcon = ({ slug }: { slug: string }) => {
  const iconMap: Record<string, React.ElementType> = {
    "eat-drink": Utensils,
    "where-to-stay": Building,
    shopping: ShoppingBag,
    entertainment: Gamepad2,
    education: GraduationCap,
    "fitness-healthcare": Heart,
    events: Ticket,
    "things-to-do": Compass,
  };

  const Icon = iconMap[slug] || Compass;
  return <Icon className="h-4 w-4" />;
};

export function FilterPanel({
  banks,
  categories,
  sortOptions,
  initialFilters,
  onApply,
  onClose,
}: FilterPanelProps) {
  // Local state to manage filter changes before applying
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [cardVariants, setCardVariants] = useState<CardVariant[]>([]);
  const [loadingCards, setLoadingCards] = useState(false);

  // State to manage which parent category is selected to show sub-categories
  const [activeParentSlug, setActiveParentSlug] = useState<string | null>(
    initialFilters.category
  );

  // Memoize category calculations for performance
  const topLevelCategories = React.useMemo(
    () => categories.filter((c) => !c.parent_id),
    [categories]
  );
  const subCategories = React.useMemo(() => {
    if (!activeParentSlug) return [];
    const parent = categories.find((c) => c.slug === activeParentSlug);
    return parent ? categories.filter((c) => c.parent_id === parent.id) : [];
  }, [categories, activeParentSlug]);

  // Fetch card variants when a bank is selected
  useEffect(() => {
    const fetchCards = async () => {
      if (!filters.bank) {
        setCardVariants([]);
        return;
      }
      setLoadingCards(true);
      // Dynamic import for client-side Supabase
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data } = await supabase
        .from("card_variants")
        .select("id, card_name, bank_id")
        .eq("is_active", true)
        .eq("bank_id", parseInt(filters.bank, 10));
      setCardVariants(data || []);
      setLoadingCards(false);
    };
    fetchCards();
  }, [filters.bank]);

  const handleUpdate = <K extends keyof FilterState>(
    key: K,
    value: FilterState[K]
  ) => {
    setFilters((prev) => {
      const newState = { ...prev, [key]: value };
      // Reset card if bank is changed/cleared
      if (key === "bank" && prev.bank !== value) {
        newState.card = null;
      }
      // Reset sub-category if parent category changes
      if (key === "category" && prev.category !== value) {
        newState.subCategory = null;
      }
      return newState;
    });
  };

  const handleParentCategoryClick = (slug: string | null) => {
    const newSlug = filters.category === slug ? null : slug;
    handleUpdate("category", newSlug);
    setActiveParentSlug(newSlug);
  };

  const handleApplyClick = () => {
    onApply(filters);
    onClose();
  };

  const handleClear = () => {
    const clearedState: FilterState = {
      sort: null,
      deals: false,
      open_now: false,
      near: false,
      bank: null,
      card: null,
      category: null,
      subCategory: null,
    };
    setFilters(clearedState);
    setActiveParentSlug(null);
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Dark Backdrop */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/50 to-black/70 backdrop-blur-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={onClose}
      />

      {/* Dark Modal - Inspired by Sidebar */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="relative w-full max-w-md max-h-[90vh] overflow-hidden"
      >
        {/* Dark Theme Container using proper CSS variables */}
        <div className="relative rounded-2xl bg-background/95 border border-border backdrop-blur-xl shadow-2xl">
          {/* Gradient accent */}
          <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-primary/80 to-transparent" />

          {/* Header with proper theme colors */}
          <div className="flex items-center justify-between p-6 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/20 border border-primary/30">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-foreground">
                  Smart Filters
                </h2>
                <p className="text-xs text-muted-foreground">
                  Refine your search with precision
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-all duration-200"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Scrollable Content with Dark Theme */}
          <div className="max-h-[60vh] overflow-y-auto custom-scrollbar p-6 space-y-6">
            {/* Sort Section */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="space-y-4"
            >
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Sort & Priority
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {sortOptions.map((sortOption) => {
                  const isActive = sortOption.is_default
                    ? !filters.sort
                    : filters.sort === sortOption.key;

                  // Get icon component from icon name
                  const IconComponent =
                    {
                      star: Star,
                      "trending-up": TrendingUp,
                      percent: Percent,
                      clock: Clock,
                      "map-pin": MapPin,
                    }[sortOption.icon_name] || Star;

                  return (
                    <DarkPremiumPill
                      key={sortOption.key}
                      active={isActive}
                      onClick={() =>
                        handleUpdate("sort", isActive ? null : sortOption.key)
                      }
                      icon={IconComponent}
                      variant={
                        sortOption.key === "trending"
                          ? "gradient"
                          : sortOption.key === "max-discount"
                          ? "outlined"
                          : "default"
                      }
                    >
                      {sortOption.label}
                    </DarkPremiumPill>
                  );
                })}
              </div>
            </motion.section>

            <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

            {/* Categories Section */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="space-y-4"
            >
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                <Compass className="h-4 w-4 text-primary" />
                Categories
              </h3>
              <div className="space-y-2">
                {topLevelCategories.map((cat, index) => (
                  <motion.div
                    key={cat.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + index * 0.05 }}
                  >
                    <motion.button
                      onClick={() => handleParentCategoryClick(cat.slug)}
                      className={cn(
                        "w-full flex items-center justify-between p-4 rounded-xl transition-all duration-300 group border",
                        filters.category === cat.slug
                          ? "bg-gradient-to-r from-primary/30 to-primary/20 border-primary/50 shadow-lg shadow-primary/20"
                          : "bg-gradient-to-r from-gray-800/50 to-gray-700/30 border-gray-700/50 hover:border-gray-600/50 hover:from-gray-700/60 hover:to-gray-600/40"
                      )}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "p-2 rounded-lg transition-all duration-300",
                            filters.category === cat.slug
                              ? "bg-primary/30 text-primary"
                              : "bg-gray-600/30 text-gray-400 group-hover:text-gray-300"
                          )}
                        >
                          <CategoryIcon slug={cat.slug} />
                        </div>
                        <span className="font-medium text-sm text-white">
                          {cat.name}
                        </span>
                      </div>
                      <ChevronRight
                        className={cn(
                          "h-4 w-4 transition-transform duration-300 text-gray-400",
                          activeParentSlug === cat.slug &&
                            subCategories.length > 0 &&
                            "rotate-90"
                        )}
                      />
                    </motion.button>

                    {/* Animated Subcategories */}
                    {activeParentSlug === cat.slug &&
                      subCategories.length > 0 && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden mt-2 ml-4 space-y-2"
                        >
                          {subCategories.map((sub, subIndex) => (
                            <motion.div
                              key={sub.id}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: subIndex * 0.05 }}
                            >
                              <DarkPremiumPill
                                active={filters.subCategory === sub.slug}
                                onClick={() =>
                                  handleUpdate(
                                    "subCategory",
                                    filters.subCategory === sub.slug
                                      ? null
                                      : sub.slug
                                  )
                                }
                              >
                                {sub.name}
                              </DarkPremiumPill>
                            </motion.div>
                          ))}
                        </motion.div>
                      )}
                  </motion.div>
                ))}
              </div>
            </motion.section>

            <div className="h-px bg-gradient-to-r from-transparent via-gray-700/50 to-transparent" />

            {/* Quick Filters Section */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="space-y-4"
            >
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                Quick Filters
              </h3>

              <div className="flex flex-wrap gap-3">
                <PremiumToggleSwitch
                  checked={filters.deals}
                  onChange={(checked) => handleUpdate("deals", checked)}
                  label="Active Deals"
                  icon={Tag}
                  variant="success"
                  size="sm"
                />
                <PremiumToggleSwitch
                  checked={filters.open_now}
                  onChange={(checked) => handleUpdate("open_now", checked)}
                  label="Open Now"
                  icon={Clock}
                  size="sm"
                />
                <PremiumToggleSwitch
                  checked={filters.near}
                  onChange={(checked) => handleUpdate("near", checked)}
                  label="Near Me"
                  icon={MapPin}
                  variant="warning"
                  size="sm"
                />
              </div>

              {/* Bank & Card Selection */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">
                    Bank
                  </label>
                  <select
                    value={filters.bank || ""}
                    onChange={(e) =>
                      handleUpdate("bank", e.target.value || null)
                    }
                    className="w-full h-12 px-4 text-sm rounded-xl bg-gray-800/50 border border-gray-700/50 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all duration-300"
                  >
                    <option value="">Any Bank</option>
                    {banks.map((b) => (
                      <option key={b.id} value={String(b.id)}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                {filters.bank && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-2"
                  >
                    <label className="text-sm font-medium text-gray-300">
                      Card Type
                    </label>
                    <select
                      value={filters.card || ""}
                      onChange={(e) =>
                        handleUpdate("card", e.target.value || null)
                      }
                      className="w-full h-12 px-4 text-sm rounded-xl bg-gray-800/50 border border-gray-700/50 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all duration-300"
                      disabled={loadingCards}
                    >
                      <option value="">
                        {loadingCards ? "Loading..." : "Any Card"}
                      </option>
                      {cardVariants.map((cv) => (
                        <option key={cv.id} value={String(cv.id)}>
                          {cv.card_name}
                        </option>
                      ))}
                    </select>
                  </motion.div>
                )}
              </div>
            </motion.section>
          </div>

          {/* Dark Footer */}
          <div className="p-6 border-t border-gray-700/50 bg-gradient-to-r from-gray-800/30 to-gray-700/20">
            <div className="flex items-center gap-3">
              <button
                onClick={handleClear}
                className="flex-1 h-11 rounded-xl border border-gray-600/50 text-gray-300 hover:text-white hover:bg-gray-700/50 transition-all duration-300 font-medium"
              >
                Clear All
              </button>
              <button
                onClick={handleApplyClick}
                className="flex-1 h-11 rounded-xl bg-gradient-to-r from-primary to-primary/90 text-white font-medium shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 transition-all duration-300"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
