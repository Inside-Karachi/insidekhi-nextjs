"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PremiumEventFilters } from "@/components/events/PremiumEventFilters";
import { EventsGrid } from "@/components/events/EventsGridPremium";
import { Event } from "@/types/events.types";
import { motion } from "framer-motion";

interface EventsContentProps {
  initialEvents: Event[];
  allEvents: Event[];
}

export function EventsContent({
  initialEvents,
  allEvents,
}: EventsContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filteredEvents, setFilteredEvents] = useState(initialEvents); // Get current filters from URL
  const currentFilters = useMemo(
    () => ({
      search: searchParams.get("search") || undefined,
      location: searchParams.get("location") || undefined,
      date: searchParams.get("date") || undefined,
      category: searchParams.get("category") || undefined,
    }),
    [searchParams],
  );

  // Filter events based on current filters
  useEffect(() => {
    let filtered = [...allEvents];

    if (currentFilters.search) {
      filtered = filtered.filter(
        (event) =>
          event.name
            .toLowerCase()
            .includes(currentFilters.search!.toLowerCase()) ||
          event.description
            ?.toLowerCase()
            .includes(currentFilters.search!.toLowerCase()),
      );
    }

    if (currentFilters.location) {
      filtered = filtered.filter(
        (event) =>
          event.address
            ?.toLowerCase()
            .includes(currentFilters.location!.toLowerCase()) ||
          event.location_name
            ?.toLowerCase()
            .includes(currentFilters.location!.toLowerCase()),
      );
    }

    if (currentFilters.date) {
      const filterDate = new Date(currentFilters.date);
      const nextDay = new Date(filterDate.getTime() + 24 * 60 * 60 * 1000);
      filtered = filtered.filter((event) => {
        const eventDate = new Date(event.start_time);
        return eventDate >= filterDate && eventDate < nextDay;
      });
    }

    if (currentFilters.category) {
      // Simple category matching based on event name/description
      const categoryKeywords: Record<string, string[]> = {
        food: ["food", "festival", "dining", "restaurant", "cafe"],
        tech: ["tech", "meetup", "startup", "technology", "development"],
        art: ["art", "culture", "exhibition", "gallery"],
        music: ["music", "concert", "fusion", "performance"],
        business: ["business", "entrepreneur", "corporate"],
        networking: ["networking", "meetup", "community", "social"],
        sports: ["gaming", "tournament", "sport", "competition"],
        health: ["health", "wellness", "fitness", "expo"],
        education: ["workshop", "learning", "education", "training"],
        entertainment: ["entertainment", "show", "comedy", "standup", "film"],
      };

      const keywords =
        categoryKeywords[
          currentFilters.category as keyof typeof categoryKeywords
        ];
      if (keywords) {
        filtered = filtered.filter((event) => {
          const searchText = `${event.name} ${event.description}`.toLowerCase();
          return keywords.some((keyword) => searchText.includes(keyword));
        });
      }
    }

    setFilteredEvents(filtered);
  }, [currentFilters, allEvents]);

  const handleFilterChange = (filters: Record<string, string | undefined>) => {
    const params = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      }
    });

    const queryString = params.toString();
    router.push(`/events${queryString ? "?" + queryString : ""}`);
  };

  const activeFiltersCount =
    Object.values(currentFilters).filter(Boolean).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.5, ease: "easeOut" }}
    >
      {/* Event Filters */}
      <div className="mb-8">
        <PremiumEventFilters
          searchParams={currentFilters}
          onFilterChange={handleFilterChange}
          eventsCount={filteredEvents.length}
        />
      </div>

      {/* Events Grid */}
      {filteredEvents.length > 0 ? (
        <EventsGrid events={filteredEvents} searchParams={currentFilters} />
      ) : (
        <div className="text-center py-16">
          <div className="w-24 h-24 mx-auto mb-6 bg-muted/30 rounded-full flex items-center justify-center">
            <div className="w-12 h-12 text-muted-foreground">📅</div>
          </div>
          <h3 className="text-lg sm:text-xl font-semibold mb-2">
            No Events Found
          </h3>
          <p className="text-muted-foreground mb-6">
            {activeFiltersCount > 0
              ? "Try adjusting your search criteria"
              : "Check back soon for upcoming events in Karachi"}
          </p>
        </div>
      )}
    </motion.div>
  );
}
