"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Home, Search, Filter, X, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { FilterPanel, type FilterState } from "./FilterPanel";
import { useFilterData } from "@/hooks/useFilterData";

interface Bank { id: number; name: string }
interface Category { id: number; name: string; slug: string; parent_id: number | null }

interface PremiumListingsHeaderProps {
  totalListings: number;
  banks: Bank[];
  categories: Category[];
}

function buildUrl(base: string, params: URLSearchParams) {
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export function PremiumListingsHeader({ totalListings, banks, categories }: PremiumListingsHeaderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);

  // Get dynamic sort options from database
  const { sortOptions } = useFilterData();

  // Count active filters for badge
  const activeFilterCount = Array.from(searchParams.entries()).filter(([key]) => 
    key !== 'search' && searchParams.get(key)
  ).length;

  // Convert current URL params to filter state
  const currentFilters: FilterState = {
    sort: searchParams.get('sort'),
    deals: searchParams.get('deals') === 'true',
    open_now: searchParams.get('open_now') === 'true',
    near: searchParams.get('near') === '1',
    bank: searchParams.get('bank'),
    card: searchParams.get('card'),
    category: searchParams.get('category'),
    subCategory: searchParams.get('sub'),
  };

  const selectedCategorySlug = searchParams.get("category") || "all";
  const parentCategory = categories.find(c => c.slug === selectedCategorySlug) || null;

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

  const handleApplyFilters = (filters: FilterState) => {
    const params = new URLSearchParams();
    
    // Keep search if it exists
    if (searchQuery && searchQuery.trim()) {
      params.set("search", searchQuery.trim());
    }
    
    // Apply all other filters
    if (filters.sort) params.set('sort', filters.sort);
    if (filters.deals) params.set('deals', 'true');
    if (filters.open_now) params.set('open_now', 'true');
    if (filters.near) params.set('near', '1');
    if (filters.bank) params.set('bank', filters.bank);
    if (filters.card) params.set('card', filters.card);
    if (filters.category) params.set('category', filters.category);
    if (filters.subCategory) params.set('sub', filters.subCategory);

    router.push(buildUrl(pathname, params));
    setIsFilterPanelOpen(false);
  };

  return (
    <>
      {/* Header - Fixed Spacing */}
      <div className="relative mt-20 mb-6">
        <div className="container mx-auto px-6 lg:px-8">
          {/* Compact glassmorphism container */}
          <div className="relative rounded-2xl bg-gradient-to-br from-background/98 via-background/95 to-background/92 backdrop-blur-xl border border-border/50 shadow-lg shadow-black/5 dark:shadow-black/20 overflow-hidden">
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
                    Listings
                  </span>
                  {parentCategory && parentCategory.slug !== 'all' && (
                    <>
                      <span className="text-border/60 text-xs">/</span>
                      <span className="px-2.5 py-1 rounded-lg bg-muted/20 text-foreground/80 text-xs">
                        {parentCategory.name}
                      </span>
                    </>
                  )}
                </div>
                
                <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-primary/8 to-primary/4 border border-primary/20">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  <span className="text-primary font-semibold text-xs">
                    {totalListings} places
                  </span>
                </div>
              </div>

              {/* Compact Title + Controls */}
              <div className="space-y-4">
                <div className="text-center lg:text-left">
                  <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight leading-tight mb-2">
                    <span className="bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                      Discover Karachi
                    </span>
                  </h1>
                  <p className="text-sm text-muted-foreground max-w-xl mx-auto lg:mx-0">
                    Premium directory with smart filters to find exactly what you&apos;re looking for.
                  </p>
                </div>
                
                {/* Compact Search & Filter Bar */}
                <div className="flex items-center gap-3 max-w-2xl mx-auto lg:mx-0">
                  {/* Refined Search */}
                  <form onSubmit={handleSearch} className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search restaurants, hotels, attractions..."
                        className="w-full h-11 pl-10 pr-10 text-sm rounded-xl bg-background/60 border border-border/60 hover:border-border/80 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery("")}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-md hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-all"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </form>

                  {/* Refined Filters Button */}
                  <button
                    onClick={() => setIsFilterPanelOpen(true)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 border",
                      activeFilterCount > 0 
                        ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/30" 
                        : "bg-background/60 hover:bg-background/80 border-border/60 hover:border-border/80"
                    )}
                  >
                    <Filter className="h-4 w-4" />
                    <span>Filters</span>
                    {activeFilterCount > 0 && (
                      <div className="flex items-center justify-center w-5 h-5 rounded-full bg-background/20 text-xs font-bold">
                        {activeFilterCount}
                      </div>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Panel */}
      {isFilterPanelOpen && (
        <FilterPanel
          banks={banks}
          categories={categories}
          sortOptions={sortOptions}
          initialFilters={currentFilters}
          onApply={handleApplyFilters}
          onClose={() => setIsFilterPanelOpen(false)}
        />
      )}
    </>
  );
}
