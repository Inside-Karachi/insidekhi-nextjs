"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { User, Search, X, UserCheck, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface Organizer {
  id: string;
  full_name: string;
  username?: string | null;
  avatar_url?: string | null;
  role: string;
}

interface OrganizerSelectProps {
  selectedOrganizerId: string;
  onOrganizerSelect: (organizerId: string) => void;
  eventId: string | number;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
}

export function OrganizerSelect({
  selectedOrganizerId,
  onOrganizerSelect,
  eventId,
  placeholder = "Search for organizer by name",
  disabled = false,
  required = false,
}: OrganizerSelectProps) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<Organizer[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [selectedOrganizer, setSelectedOrganizer] =
    React.useState<Organizer | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
  const { toast } = useToast();

  // Fetch selected organizer details when selectedOrganizerId changes
  React.useEffect(() => {
    console.log(
      "[OrganizerSelect] eventId:",
      eventId,
      "selectedOrganizerId:",
      selectedOrganizerId,
    );
    if (selectedOrganizerId && selectedOrganizerId !== selectedOrganizer?.id) {
      const fetchSelectedOrganizer = async () => {
        const url = `/api/admin/events/${eventId}/organizers?q=&organizerId=${selectedOrganizerId}`;
        try {
          const res = await fetch(url);
          if (res.ok) {
            const data = await res.json();
            const user = (data.users || []).find(
              (u: { id: string }) => u.id === selectedOrganizerId,
            );
            if (user) {
              const organizer: Organizer = {
                id: user.id,
                full_name:
                  user.full_name || user.username || "Unknown Organizer",
                username: user.username,
                avatar_url: user.avatar_url,
                role: user.role,
              };
              setSelectedOrganizer(organizer);
              setQuery(organizer.full_name);
            }
          } else {
            console.error(
              "[OrganizerSelect] Error fetching selected organizer, status:",
              res.status,
            );
          }
        } catch (error) {
          console.error(
            "[OrganizerSelect] Error fetching selected organizer:",
            error,
          );
        }
      };
      fetchSelectedOrganizer();
    } else if (!selectedOrganizerId) {
      setSelectedOrganizer(null);
      setQuery("");
    }
  }, [selectedOrganizerId, selectedOrganizer?.id, eventId]);

  // Search for organizers
  const searchOrganizers = React.useCallback(
    async (searchQuery: string) => {
      if (
        eventId === undefined ||
        eventId === null ||
        eventId === "" ||
        !searchQuery.trim()
      ) {
        setResults([]);
        setIsDropdownOpen(false);
        return;
      }
      setIsLoading(true);
      const url = `/api/admin/events/${eventId}/organizers?q=${encodeURIComponent(
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
            throw new Error(data.error || "Failed to search organizers");
          }
        } else {
          throw new Error(
            "Failed to search organizers, status: " + response.status,
          );
        }
      } catch (error) {
        console.error("[OrganizerSelect] Error searching organizers:", error);
        toast({
          title: "Error",
          description: "Failed to search for organizers",
          variant: "destructive",
        });
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    },
    [toast, eventId],
  );

  // Debounced search
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (query && !selectedOrganizer) {
        searchOrganizers(query);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, selectedOrganizer, searchOrganizers]);

  const handleSelectOrganizer = (organizer: Organizer) => {
    setSelectedOrganizer(organizer);
    setQuery(organizer.full_name);
    onOrganizerSelect(organizer.id);
    setIsDropdownOpen(false);
    setResults([]);
  };

  const handleClearSelection = () => {
    setSelectedOrganizer(null);
    setQuery("");
    onOrganizerSelect("");
    setIsDropdownOpen(false);
    setResults([]);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    // If user is typing and we have a selected organizer, clear selection
    if (selectedOrganizer && value !== selectedOrganizer.full_name) {
      setSelectedOrganizer(null);
      onOrganizerSelect("");
    }
  };

  // Only disable if eventId is undefined, null, or empty string (not 0 or '0')
  const isOrganizerSelectDisabled =
    disabled || eventId === undefined || eventId === null || eventId === "";

  React.useEffect(() => {
    console.log(
      "[OrganizerSelect] Render: eventId=",
      eventId,
      "isOrganizerSelectDisabled=",
      isOrganizerSelectDisabled,
    );
  }, [eventId, isOrganizerSelectDisabled]);

  return (
    <div className="space-y-3">
      <Label
        htmlFor="organizer-select"
        className="text-sm font-semibold text-foreground/90"
      >
        Event Organizer{" "}
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
            animate={{ opacity: selectedOrganizer ? 0.1 : 0 }}
          />

          <div className="relative">
            <User
              className={cn(
                "absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 transition-colors duration-200",
                selectedOrganizer
                  ? "text-primary"
                  : "text-muted-foreground group-hover:text-primary",
              )}
            />

            <Input
              id="organizer-select"
              type="text"
              value={query}
              onChange={handleInputChange}
              placeholder={placeholder}
              disabled={isOrganizerSelectDisabled}
              className={cn(
                "pl-12 pr-12 h-12 text-sm font-medium transition-all duration-200",
                "bg-background/60 hover:bg-background/80 focus:bg-background",
                "border-border/50 hover:border-primary/30 focus:border-primary/50",
                "rounded-xl shadow-sm hover:shadow-md focus:shadow-lg",
                "focus:ring-2 focus:ring-primary/20 focus:ring-offset-1",
                selectedOrganizer && "border-primary/50 bg-primary/5",
              )}
              onFocus={() => {
                if (results.length > 0 && !selectedOrganizer) {
                  setIsDropdownOpen(true);
                }
              }}
            />

            {/* Right side controls */}
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
              {selectedOrganizer && (
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

              {!selectedOrganizer && query && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-7 w-7 p-0 rounded-lg transition-all duration-200",
                    "hover:bg-primary/10 hover:text-primary",
                    "focus:ring-2 focus:ring-primary/20",
                  )}
                  onClick={() => searchOrganizers(query)}
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
                {results.map((organizer, index) => (
                  <motion.button
                    key={organizer.id}
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
                    onClick={() => handleSelectOrganizer(organizer)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 relative">
                        {organizer.avatar_url ? (
                          <motion.img
                            src={organizer.avatar_url}
                            alt={organizer.full_name}
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
                            {organizer.full_name}
                          </p>
                          {selectedOrganizerId === organizer.id && (
                            <motion.div
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              className="text-primary"
                            >
                              <UserCheck className="h-4 w-4" />
                            </motion.div>
                          )}
                        </div>

                        {organizer.username && (
                          <p className="text-xs text-muted-foreground truncate group-hover:text-primary/70 transition-colors duration-200">
                            @{organizer.username}
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
                            {organizer.role.replace("_", " ")}
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
                  Searching organizers...
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
                  No organizers found
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Try a different search term
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Selected organizer display */}
      <AnimatePresence>
        {selectedOrganizer && (
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
              {selectedOrganizer.avatar_url ? (
                <motion.img
                  src={selectedOrganizer.avatar_url}
                  alt={selectedOrganizer.full_name}
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
                  {selectedOrganizer.full_name}
                </h4>
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, duration: 0.3 }}
                >
                  <UserCheck className="h-4 w-4 text-primary flex-shrink-0" />
                </motion.div>
              </div>

              {selectedOrganizer.username && (
                <p className="text-xs text-muted-foreground truncate mt-1">
                  @{selectedOrganizer.username}
                </p>
              )}

              <div className="flex items-center gap-2 mt-2">
                <span
                  className={cn(
                    "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold",
                    "bg-primary/20 text-primary border border-primary/30",
                  )}
                >
                  {selectedOrganizer.role.replace("_", " ")}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
