"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Home, Search, Filter, X, Sparkles, Calendar as CalendarIcon, Grid3X3, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { motion } from "framer-motion";

interface PremiumEventsHeaderProps {
  totalEvents: number;
  onViewChange?: (cardsPerRow: number, itemsPerPage: number) => void;
  cardsPerRow?: number;
  itemsPerPage?: number;
}

const ITEMS_PER_PAGE_OPTIONS = [9, 12, 18, 24];
const CARDS_PER_ROW_OPTIONS = [
  { value: 2, label: "2 per row" },
  { value: 3, label: "3 per row" },
  { value: 4, label: "4 per row" },
];

function buildUrl(base: string, params: URLSearchParams) {
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export function PremiumEventsHeader({ 
  totalEvents, 
  onViewChange,
  cardsPerRow = 3,
  itemsPerPage = 9
}: PremiumEventsHeaderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);

  // Count active filters for badge
  const activeFilterCount = Array.from(searchParams.entries()).filter(([key]) => 
    key !== 'search' && searchParams.get(key)
  ).length;

  const selectedCategorySlug = searchParams.get("category") || "all";

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams);
    if (searchQuery && searchQuery.trim()) {
      params.set("search", searchQuery.trim());
    } else {
      params.delete("search");
    }
    router.push(buildUrl(pathname, params));
  };

  const handleDateChange = (date: string) => {
    const params = new URLSearchParams(searchParams);
    if (date) {
      params.set("date", date);
    } else {
      params.delete("date");
    }
    router.push(buildUrl(pathname, params));
  };

  const clearAllFilters = () => {
    const params = new URLSearchParams();
    // Keep only the search if it exists
    if (searchQuery && searchQuery.trim()) {
      params.set("search", searchQuery.trim());
    }
    router.push(buildUrl(pathname, params));
  };

  const selectedRowOption = CARDS_PER_ROW_OPTIONS.find(
    (option) => option.value === cardsPerRow
  );

  return (
    <div className="relative mt-20 mb-6" id="events-list">
      <div className="container mx-auto px-6 lg:px-8">
        {/* Glassmorphism container */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative rounded-2xl bg-gradient-to-br from-background/98 via-background/95 to-background/92 backdrop-blur-xl border border-border/50 shadow-lg shadow-black/5 dark:shadow-black/20 overflow-hidden"
        >
          {/* Subtle gradient accent */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          
          <div className="relative p-6 space-y-5">
            {/* Compact Breadcrumbs */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm">
                <button 
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/30 hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-all duration-200" 
                  onClick={() => router.push('/')}
                >
                  <Home className="h-3.5 w-3.5" />
                  <span className="text-xs font-medium">Home</span>
                </button>
                <span className="text-border/60 text-xs">/</span>
                <span className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary font-semibold text-xs border border-primary/20">
                  Events
                </span>
                {selectedCategorySlug !== 'all' && (
                  <>
                    <span className="text-border/60 text-xs">/</span>
                    <span className="px-2.5 py-1 rounded-lg bg-muted/20 text-foreground/80 text-xs capitalize">
                      {selectedCategorySlug}
                    </span>
                  </>
                )}
              </div>
              
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-primary/8 to-primary/4 border border-primary/20">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span className="text-primary font-semibold text-xs">
                  {totalEvents} {totalEvents === 1 ? 'event' : 'events'}
                </span>
              </div>
            </div>

            {/* Title + Description */}
            <div className="space-y-4">
              <div className="text-center lg:text-left">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight leading-tight mb-2">
                  <span className="bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                    Discover Amazing Events
                  </span>
                </h1>
                <p className="text-sm text-muted-foreground max-w-xl mx-auto lg:mx-0">
                  From cultural festivals to tech meetups, find your next unforgettable experience in Karachi.
                </p>
              </div>
              
              {/* Search & Filter Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 max-w-4xl mx-auto lg:mx-0">
                {/* Search */}
                <form onSubmit={handleSearch} className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search events..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full h-11 pl-10 pr-4 rounded-xl border border-border/50 bg-background/60 backdrop-blur-sm text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all duration-200"
                    />
                  </div>
                </form>

                {/* Date Picker */}
                <div className="relative">
                  <input
                    type="date"
                    value={searchParams.get("date") || ""}
                    onChange={(e) => handleDateChange(e.target.value)}
                    className={cn(
                      "h-11 w-36 px-3 pr-10 rounded-xl border border-border/50 bg-background/60 backdrop-blur-sm text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all duration-200",
                      searchParams.get("date") && "bg-primary/5 border-primary/30"
                    )}
                    min={new Date().toISOString().split("T")[0]}
                  />
                  <CalendarIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>

                {/* Filter Button */}
                <Button
                  variant="outline"
                  onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
                  className={cn(
                    "h-11 px-4 rounded-xl border-border/50 bg-background/60 backdrop-blur-sm hover:bg-primary/5 dark:hover:bg-primary/10 transition-all duration-200 relative",
                    activeFilterCount > 0 && "bg-primary/10 border-primary/30",
                    isFilterPanelOpen && "bg-primary/10"
                  )}
                >
                  <Filter className="w-4 h-4 mr-2" />
                  Filter
                  {activeFilterCount > 0 && (
                    <Badge
                      variant="secondary"
                      className="absolute -top-2 -right-2 h-5 w-5 p-0 text-xs bg-primary text-primary-foreground"
                    >
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>

                {/* View Controls */}
                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="hidden sm:flex items-center gap-2 h-11 px-3 rounded-xl border-border/50 bg-background/60 backdrop-blur-sm hover:bg-muted/50 transition-all duration-200"
                      >
                        <Grid3X3 className="h-4 w-4" />
                        {selectedRowOption?.label}
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-[140px]">
                      {CARDS_PER_ROW_OPTIONS.map((option) => (
                        <DropdownMenuItem
                          key={option.value}
                          onClick={() => onViewChange?.(option.value, itemsPerPage)}
                          className={cn(
                            "cursor-pointer",
                            cardsPerRow === option.value && "bg-accent"
                          )}
                        >
                          {option.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2 h-11 px-3 rounded-xl border-border/50 bg-background/60 backdrop-blur-sm hover:bg-muted/50 transition-all duration-200"
                      >
                        {itemsPerPage}
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {ITEMS_PER_PAGE_OPTIONS.map((option) => (
                        <DropdownMenuItem
                          key={option}
                          onClick={() => onViewChange?.(cardsPerRow, option)}
                          className={cn(
                            "cursor-pointer",
                            itemsPerPage === option && "bg-accent"
                          )}
                        >
                          {option} per page
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Active Filters Display */}
              {activeFilterCount > 0 && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/20"
                >
                  <span className="text-xs text-muted-foreground mr-2">Active filters:</span>
                  {searchParams.get("date") && (
                    <Badge variant="secondary" className="text-xs">
                      Date: {new Date(searchParams.get("date")!).toLocaleDateString()}
                      <button 
                        onClick={() => handleDateChange("")}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                  {searchParams.get("category") && (
                    <Badge variant="secondary" className="text-xs capitalize">
                      {searchParams.get("category")}
                      <button 
                        onClick={() => {
                          const params = new URLSearchParams(searchParams);
                          params.delete("category");
                          router.push(buildUrl(pathname, params));
                        }}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                  {searchParams.get("location") && (
                    <Badge variant="secondary" className="text-xs">
                      Location: {searchParams.get("location")}
                      <button 
                        onClick={() => {
                          const params = new URLSearchParams(searchParams);
                          params.delete("location");
                          router.push(buildUrl(pathname, params));
                        }}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={clearAllFilters}
                    className="text-xs h-6 px-2 text-muted-foreground hover:text-foreground"
                  >
                    Clear all
                  </Button>
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
