"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Filter,
  Calendar as CalendarIcon,
  MapPin,
  Search,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface EventFiltersProps {
  searchParams: {
    search?: string;
    location?: string;
    date?: string;
    category?: string;
  };
  onFilterChange: (filters: Record<string, string | undefined>) => void;
}

export function EventFilters({
  searchParams,
  onFilterChange,
}: EventFiltersProps) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [tempFilters, setTempFilters] = useState(searchParams);

  const categories = [
    { id: "food", name: "Food & Dining", emoji: "🍽️" },
    { id: "tech", name: "Technology", emoji: "💻" },
    { id: "art", name: "Arts & Culture", emoji: "🎨" },
    { id: "music", name: "Music & Concerts", emoji: "🎵" },
    { id: "business", name: "Business & Networking", emoji: "💼" },
    { id: "sports", name: "Sports & Gaming", emoji: "🎮" },
    { id: "health", name: "Health & Wellness", emoji: "🏃" },
    { id: "education", name: "Education & Learning", emoji: "📚" },
  ];

  const handleApplyFilters = () => {
    onFilterChange(tempFilters);
    setIsFilterOpen(false);
  };

  const clearAllFilters = () => {
    setTempFilters({});
    onFilterChange({});
    setIsFilterOpen(false);
  };

  const activeFiltersCount = Object.values(searchParams).filter(Boolean).length;

  return (
    <div className="flex items-center gap-3">
      {/* Quick Date Input */}
      <div className="relative">
        <Input
          type="date"
          value={searchParams.date || ""}
          onChange={(e) =>
            onFilterChange({
              ...searchParams,
              date: e.target.value || undefined,
            })
          }
          className={cn(
            "w-36 border-primary/20 hover:bg-primary/5 dark:hover:bg-primary/10 text-sm",
            searchParams.date && "bg-primary/10 border-primary/40"
          )}
          min={new Date().toISOString().split("T")[0]}
        />
        <CalendarIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
      </div>

      {/* Filter Toggle Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsFilterOpen(!isFilterOpen)}
        className={cn(
          "border-primary/20 hover:bg-primary/5 dark:hover:bg-primary/10 relative",
          activeFiltersCount > 0 && "bg-primary/10 border-primary/40",
          isFilterOpen && "bg-primary/10"
        )}
      >
        <Filter className="w-4 h-4 mr-2" />
        Filter
        {activeFiltersCount > 0 && (
          <Badge
            variant="secondary"
            className="absolute -top-2 -right-2 h-5 w-5 p-0 text-xs bg-primary text-primary-foreground"
          >
            {activeFiltersCount}
          </Badge>
        )}
      </Button>

      {/* Active Filters Display */}
      <AnimatePresence>
        {activeFiltersCount > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex flex-wrap gap-2"
          >
            {searchParams.search && (
              <Badge
                variant="secondary"
                className="bg-primary/10 text-primary border-primary/20 flex items-center gap-1"
              >
                Search: {searchParams.search}
                <X
                  className="w-3 h-3 cursor-pointer hover:text-primary"
                  onClick={() => {
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    const { search, ...rest } = searchParams;
                    onFilterChange(rest);
                  }}
                />
              </Badge>
            )}

            {searchParams.location && (
              <Badge
                variant="secondary"
                className="bg-primary/10 text-primary border-primary/20 flex items-center gap-1"
              >
                <MapPin className="w-3 h-3" />
                {searchParams.location}
                <X
                  className="w-3 h-3 cursor-pointer hover:text-primary"
                  onClick={() => {
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    const { location, ...rest } = searchParams;
                    onFilterChange(rest);
                  }}
                />
              </Badge>
            )}

            {searchParams.date && (
              <Badge
                variant="secondary"
                className="bg-primary/10 text-primary border-primary/20 flex items-center gap-1"
              >
                <CalendarIcon className="w-3 h-3" />
                {new Date(searchParams.date).toLocaleDateString()}
                <X
                  className="w-3 h-3 cursor-pointer hover:text-primary"
                  onClick={() => {
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    const { date, ...rest } = searchParams;
                    onFilterChange(rest);
                  }}
                />
              </Badge>
            )}

            {searchParams.category && (
              <Badge
                variant="secondary"
                className="bg-primary/10 text-primary border-primary/20 flex items-center gap-1"
              >
                {categories.find((c) => c.id === searchParams.category)?.name}
                <X
                  className="w-3 h-3 cursor-pointer hover:text-primary"
                  onClick={() => {
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    const { category, ...rest } = searchParams;
                    onFilterChange(rest);
                  }}
                />
              </Badge>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter Panel */}
      <AnimatePresence>
        {isFilterOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm"
            onClick={() => setIsFilterOpen(false)}
          >
            <div
              className="absolute top-20 left-1/2 transform -translate-x-1/2 w-full max-w-md mx-auto p-6 glass-card border border-primary/20 rounded-xl shadow-premium-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="space-y-6">
                {/* Search */}
                <div className="space-y-2">
                  <Label htmlFor="search" className="text-sm font-medium">
                    Search Events
                  </Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="search"
                      placeholder="Search by event name..."
                      value={tempFilters.search || ""}
                      onChange={(e) =>
                        setTempFilters({
                          ...tempFilters,
                          search: e.target.value,
                        })
                      }
                      className="pl-9 border-primary/20 focus:border-primary/40"
                    />
                  </div>
                </div>

                {/* Location */}
                <div className="space-y-2">
                  <Label htmlFor="location" className="text-sm font-medium">
                    Location
                  </Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="location"
                      placeholder="Search by location..."
                      value={tempFilters.location || ""}
                      onChange={(e) =>
                        setTempFilters({
                          ...tempFilters,
                          location: e.target.value,
                        })
                      }
                      className="pl-9 border-primary/20 focus:border-primary/40"
                    />
                  </div>
                </div>

                {/* Categories */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">
                    Event Categories
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    {categories.map((category) => (
                      <motion.button
                        key={category.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          const isSelected =
                            tempFilters.category === category.id;
                          setTempFilters({
                            ...tempFilters,
                            category: isSelected ? undefined : category.id,
                          });
                        }}
                        className={cn(
                          "p-3 rounded-lg border text-left transition-all duration-200",
                          tempFilters.category === category.id
                            ? "border-primary/40 bg-primary/10"
                            : "border-border/50 hover:border-primary/30 hover:bg-primary/5 dark:hover:bg-primary/10"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{category.emoji}</span>
                          <span className="text-sm font-medium">
                            {category.name}
                          </span>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4 border-t border-border/50">
                  <Button
                    variant="outline"
                    onClick={clearAllFilters}
                    className="flex-1 border-primary/20 hover:bg-primary/5 dark:hover:bg-primary/10"
                  >
                    Clear All
                  </Button>
                  <Button
                    onClick={handleApplyFilters}
                    className="flex-1 bg-primary hover:bg-primary/90"
                  >
                    Apply Filters
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
