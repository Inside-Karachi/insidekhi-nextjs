"use client";

import * as React from "react";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useGeolocation } from "@/hooks/useGeolocation";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Search,
  Star,
  TrendingUp,
  Percent,
  Tag,
  Clock,
  MapPin,
  Compass,
  ChevronDown,
  ChevronUp,
  Building,
  CreditCard,
  CheckCircle2,
  RotateCcw,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import FilterChip from "@/components/ui/FilterChip";
import { PremiumDropdown } from "@/components/brand/Dropdown";
import { useFilterData } from "@/hooks/useFilterData";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { getCanonicalSubParam } from "@/lib/utils/listings-filters";

interface Category {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
  icon_name?: string | null;
}

interface FilterState {
  search: string;
  sort: string | null;
  category: string | null;
  subCategory: string | null;
  deals: boolean;
  open_now: boolean;
  near: boolean;
  bank: string | null;
  card: string | null;
}

interface FullScreenFilterProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
}

const CategoryIcon = ({ slug }: { slug: string; iconName?: string }) => {
  // Comprehensive icon mapping for Lucide React icons
  const iconMap: Record<string, React.ElementType> = {
    "eat-drink": TrendingUp,
    "where-to-stay": Building,
    events: Tag,
    "guides-reviews": Star,
    "fitness-healthcare": Star,
    education: Star,
    entertainment: Star,
    shopping: Star,
    "things-to-do": Compass,
  };

  const Icon = iconMap[slug] || Star;
  return <Icon className="h-4 w-4" />;
};

// using shared FilterChip from components/ui

function buildUrl(base: string, params: URLSearchParams) {
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export function FullScreenFilter({
  isOpen,
  onClose,
  categories,
}: FullScreenFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Local state for immediate updates
  const [localFilters, setLocalFilters] = useState<FilterState>({
    search: searchParams.get("search") || "",
    sort: searchParams.get("sort"),
    category: searchParams.get("category"),
    subCategory: getCanonicalSubParam(searchParams),
    deals: searchParams.get("deals") === "true",
    open_now: searchParams.get("open_now") === "true",
    near: searchParams.get("near") === "1",
    bank: searchParams.get("bank"),
    card: searchParams.get("card"),
  });

  // Filter data hook (must be after localFilters is defined)
  const {
    banks,
    cardVariants,
    sortOptions,
    loading: filterLoading,
    error: filterError,
  } = useFilterData(localFilters.bank);

  const [showAllCategories, setShowAllCategories] = useState(false);
  const [userCoordinates, setUserCoordinates] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  // Geolocation hook for "Nearest" sort option
  const { loading: locationLoading, getLocation } = useGeolocation({
    onSuccess: (lat, lng) => {
      setUserCoordinates({ lat, lng });
    },
    onError: (_error) => {
      setLocalFilters((prev) => ({
        ...prev,
        sort: null,
      }));
      setUserCoordinates(null);
    },
  });

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      // Focus search input when opened
      setTimeout(() => searchInputRef.current?.focus(), 100);
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Categories logic
  const isMobile = useMediaQuery("(max-width: 768px)");
  const topLevelCategories = categories.filter((cat) => !cat.parent_id);
  const parentCategory = topLevelCategories.find(
    (cat) => cat.slug === localFilters.category,
  );
  const currentSubCategories = parentCategory
    ? categories.filter((cat) => cat.parent_id === parentCategory.id)
    : [];

  // Mobile-only abbreviations for long filter names
  const getCategoryLabel = (cat: Category) => {
    if (!isMobile) return cat.name;
    const map: Record<string, string> = {
      "guides-reviews": "Guides",
      "fitness-healthcare": "Fitness",
      "where-to-stay": "Stay",
      "things-to-do": "Explore",
    };
    return map[cat.slug] || cat.name;
  };

  const updateLocalFilter = useCallback(
    (key: keyof FilterState, value: string | boolean | null) => {
      setLocalFilters((prev) => {
        const updated = { ...prev, [key]: value };
        // Reset card when bank changes
        if (key === "bank" && prev.bank !== value) {
          updated.card = null;
        }
        // Reset subcategory when category changes
        if (key === "category" && prev.category !== value) {
          updated.subCategory = null;
        }
        return updated;
      });

      // Auto-trigger geolocation when "distance" sort is selected
      if (key === "sort" && value === "distance") {
        getLocation();
      }

      // Clear coordinates if distance sort is deselected
      if (key === "sort" && value !== "distance") {
        setUserCoordinates(null);
      }
    },
    [getLocation],
  );

  const applyFilters = useCallback(() => {
    const params = new URLSearchParams();

    // Apply all filters EXCEPT category (which becomes a path segment)
    Object.entries(localFilters).forEach(([key, value]) => {
      if (value === null || value === false || value === "") return;
      // Skip category and subCategory - they become path segments
      if (key === "category" || key === "subCategory") return;

      if (key === "near") {
        if (value) params.set("near", "1");
      } else {
        params.set(key, String(value));
      }
    });

    // Add coordinates if distance sorting with user location
    if (localFilters.sort === "distance" && userCoordinates) {
      params.set("lat", userCoordinates.lat.toFixed(6));
      params.set("lng", userCoordinates.lng.toFixed(6));
    }

    // Determine the correct path based on category selection
    // "all" or null/empty should navigate to /listings (not /listings/all)
    let basePath = "/listings";
    if (localFilters.subCategory && localFilters.subCategory !== "all") {
      // Subcategory selected - navigate to /listings/[subcategory-slug]
      basePath = `/listings/${localFilters.subCategory}`;
    } else if (localFilters.category && localFilters.category !== "all") {
      // Parent category selected - navigate to /listings/[category-slug]
      basePath = `/listings/${localFilters.category}`;
    }

    router.push(buildUrl(basePath, params));
    onClose();
  }, [localFilters, router, onClose, userCoordinates]);

  const clearAllFilters = useCallback(() => {
    const clearedFilters = {
      search: "",
      sort: null,
      category: null,
      subCategory: null,
      deals: false,
      open_now: false,
      near: false,
      bank: null,
      card: null,
    };
    setLocalFilters(clearedFilters);
  }, []);

  const hasActiveFilters = Object.entries(localFilters).some(
    ([key, value]) =>
      key !== "search" && (value === true || (value !== null && value !== "")),
  );

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
          {/* Header with Glassmorphism */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent" />
            <div className="relative flex items-center justify-between p-6 border-b border-border/50">
              <div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  Filter & Sort
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Find exactly what you&apos;re looking for
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="hover:bg-primary/10"
              >
                <X className="h-6 w-6" />
                <span className="sr-only">Close filters</span>
              </Button>
            </div>
          </div>

          {/* Filter Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            {/* Search Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              <h3 className="text-lg font-semibold text-foreground/90 flex items-center gap-2">
                <Search className="h-5 w-5 text-primary" />
                Search
              </h3>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search restaurants, hotels, attractions..."
                  value={localFilters.search}
                  onChange={(e) => updateLocalFilter("search", e.target.value)}
                  className="pl-10 h-12 rounded-xl bg-card/50 border-border/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </motion.div>

            {/* Bank & Card Section - MOVED TO FIRST (after search) */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="space-y-4"
            >
              <h3 className="text-lg font-semibold text-foreground/90 flex items-center gap-2">
                <Building className="h-5 w-5 text-primary" />
                Bank & Card
              </h3>
              <div className="space-y-4">
                <PremiumDropdown
                  value={localFilters.bank}
                  onChange={(value) => {
                    updateLocalFilter("bank", value);
                    if (!value) {
                      updateLocalFilter("card", null);
                    }
                  }}
                  options={banks}
                  placeholder="Any Bank"
                  searchable={banks.length > 5}
                  icon={Building}
                />

                <AnimatePresence mode="wait">
                  {localFilters.bank && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                    >
                      <PremiumDropdown
                        value={localFilters.card}
                        onChange={(value) => updateLocalFilter("card", value)}
                        options={cardVariants}
                        loading={filterLoading.cardVariants}
                        error={filterError || undefined}
                        placeholder={
                          filterLoading.cardVariants
                            ? "Loading cards..."
                            : "Any Card"
                        }
                        searchable={cardVariants.length > 5}
                        icon={CreditCard}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>

            {/* Sort Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className="space-y-4"
            >
              <h3 className="text-lg font-semibold text-foreground/90 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Sort & Priority
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {sortOptions.map((sortOption, index) => {
                  const isActive = sortOption.is_default
                    ? !localFilters.sort
                    : localFilters.sort === sortOption.key;

                  const isDistanceSort = sortOption.key === "distance";
                  const isLoading = isDistanceSort && locationLoading;

                  const IconComponent =
                    {
                      star: Star,
                      "trending-up": TrendingUp,
                      percent: Percent,
                      clock: Clock,
                      "map-pin": MapPin,
                    }[sortOption.icon_name] || Star;

                  return (
                    <motion.div
                      key={sortOption.key}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: 0.1 + index * 0.05 }}
                    >
                      <FilterChip
                        active={isActive}
                        disabled={isLoading}
                        onClick={() => {
                          // Prevent toggling off while loading
                          if (isLoading) return;

                          updateLocalFilter(
                            "sort",
                            isActive ? null : sortOption.key,
                          );
                        }}
                        icon={IconComponent}
                      >
                        {isLoading ? "Getting location..." : sortOption.label}
                      </FilterChip>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>

            {/* Categories Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.3 }}
              className="space-y-4"
            >
              <h3 className="text-lg font-semibold text-foreground/90 flex items-center gap-2">
                <Compass className="h-5 w-5 text-primary" />
                Categories
              </h3>
              <div
                className={`grid grid-cols-2 ${isMobile ? "gap-2.5" : "gap-3"}`}
              >
                {topLevelCategories
                  .slice(0, showAllCategories ? topLevelCategories.length : 6)
                  .map((cat, index, arr) => (
                    <motion.div
                      key={cat.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: 0.2 + index * 0.05 }}
                    >
                      <FilterChip
                        active={
                          cat.slug === "all"
                            ? !localFilters.category
                            : localFilters.category === cat.slug
                        }
                        onClick={() => {
                          if (cat.slug === "all") {
                            // "All" clears category filter
                            updateLocalFilter("category", null);
                            updateLocalFilter("subCategory", null);
                          } else if (localFilters.category === cat.slug) {
                            updateLocalFilter("category", null);
                            updateLocalFilter("subCategory", null);
                          } else {
                            updateLocalFilter("category", cat.slug);
                            updateLocalFilter("subCategory", null);
                          }
                        }}
                        icon={() => (
                          <CategoryIcon
                            slug={cat.slug}
                            iconName={cat.icon_name || undefined}
                          />
                        )}
                        isLast={index === arr.length - 1}
                      >
                        {getCategoryLabel(cat)}
                      </FilterChip>
                    </motion.div>
                  ))}
                {topLevelCategories.length > 6 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.2 + 6 * 0.05 }}
                  >
                    <FilterChip
                      active={false}
                      onClick={() => setShowAllCategories(!showAllCategories)}
                      icon={showAllCategories ? ChevronUp : ChevronDown}
                      isLast={true}
                    >
                      {showAllCategories
                        ? "Show less"
                        : `+${topLevelCategories.length - 6} more`}
                    </FilterChip>
                  </motion.div>
                )}
              </div>

              {/* Subcategories */}
              {currentSubCategories.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-3 pl-4 border-l-2 border-primary/20"
                >
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Subcategories
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    {currentSubCategories.map((sub, index) => (
                      <motion.div
                        key={sub.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                      >
                        <FilterChip
                          active={localFilters.subCategory === sub.slug}
                          onClick={() =>
                            updateLocalFilter(
                              "subCategory",
                              localFilters.subCategory === sub.slug
                                ? null
                                : sub.slug,
                            )
                          }
                        >
                          {sub.name}
                        </FilterChip>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </motion.div>

            {/* Quick Filters Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.4 }}
              className="space-y-4"
            >
              <h3 className="text-lg font-semibold text-foreground/90 flex items-center gap-2">
                <Filter className="h-5 w-5 text-primary" />
                Quick Filters
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <FilterChip
                  active={localFilters.deals}
                  onClick={() =>
                    updateLocalFilter("deals", !localFilters.deals)
                  }
                  icon={Tag}
                >
                  Deals
                </FilterChip>
                <FilterChip
                  active={localFilters.open_now}
                  onClick={() =>
                    updateLocalFilter("open_now", !localFilters.open_now)
                  }
                  icon={Clock}
                >
                  Open Now
                </FilterChip>
                <FilterChip
                  active={searchParams.get("sort") === "distance"}
                  onClick={() => {
                    if (searchParams.get("sort") === "distance") {
                      updateLocalFilter("sort", null);
                    } else {
                      getLocation();
                    }
                  }}
                  icon={MapPin}
                  disabled={locationLoading}
                >
                  {locationLoading ? "Getting location..." : "Near Me"}
                </FilterChip>
              </div>
            </motion.div>
          </div>

          {/* Fixed Bottom Action Bar */}
          <div className="relative border-t border-border/50 bg-background/95 backdrop-blur-xl">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
            <div className="p-6 flex items-center gap-4">
              <Button
                variant="outline"
                onClick={clearAllFilters}
                disabled={!hasActiveFilters}
                className="flex-1 h-12 rounded-xl border-border/50 hover:border-primary/50 disabled:opacity-50"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Clear All
              </Button>
              <Button
                onClick={applyFilters}
                className="flex-1 h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Apply Filters
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
