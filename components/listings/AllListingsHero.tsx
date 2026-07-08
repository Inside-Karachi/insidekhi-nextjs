"use client";

import { motion } from "framer-motion";
import { Search, MapPin, Filter, Compass } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

interface AllListingsHeroProps {
  totalListings: number;
  searchParams: {
    search?: string;
    sort?: string;
    price?: string;
    rating?: string;
    category?: string;
  };
}

export function AllListingsHero({ totalListings, searchParams }: AllListingsHeroProps) {
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
    router.push(`/listings?${params.toString()}`);
  };

  return (
    <div className="relative bg-gradient-to-br from-background via-background/95 to-background/90 border-b border-border/50">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-primary/2 to-transparent" />
      
      <div className="relative container mx-auto px-6 lg:px-8 pt-36 lg:pt-44 pb-16 lg:pb-24">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          {/* Icon & Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex items-center justify-center space-x-4"
          >
            <div className="text-4xl">🗺️</div>
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
              Discover Karachi
              <span className="block text-lg sm:text-xl md:text-2xl lg:text-3xl font-normal text-muted-foreground mt-2">
                {searchParams.search ? `Results for "${searchParams.search}"` : "All the amazing places in the city"}
              </span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              From hidden gems to popular destinations, explore everything Karachi has to offer. 
              Find restaurants, hotels, entertainment, shopping, and more.
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
                    placeholder="Search restaurants, hotels, attractions..."
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

          {/* Quick Categories */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-wrap items-center justify-center gap-3"
          >
            <span className="text-sm text-muted-foreground mr-2">Popular:</span>
            {[
              { name: "Restaurants", slug: "eat-drink", icon: "🍽️" },
              { name: "Hotels", slug: "where-to-stay", icon: "🏨" },
              { name: "Shopping", slug: "shopping", icon: "🛍️" },
              { name: "Entertainment", slug: "entertainment", icon: "🎮" },
              { name: "Attractions", slug: "things-to-do", icon: "🗺️" },
            ].map((category) => (
              <Button
                key={category.slug}
                variant="outline"
                size="sm"
                onClick={() => router.push(`/listings/${category.slug}`)}
                className="rounded-full px-4 py-2 text-sm hover:bg-primary hover:text-primary-foreground transition-colors"
              >
                <span className="mr-2">{category.icon}</span>
                {category.name}
              </Button>
            ))}
          </motion.div>

          {/* Quick Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex items-center justify-center space-x-8 text-sm text-muted-foreground"
          >
            <div className="flex items-center space-x-2">
              <MapPin className="h-4 w-4" />
              <span>Citywide Coverage</span>
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4" />
              <span>Smart Filters</span>
            </div>
            <div className="flex items-center space-x-2">
              <Compass className="h-4 w-4" />
              <span>Local Insights</span>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
