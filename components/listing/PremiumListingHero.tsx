"use client";

import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { Database } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone, MapPin } from "lucide-react";

import { OptimizedImage } from "@/components/ui/optimized-image";
import { ShareButton } from "@/components/shared/ShareButton";

type Listing = Database["public"]["Views"]["listings_with_details"]["Row"];

interface PremiumListingHeroProps {
  listing: Listing;
  images?: string[];
  withTopMargin?: boolean;
}

export function PremiumListingHero({
  listing,
  images = [],
  withTopMargin = true,
}: PremiumListingHeroProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Auto-rotate images
  useEffect(() => {
    if (images.length > 1) {
      const interval = setInterval(() => {
        setCurrentImageIndex((prev) => (prev + 1) % images.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [images.length]);

  // Better image fallback logic with type-specific placeholders
  const getHeroImage = () => {
    if (images.length > 0) {
      return images[currentImageIndex];
    }

    // Fallback based on listing type/category
    const category = listing.category_name?.toLowerCase() || "";
    if (category.includes("restaurant") || category.includes("food")) {
      return "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&h=600&fit=crop&crop=center";
    } else if (
      category.includes("hotel") ||
      category.includes("accommodation")
    ) {
      return "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&h=600&fit=crop&crop=center";
    } else if (category.includes("cafe") || category.includes("coffee")) {
      return "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=1200&h=600&fit=crop&crop=center";
    } else if (category.includes("shop") || category.includes("store")) {
      return "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&h=600&fit=crop&crop=center";
    } else {
      return "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&h=600&fit=crop&crop=center";
    }
  };

  // Fix: Calculate heroImage dynamically based on currentImageIndex
  const heroImage = getHeroImage();

  return (
    <div
      className={`relative h-[70vh] lg:h-[85vh] overflow-hidden ${
        withTopMargin ? "mt-20" : ""
      }`}
    >
      {/* Background Image with Parallax */}
      <motion.div
        key={currentImageIndex} // Fix: Force re-render when image changes
        className="absolute inset-0"
        initial={{ scale: 1.05, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <OptimizedImage
          src={heroImage}
          alt={listing.name || "Listing"}
          fill
          className="object-cover"
          priority
          sizes="100vw"
          loading="eager"
          fetchPriority="high"
        />

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-primary/10 opacity-60" />
      </motion.div>

      {/* Image Navigation */}
      {images.length > 1 && (
        <div className="absolute top-6 right-6 z-20">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex items-center gap-2 bg-black/20 backdrop-blur-xl rounded-full px-4 py-2 border border-white/20"
          >
            {images.map((_, index) => (
              <motion.button
                key={index}
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setCurrentImageIndex(index)}
                className={`relative transition-all duration-300 ${
                  index === currentImageIndex ? "w-6 h-2" : "w-2 h-2 hover:w-3"
                }`}
              >
                <div
                  className={`w-full h-full rounded-full transition-all duration-300 ${
                    index === currentImageIndex
                      ? "bg-gradient-to-r from-primary to-primary/80 shadow-lg shadow-primary/30"
                      : "bg-white/40 hover:bg-white/60"
                  }`}
                />
                {index === currentImageIndex && (
                  <motion.div
                    layoutId="activeSlide"
                    className="absolute inset-0 bg-gradient-to-r from-primary to-primary/80 rounded-full"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
              </motion.button>
            ))}
            <div className="w-px h-3 bg-white/30 mx-1" />
            <span className="text-white/80 text-xs font-medium">
              {currentImageIndex + 1}/{images.length}
            </span>
          </motion.div>
        </div>
      )}

      {/* Content - Mobile Centered, Desktop Bottom */}
      <div className="absolute inset-0 flex items-center md:items-end">
        <div className="container mx-auto px-4 md:px-6 lg:px-8 pb-8 md:pb-16 lg:pb-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="max-w-4xl text-center md:text-left"
          >
            {/* Category Badges - Homepage Style */}
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.15 }}
              className="flex items-center justify-center md:justify-start gap-3 mb-4 md:mb-6"
            >
              <div className="relative">
                {/* Glow effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-primary/40 to-primary/20 rounded-full blur-md" />
                <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-primary/10 rounded-full blur-sm" />
                <Badge
                  variant="secondary"
                  className="relative backdrop-blur-xl text-white border px-3 md:px-6 py-2 md:py-2.5 text-xs md:text-sm font-bold tracking-wide shadow-xl"
                  style={{
                    background:
                      "linear-gradient(135deg, hsl(var(--primary)/0.25) 0%, hsl(var(--primary)/0.15) 100%)",
                    borderColor: "hsl(var(--primary)/0.4)",
                    boxShadow:
                      "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04), 0 0 0 1px hsl(var(--primary)/0.1)",
                  }}
                >
                  <span className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full animate-pulse"
                      style={{ backgroundColor: "hsl(var(--primary))" }}
                    />
                    {listing.category_name}
                  </span>
                </Badge>
              </div>

              {listing.is_featured && (
                <div className="relative">
                  {/* Glow effect for featured */}
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-400/40 to-orange-400/30 rounded-full blur-md" />
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-400/20 to-orange-400/15 rounded-full blur-sm" />
                  <Badge
                    variant="outline"
                    className="relative backdrop-blur-xl text-amber-100 border px-3 md:px-5 py-2 md:py-2.5 text-xs md:text-sm font-bold tracking-wide shadow-xl"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(245, 158, 11, 0.3) 0%, rgba(249, 115, 22, 0.25) 100%)",
                      borderColor: "rgba(251, 191, 36, 0.5)",
                      boxShadow:
                        "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04), 0 0 20px rgba(245, 158, 11, 0.15)",
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <svg
                        className="w-4 h-4"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      Featured
                    </span>
                  </Badge>
                </div>
              )}

              {listing.is_member && (
                <div className="relative">
                  {/* Glow effect for verified */}
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-400/40 to-indigo-400/30 rounded-full blur-md" />
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-indigo-400/15 rounded-full blur-sm" />
                  <Badge
                    variant="outline"
                    className="relative backdrop-blur-xl text-blue-100 border px-3 md:px-5 py-2 md:py-2.5 text-xs md:text-sm font-bold tracking-wide shadow-xl"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(59, 130, 246, 0.3) 0%, rgba(99, 102, 241, 0.25) 100%)",
                      borderColor: "rgba(96, 165, 250, 0.5)",
                      boxShadow:
                        "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04), 0 0 20px rgba(59, 130, 246, 0.15)",
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <svg
                        className="w-4 h-4"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Verified
                    </span>
                  </Badge>
                </div>
              )}
            </motion.div>

            {/* Title with gradient - optimized for mobile */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold mb-3 md:mb-5 leading-tight tracking-tight"
            >
              <span
                className="gradient-text-primary drop-shadow-lg"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary)) 50%, hsl(var(--primary)/0.8) 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  backgroundSize: "200% 200%",
                  filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.3))",
                }}
              >
                {listing.name}
              </span>
            </motion.h1>

            {/* Description - Optimized with truncation for mobile */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.25 }}
              className="mb-6 md:mb-8 max-w-2xl"
            >
              <p className="text-sm md:text-base lg:text-lg text-white/95 leading-relaxed font-medium tracking-wide line-clamp-3 md:line-clamp-none">
                {listing.description}
              </p>
            </motion.div>

            {/* Rating and Location - Mobile */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.3 }}
              className="flex flex-col md:flex-row gap-4 items-center md:items-start justify-center md:justify-start mb-6 md:mb-8"
            >
              {(listing.review_count ?? 0) > 0 && (
                <div className="bg-black/20 backdrop-blur-xl border border-white/20 rounded-2xl px-6 py-3">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      {[...Array(5)].map((_, i) => (
                        <svg
                          key={i}
                          className={`w-5 h-5 ${
                            i < Math.floor(listing.avg_rating!)
                              ? "text-amber-300 drop-shadow-lg"
                              : "text-white/30"
                          }`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-white font-bold text-xl drop-shadow-sm">
                        {(listing.avg_rating ?? 0).toFixed(1)}
                      </span>
                      <div className="w-px h-5 bg-white/40" />
                      <span className="text-white/90 text-sm font-semibold">
                        {listing.review_count} reviews
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {listing.address && (
                <div className="bg-black/20 backdrop-blur-xl border border-white/20 rounded-2xl px-4 md:px-6 py-3">
                  <div className="flex items-center gap-3">
                    <svg
                      className="w-4 md:w-5 h-4 md:h-5 text-blue-200 drop-shadow-sm flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    <span className="text-white/95 font-semibold drop-shadow-sm text-sm md:text-base line-clamp-1 md:line-clamp-none">
                      {listing.address}
                    </span>
                  </div>
                </div>
              )}
            </motion.div>

            {/* Action Buttons - Mobile Side-by-Side, Desktop Original */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.35 }}
              className="flex flex-row md:flex-row gap-2 md:gap-4 justify-center md:justify-start"
            >
              {listing.phone_number && (
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 md:flex-none"
                >
                  <Button
                    size="lg"
                    onClick={() => window.open(`tel:${listing.phone_number}`)}
                    className="w-full md:w-auto px-3 md:px-8 py-3 md:py-4 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 group text-sm md:text-base"
                  >
                    <Phone className="h-4 md:h-5 w-4 md:w-5 mr-1 md:mr-2" />
                    <span className="hidden xs:inline md:inline">Call Now</span>
                    <span className="xs:hidden md:hidden">Call</span>
                  </Button>
                </motion.div>
              )}

              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex-1 md:flex-none"
              >
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => {
                    const query = encodeURIComponent(
                      listing.address || listing.name || "",
                    );
                    window.open(
                      `https://www.google.com/maps/search/?api=1&query=${query}`,
                      "_blank",
                    );
                  }}
                  className="w-full md:w-auto px-3 md:px-8 py-3 md:py-4 bg-white/90 dark:bg-white/10 border-white/50 dark:border-white/30 text-gray-900 dark:text-white hover:bg-white hover:text-gray-900 dark:hover:bg-white/30 dark:hover:text-white font-semibold rounded-2xl transition-all duration-300 backdrop-blur-sm shadow-lg text-sm md:text-base"
                >
                  <MapPin className="h-4 md:h-5 w-4 md:w-5 mr-1 md:mr-2" />
                  <span className="hidden sm:inline md:inline">
                    Get Directions
                  </span>
                  <span className="sm:hidden md:hidden">Maps</span>
                </Button>
              </motion.div>

              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex-1 md:flex-none"
              >
                <ShareButton
                  contentType="listing"
                  contentId={listing.id!}
                  contentTitle={listing.name || "Listing"}
                  contentUrl={`/listing/${listing.slug}`}
                  variant="default"
                  className="w-full md:w-auto px-3 md:px-8 py-3 md:py-4 bg-primary/10 dark:bg-primary/10 border-primary/20 dark:border-primary/20 text-white dark:text-white hover:bg-primary/20 hover:text-white dark:hover:bg-primary/20 dark:hover:text-white font-semibold rounded-2xl transition-all duration-300 backdrop-blur-md shadow-lg text-sm md:text-base from-primary/10 to-primary/10"
                />
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Gradient Orbs */}
      <div className="absolute top-1/3 left-1/4 hidden xl:block">
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 0.1, scale: 1 }}
          transition={{ duration: 2, delay: 1.6 }}
          className="w-16 h-16 bg-gradient-to-br from-primary/20 to-transparent rounded-full blur-xl"
        />
      </div>

      <div className="absolute bottom-1/4 right-1/3 hidden xl:block">
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 0.1, scale: 1 }}
          transition={{ duration: 2, delay: 1.8 }}
          className="w-20 h-20 bg-gradient-to-br from-blue-500/20 to-transparent rounded-full blur-xl"
        />
      </div>
    </div>
  );
}
