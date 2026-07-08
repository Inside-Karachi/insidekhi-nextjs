"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSearch } from "@/hooks/useSearch";
import { Search, MapPin, Calendar, ArrowRight, Loader2 } from "lucide-react";

export default function SearchPageContent() {
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get("q");

  const {
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    showResults,
    setShowResults,
    getResultUrl,
  } = useSearch({ limit: 20 });
  const router = useRouter();

  // Seed from URL query only once on mount (or when URL changes via navigation)
  useEffect(() => {
    if (urlQuery) {
      setSearchQuery(urlQuery);
      setShowResults(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlQuery]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setShowResults(true);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Fixed Header Space */}
      <div className="h-20" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        {/* Search Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8 pt-8"
        >
          <h1 className="text-3xl sm:text-4xl lg:text-4xl xl:text-5xl font-bold text-foreground mb-4">
            Search <span className="gradient-text-primary">Karachi</span>
          </h1>
          <p className="text-lg text-muted-foreground">
            Find restaurants, events, guides, and more across the city
          </p>
        </motion.div>

        {/* Search Input */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="relative mb-8"
        >
          <form onSubmit={handleSubmit} className="relative group">
            {/* Glow Effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-primary/10 rounded-2xl blur-xl group-focus-within:blur-2xl transition-all duration-300" />

            {/* Search Container */}
            <div className="relative flex bg-background/80 backdrop-blur-xl border border-border/50 rounded-2xl shadow-premium-lg overflow-hidden">
              <div className="relative flex-1">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search restaurants, events, places..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() =>
                    searchQuery.length >= 2 && setShowResults(true)
                  }
                  className="h-16 pl-14 pr-6 text-lg bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/70"
                />
              </div>

              <Button
                type="submit"
                size="lg"
                className="h-16 px-8 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-l-none rounded-r-2xl shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <span className="mr-2">Search</span>
                <ArrowRight className="h-5 w-5" />
              </Button>
            </div>
          </form>
        </motion.div>

        {/* Search Results Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="min-h-[400px] flex flex-col"
        >
          {isSearching && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
              <span className="text-muted-foreground">Searching...</span>
            </div>
          )}

          {showResults && !isSearching && (
            <div className="space-y-4 flex-1">
              {searchResults.length > 0 ? (
                <>
                  <div className="text-sm text-muted-foreground mb-4">
                    Found {searchResults.length} results for &ldquo;
                    {searchQuery}&rdquo;
                  </div>
                  <div className="grid gap-4">
                    {searchResults.map((result) => (
                      <motion.button
                        key={`${result.type}-${result.id}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={() => {
                          setShowResults(false);
                          try {
                            window.dispatchEvent(
                              new Event("insidekhi:closeDiscovery")
                            );
                          } catch {}
                          try {
                            router.push(getResultUrl(result));
                          } catch {
                            window.location.href = getResultUrl(result);
                          }
                        }}
                        className="w-full p-6 text-left bg-background/50 backdrop-blur-sm border border-border/50 rounded-xl hover:bg-primary/5 dark:hover:bg-primary/10 hover:border-primary/30 transition-all duration-200 group"
                      >
                        <div className="flex items-start space-x-4">
                          <div className="flex-shrink-0 mt-1">
                            {result.type === "listing" && (
                              <div className="w-10 h-10 bg-orange-500/10 rounded-lg flex items-center justify-center">
                                <MapPin className="h-5 w-5 text-orange-500" />
                              </div>
                            )}
                            {result.type === "event" && (
                              <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
                                <Calendar className="h-5 w-5 text-purple-500" />
                              </div>
                            )}
                            {result.type === "post" && (
                              <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                                <Search className="h-5 w-5 text-green-500" />
                              </div>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                              {result.name}
                            </h3>
                            <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                              {result.type === "listing" ? "Place" : result.type}
                            </p>
                          </div>

                          <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all duration-200 flex-shrink-0 mt-1" />
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </>
              ) : searchQuery.length >= 2 ? (
                <div className="text-center py-12 flex-1 flex flex-col justify-center">
                  <Search className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    No results found
                  </h3>
                  <p className="text-muted-foreground">
                    Try searching for restaurants, events, or places in Karachi
                  </p>
                </div>
              ) : (
                <div className="text-center py-12 flex-1 flex flex-col justify-center">
                  <Search className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Start searching
                  </h3>
                  <p className="text-muted-foreground">
                    Enter at least 2 characters to search for places, events,
                    and guides
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Empty state when no search initiated */}
          {!showResults && !isSearching && (
            <div className="text-center py-16 flex-1 flex flex-col justify-center">
              <Search className="h-16 w-16 text-muted-foreground/30 mx-auto mb-6" />
              <h3 className="text-xl font-semibold text-foreground mb-3">
                Discover Karachi
              </h3>
              <p className="text-muted-foreground text-lg max-w-md mx-auto">
                Search for your favorite restaurants, upcoming events, travel
                guides, and hidden gems across the city
              </p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
