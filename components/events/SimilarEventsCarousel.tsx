"use client";

import { useState, useEffect } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { SimilarEventsCarouselProps } from "@/types/events.types";
import { EventCard as PremiumEventCard } from "@/components/events/EventCard";
import { PremiumHeading } from "@/components/brand/Typography";
import {
  sectionVariants,
  viewportSettings,
} from "@/lib/utils/listing-animations";

export function SimilarEventsCarousel({
  similarEvents,
  currentEventId,
}: SimilarEventsCarouselProps) {
  const [viewportRef, embla] = useEmblaCarousel({
    loop: false,
    containScroll: "trimSnaps",
  });
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Embla controls
  const scrollPrev = () => embla && embla.scrollPrev();
  const scrollNext = () => embla && embla.scrollNext();

  useEffect(() => {
    if (!embla) return;
    const onSelect = () => {
      setCanScrollLeft(embla.canScrollPrev());
      setCanScrollRight(embla.canScrollNext());
    };
    onSelect();
    embla.on("select", onSelect);
    embla.on("reInit", onSelect);
    return () => {
      embla.off("select", onSelect);
      embla.off("reInit", onSelect);
    };
  }, [embla]);

  if (!similarEvents || similarEvents.length === 0) return null;

  const filtered = similarEvents
    .filter((e) => e.id !== currentEventId)
    .slice(0, 6);

  return (
    <motion.div
      className="space-y-6 md:space-y-8"
      initial="hidden"
      whileInView="visible"
      viewport={viewportSettings}
      variants={sectionVariants}
    >
      <div className="space-y-4">
        <div className="flex items-center space-x-3">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 border border-primary/20 shadow-premium">
            <ArrowRight className="w-5 h-5 text-primary" />
          </div>
          <div>
            <PremiumHeading level={2} dense className="text-foreground">
              More <span className="gradient-text-primary">Events</span>
            </PremiumHeading>
            <p className="text-sm sm:text-base md:text-lg text-muted-foreground md:mt-1">
              Discover other exciting events happening in Karachi
            </p>
          </div>
        </div>
      </div>

      <div className="w-full relative">
        {/* Left fade */}
        <div className="absolute left-0 top-0 bottom-4 w-12 z-20 pointer-events-none bg-gradient-to-r from-background md:via-background/80 md:to-transparent via-background/40 to-transparent" />
        {/* Right fade */}
        <div className="absolute right-0 top-0 bottom-4 w-12 z-20 pointer-events-none bg-gradient-to-l from-background md:via-background/80 md:to-transparent via-background/40 to-transparent" />

        {/* Left control */}
        {canScrollLeft && (
          <button
            onClick={scrollPrev}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-30 w-10 h-10 bg-background/95 backdrop-blur-md border border-border/50 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl hover:shadow-primary/20 hover:bg-background hover:scale-110 hover:border-primary/30 transition-all duration-300 group"
            aria-label="Scroll left"
          >
            <ArrowRight className="w-4 h-4 rotate-180 text-muted-foreground group-hover:text-primary transition-colors duration-300" />
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-sm" />
          </button>
        )}

        {/* Right control */}
        {canScrollRight && (
          <button
            onClick={scrollNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-30 w-10 h-10 bg-background/95 backdrop-blur-md border border-border/50 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl hover:shadow-primary/20 hover:bg-background hover:scale-110 hover:border-primary/30 transition-all duration-300 group"
            aria-label="Scroll right"
          >
            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors duration-300" />
            <div className="absolute inset-0 rounded-full bg-gradient-to-l from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-sm" />
          </button>
        )}

        <div className="embla overflow-hidden" ref={viewportRef}>
          <div className="embla__container flex gap-6 items-stretch pb-4 snap-x snap-mandatory scrollbar-hide scroll-smooth px-3 relative">
            {filtered.map((event, idx) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.08, duration: 0.45 }}
                className="flex-shrink-0 w-80 snap-start"
              >
                <PremiumEventCard
                  event={event}
                  showAnimation={false}
                  variant="compact"
                />
              </motion.div>
            ))}
          </div>
        </div>
      </div>


    </motion.div>
  );
}
