"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { User, Search, X, UserCheck, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface Owner {
  id: string;
  full_name: string;
  username?: string | null;
  avatar_url?: string | null;
  role: string;
}

interface OwnerSelectProps {
  selectedOwnerId: string;
  onOwnerSelect: (ownerId: string) => void;
  listingId: string | number;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
}

export function OwnerSelect({
  selectedOwnerId,
  onOwnerSelect,
  listingId,
  placeholder = "Search for business owner by name",
  disabled = false,
  required = false,
}: OwnerSelectProps) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<Owner[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [selectedOwner, setSelectedOwner] = React.useState<Owner | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
  const { toast } = useToast();

  // Fetch selected owner details when selectedOwnerId changes
  React.useEffect(() => {
    if (selectedOwnerId && selectedOwnerId !== selectedOwner?.id) {
      const fetchSelectedOwner = async () => {
        const url = `/api/admin/listings/${listingId}/owners?q=&ownerId=${selectedOwnerId}`;
        try {
          const res = await fetch(url);
          if (res.ok) {
            const data = await res.json();
            const user = (data.users || []).find(
              (u: { id: string }) => u.id === selectedOwnerId,
            );
            if (user) {
              const owner: Owner = {
                id: user.id,
                full_name: user.full_name || user.username || "Unknown Owner",
                username: user.username,
                avatar_url: user.avatar_url,
                role: user.role,
              };
              setSelectedOwner(owner);
              setQuery(owner.full_name);
            }
          } else {
            console.error(
              "[OwnerSelect] Error fetching selected owner, status:",
              res.status,
            );
          }
        } catch (error) {
          console.error("[OwnerSelect] Error fetching selected owner:", error);
        }
      };
      fetchSelectedOwner();
    } else if (!selectedOwnerId) {
      setSelectedOwner(null);
      setQuery("");
    }
  }, [selectedOwnerId, selectedOwner?.id, listingId]);

  // Search for owners
  const searchOwners = React.useCallback(
    async (searchQuery: string) => {
      if (
        listingId === undefined ||
        listingId === null ||
        listingId === "" ||
        !searchQuery.trim()
      ) {
        setResults([]);
        setIsDropdownOpen(false);
        return;
      }
      setIsLoading(true);
      const url = `/api/admin/listings/${listingId}/owners?q=${encodeURIComponent(
        searchQuery,
      )}`;
      try {
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setResults(data.users || []);
            setIsDropdownOpen(true);
          } else {
            throw new Error(data.error || "Failed to search owners");
          }
        } else {
          throw new Error(
            "Failed to search owners, status: " + response.status,
          );
        }
      } catch (error) {
        console.error("[OwnerSelect] Error searching owners:", error);
        toast({
          title: "Error",
          description: "Failed to search for owners",
          variant: "destructive",
        });
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    },
    [toast, listingId],
  );

  // Debounced search
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (query && !selectedOwner) {
        searchOwners(query);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, selectedOwner, searchOwners]);

  const handleSelectOwner = (owner: Owner) => {
    setSelectedOwner(owner);
    setQuery(owner.full_name);
    onOwnerSelect(owner.id);
    setIsDropdownOpen(false);
    setResults([]);
  };

  const handleClearSelection = () => {
    setSelectedOwner(null);
    setQuery("");
    onOwnerSelect("");
    setIsDropdownOpen(false);
    setResults([]);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    // If user is typing and we have a selected owner, clear selection
    if (selectedOwner && value !== selectedOwner.full_name) {
      setSelectedOwner(null);
      onOwnerSelect("");
    }
  };

  // Only disable if listingId is undefined, null, or empty string (not 0 or '0')
  const isOwnerSelectDisabled =
    disabled ||
    listingId === undefined ||
    listingId === null ||
    listingId === "";

  return (
    <div className="space-y-3">
      <Label
        htmlFor="owner-select"
        className="text-sm font-semibold text-foreground/90"
      >
        Business Owner{" "}
        {required && <span className="text-red-500 ml-1">*</span>}
      </Label>

      <div className="relative">
        {/* Input Container */}
        <div className="relative group">
          <motion.div
            className={cn(
              "absolute inset-0 rounded-xl bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20",
              "opacity-0 group-hover:opacity-100 transition-opacity duration-300",
              "blur-sm group-hover:blur-none",
            )}
            initial={false}
            animate={{ opacity: selectedOwner ? 0.1 : 0 }}
          />

          <div className="relative">
            <User
              className={cn(
                "absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 transition-colors duration-200",
                selectedOwner
                  ? "text-primary"
                  : "text-muted-foreground group-hover:text-primary",
              )}
            />

            <Input
              id="owner-select"
              type="text"
              value={query}
              onChange={handleInputChange}
              placeholder={placeholder}
              disabled={isOwnerSelectDisabled}
              className={cn(
                "pl-12 pr-12 h-12 text-sm font-medium transition-all duration-200",
                "bg-background/60 hover:bg-background/80 focus:bg-background",
                "border-border/50 hover:border-primary/30 focus:border-primary/50",
                "rounded-xl shadow-sm hover:shadow-md focus:shadow-lg",
                "focus:ring-2 focus:ring-primary/20 focus:ring-offset-1",
                selectedOwner && "border-primary/50 bg-primary/5",
              )}
              onFocus={() => {
                if (results.length > 0 && !selectedOwner) {
                  setIsDropdownOpen(true);
                }
              }}
            />

            {/* Right side controls */}
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
              {selectedOwner && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                >
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-7 w-7 p-0 rounded-lg transition-all duration-200",
                      "hover:bg-destructive/10 hover:text-destructive",
                      "focus:ring-2 focus:ring-destructive/20",
                    )}
                    onClick={handleClearSelection}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </motion.div>
              )}

              {!selectedOwner && query && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-7 w-7 p-0 rounded-lg transition-all duration-200",
                    "hover:bg-primary/10 hover:text-primary",
                    "focus:ring-2 focus:ring-primary/20",
                  )}
                  onClick={() => searchOwners(query)}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Dropdown results */}
        <AnimatePresence>
          {isDropdownOpen && results.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className={cn(
                "absolute z-[100] w-full mt-2",
                "bg-popover/95 backdrop-blur-xl border border-border/50",
                "rounded-xl shadow-2xl shadow-black/10 dark:shadow-black/20",
                "max-h-64 overflow-y-auto",
              )}
            >
              <div className="p-2 space-y-1">
                {results.map((owner, index) => (
                  <motion.button
                    key={owner.id}
                    type="button"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05, duration: 0.2 }}
                    className={cn(
                      "w-full p-3 text-left rounded-lg transition-all duration-200",
                      "hover:bg-primary/10 hover:text-primary focus:outline-none focus:bg-primary/10 focus:text-primary",
                      "hover:scale-[1.02] hover:shadow-sm",
                      "border border-transparent hover:border-primary/20",
                      "group",
                    )}
                    onClick={() => handleSelectOwner(owner)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 relative">
                        {owner.avatar_url ? (
                          <motion.img
                            src={owner.avatar_url}
                            alt={owner.full_name}
                            className="w-10 h-10 rounded-full object-cover ring-2 ring-background group-hover:ring-primary/30 transition-all duration-200"
                            whileHover={{ scale: 1.05 }}
                          />
                        ) : (
                          <motion.div
                            className={cn(
                              "w-10 h-10 rounded-full flex items-center justify-center",
                              "bg-gradient-to-br from-primary/20 to-primary/10",
                              "ring-2 ring-background group-hover:ring-primary/30",
                              "transition-all duration-200",
                            )}
                            whileHover={{ scale: 1.05 }}
                          >
                            <User className="h-5 w-5 text-primary" />
                          </motion.div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors duration-200">
                            {owner.full_name}
                          </p>
                          {selectedOwnerId === owner.id && (
                            <motion.div
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              className="text-primary"
                            >
                              <UserCheck className="h-4 w-4" />
                            </motion.div>
                          )}
                        </div>

                        {owner.username && (
                          <p className="text-xs text-muted-foreground truncate group-hover:text-primary/70 transition-colors duration-200">
                            @{owner.username}
                          </p>
                        )}

                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className={cn(
                              "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                              "bg-primary/10 text-primary group-hover:bg-primary/20",
                              "transition-colors duration-200",
                            )}
                          >
                            {owner.role.replace("_", " ")}
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading state */}
        <AnimatePresence>
          {isLoading && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className={cn(
                "absolute z-[100] w-full mt-2 p-4",
                "bg-popover/95 backdrop-blur-xl border border-border/50",
                "rounded-xl shadow-2xl shadow-black/10 dark:shadow-black/20",
              )}
            >
              <div className="flex items-center justify-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-sm font-medium text-muted-foreground">
                  Searching owners...
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* No results */}
        <AnimatePresence>
          {!isLoading && query && results.length === 0 && isDropdownOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className={cn(
                "absolute z-[100] w-full mt-2 p-4",
                "bg-popover/95 backdrop-blur-xl border border-border/50",
                "rounded-xl shadow-2xl shadow-black/10 dark:shadow-black/20",
              )}
            >
              <div className="text-center">
                <Search className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm font-medium text-muted-foreground">
                  No owners found
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Try a different search term
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Selected owner display */}
      <AnimatePresence>
        {selectedOwner && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={cn(
              "flex items-center gap-4 p-4 rounded-xl",
              "bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10",
              "border border-primary/20 shadow-lg shadow-primary/10",
              "backdrop-blur-sm",
            )}
          >
            <div className="flex-shrink-0 relative">
              {selectedOwner.avatar_url ? (
                <motion.img
                  src={selectedOwner.avatar_url}
                  alt={selectedOwner.full_name}
                  className="w-12 h-12 rounded-full object-cover ring-2 ring-primary/30"
                  whileHover={{ scale: 1.05 }}
                  transition={{ duration: 0.2 }}
                />
              ) : (
                <motion.div
                  className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center",
                    "bg-gradient-to-br from-primary/20 to-primary/10",
                    "ring-2 ring-primary/30",
                  )}
                  whileHover={{ scale: 1.05 }}
                  transition={{ duration: 0.2 }}
                >
                  <User className="h-6 w-6 text-primary" />
                </motion.div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-foreground truncate">
                  {selectedOwner.full_name}
                </h4>
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, duration: 0.3 }}
                >
                  <UserCheck className="h-4 w-4 text-primary flex-shrink-0" />
                </motion.div>
              </div>

              {selectedOwner.username && (
                <p className="text-xs text-muted-foreground truncate mt-1">
                  @{selectedOwner.username}
                </p>
              )}

              <div className="flex items-center gap-2 mt-2">
                <span
                  className={cn(
                    "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold",
                    "bg-primary/20 text-primary border border-primary/30",
                  )}
                >
                  {selectedOwner.role.replace("_", " ")}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
