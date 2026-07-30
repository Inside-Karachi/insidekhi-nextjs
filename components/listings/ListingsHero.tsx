"use client";

import { motion } from "framer-motion";
import { Search, MapPin, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Database } from "@/types/database";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

type Category = Database["public"]["Tables"]["categories"]["Row"];

interface ListingsHeroProps {
  category: Category;
  totalListings: number;
  searchParams: {
    search?: string;
    sort?: string;
    price?: string;
    rating?: string;
  };
}

export function ListingsHero({ category, totalListings, searchParams }: ListingsHeroProps) {
  const router = useRouter();
  const currentSearchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.search || "");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(currentSearchParams);
    if (searchQuery) {
      params.set("search", searchQuery);
    } else {
      params.delete("search");
    }
    router.push(`/listings/${category.slug}?${params.toString()}`);
  };

  const getCategoryIcon = () => {
    const slug = category.slug.toLowerCase();
    if (slug.includes('eat') || slug.includes('drink') || slug.includes('restaurant')) {
      return '🍽️';
    } else if (slug.includes('stay') || slug.includes('hotel')) {
      return '🏨';
    } else if (slug.includes('shopping') || slug.includes('mall')) {
      return '🛍️';
    } else if (slug.includes('entertainment') || slug.includes('fun')) {
      return '🎮';
    } else if (slug.includes('things') || slug.includes('attraction')) {
      return '🗺️';
    } else {
      return '📍';
    }
  };

  const getCategoryGradient = () => {
    const slug = category.slug.toLowerCase();
    if (slug.includes('eat') || slug.includes('drink') || slug.includes('restaurant')) {
      return 'from-orange-500/20 via-red-500/10 to-transparent';
    } else if (slug.includes('stay') || slug.includes('hotel')) {
      return 'from-blue-500/20 via-indigo-500/10 to-transparent';
    } else if (slug.includes('shopping') || slug.includes('mall')) {
      return 'from-purple-500/20 via-pink-500/10 to-transparent';
    } else if (slug.includes('entertainment') || slug.includes('fun')) {
      return 'from-green-500/20 via-emerald-500/10 to-transparent';
    } else if (slug.includes('things') || slug.includes('attraction')) {
      return 'from-cyan-500/20 via-teal-500/10 to-transparent';
    } else {
      return 'from-gray-500/20 via-slate-500/10 to-transparent';
    }
  };

  return (
    <div className="relative bg-gradient-to-br from-background via-background/95 to-background/90 border-b border-border/50">
      {/* Background Pattern */}
      <div className={`absolute inset-0 bg-gradient-to-br ${getCategoryGradient()}`} />
      
      <div className="relative container mx-auto px-6 lg:px-8 py-16 lg:py-24">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          {/* Category Icon & Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex items-center justify-center space-x-4"
          >
            <div className="text-4xl">{getCategoryIcon()}</div>
            <Badge variant="secondary" className="px-4 py-2 text-sm font-medium">
              {totalListings} {totalListings === 1 ? 'Place' : 'Places'}
            </Badge>
          </motion.div>

          {/* Title & Description */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="space-y-4"
          >
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold tracking-tight">
              {category.name}
              <span className="block text-lg sm:text-xl md:text-2xl lg:text-3xl font-normal text-muted-foreground mt-2">
                in Karachi
              </span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Discover the best {category.name.toLowerCase()} places in Karachi
            </p>
          </motion.div>

          {/* Search Bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="max-w-2xl mx-auto"
          >
            <form onSubmit={handleSearch} className="relative">
              <div className="relative flex bg-background/80 backdrop-blur-xl border border-border/50 rounded-2xl shadow-lg overflow-hidden">
                <div className="relative flex-1">
                  <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder={`Search ${category.name.toLowerCase()}...`}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-14 pl-14 pr-6 text-base bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/70"
                  />
                </div>
                <Button 
                  type="submit"
                  size="lg" 
                  className="h-14 px-8 rounded-l-none rounded-r-2xl font-semibold"
                >
                  Search
                </Button>
              </div>
            </form>
          </motion.div>

          {/* Quick Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex items-center justify-center space-x-8 text-sm text-muted-foreground"
          >
            <div className="flex items-center space-x-2">
              <MapPin className="h-4 w-4" />
              <span>Karachi Wide</span>
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4" />
              <span>Smart Filters</span>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
