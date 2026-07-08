"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Camera, ChevronLeft, ChevronRight, X } from "lucide-react";
import { PremiumHeading } from "@/components/brand/Typography";
import { OptimizedImage } from "@/components/ui/optimized-image";
import type { EventImage } from "@/types/events.types";

interface EventGalleryProps {
  images: EventImage[];
  eventName: string;
}

interface LightboxProps {
  images: EventImage[];
  currentIndex: number;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
  eventName: string;
}

function Lightbox({
  images,
  currentIndex,
  onClose,
  onNext,
  onPrev,
  eventName,
}: LightboxProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onPrev();
      if (e.key === "ArrowRight") onNext();
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [onClose, onNext, onPrev]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm"
        onClick={onClose}
      >
        <div className="absolute inset-0 flex items-center justify-center p-4">
          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="absolute top-4 right-4 z-10 text-white hover:bg-white/20"
          >
            <X className="h-6 w-6" />
          </Button>

          {/* Navigation buttons */}
          {images.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onPrev();
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/20"
                disabled={currentIndex === 0}
              >
                <ChevronLeft className="h-8 w-8" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onNext();
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/20"
                disabled={currentIndex === images.length - 1}
              >
                <ChevronRight className="h-8 w-8" />
              </Button>
            </>
          )}

          {/* Main image */}
          <div className="relative max-w-5xl max-h-full">
            <OptimizedImage
              src={images[currentIndex].url}
              alt={
                images[currentIndex].alt_text ||
                `${eventName} - Image ${currentIndex + 1}`
              }
              width={1200}
              height={800}
              className="max-w-full max-h-full object-contain"
            />

            {/* Image counter */}
            {images.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                <Badge
                  variant="secondary"
                  className="bg-black/50 text-white border-white/20"
                >
                  {currentIndex + 1} / {images.length}
                </Badge>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export function EventGallery({ images, eventName }: EventGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const startX = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter out non-primary images for the gallery (show all images)
  const galleryImages = images;

  // Find primary image index
  const primaryImageIndex =
    galleryImages.findIndex((img) => img.is_primary) || 0;

  const handleImageClick = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const handleThumbnailClick = (index: number) => {
    setCurrentIndex(index);
  };

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % galleryImages.length);
  }, [galleryImages.length]);

  const handlePrev = useCallback(() => {
    setCurrentIndex(
      (prev) => (prev - 1 + galleryImages.length) % galleryImages.length
    );
  }, [galleryImages.length]);

  const handleLightboxNext = useCallback(() => {
    setLightboxIndex((prev) => (prev + 1) % galleryImages.length);
  }, [galleryImages.length]);

  const handleLightboxPrev = useCallback(() => {
    setLightboxIndex(
      (prev) => (prev - 1 + galleryImages.length) % galleryImages.length
    );
  }, [galleryImages.length]);

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    startX.current = clientX;
    setDragOffset(0);
  };

  const handleDragMove = useCallback(
    (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
      if (!isDragging) return;

      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const diff = clientX - startX.current;

      // Simple 1:1 movement with light boundary resistance
      let constrainedDiff = diff;

      if (currentIndex === 0 && diff > 0) {
        constrainedDiff = diff * 0.3; // Resistance at start
      } else if (currentIndex === galleryImages.length - 1 && diff < 0) {
        constrainedDiff = diff * 0.3; // Resistance at end
      }

      setDragOffset(constrainedDiff);
    },
    [isDragging, currentIndex, galleryImages.length]
  );

  const handleDragEnd = useCallback(() => {
    if (!isDragging) return;

    const threshold = 100; // 100px threshold

    setIsDragging(false);

    if (Math.abs(dragOffset) > threshold) {
      if (dragOffset > 0 && currentIndex > 0) {
        setCurrentIndex(currentIndex - 1);
      } else if (dragOffset < 0 && currentIndex < galleryImages.length - 1) {
        setCurrentIndex(currentIndex + 1);
      }
    }

    setDragOffset(0);
  }, [isDragging, dragOffset, currentIndex, galleryImages.length]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => handleDragMove(e);
    const handleMouseUp = () => handleDragEnd();
    const handleTouchMove = (e: TouchEvent) => handleDragMove(e);
    const handleTouchEnd = () => handleDragEnd();

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.addEventListener("touchmove", handleTouchMove);
      document.addEventListener("touchend", handleTouchEnd);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  if (!galleryImages || galleryImages.length === 0) {
    return null;
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center space-x-3">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 border border-primary/20 shadow-premium">
            <Camera className="w-5 h-5 text-primary" />
          </div>
          <PremiumHeading level={2} dense className="text-foreground mb-2">
            Event <span className="gradient-text-primary">Gallery</span>
          </PremiumHeading>
        </div>

        <div className="space-y-4">
          {/* Main gallery image */}
          <div className="relative aspect-video rounded-2xl overflow-hidden shadow-premium">
            <div
              ref={containerRef}
              className="relative w-full h-full cursor-pointer"
              onMouseDown={handleDragStart}
              onTouchStart={handleDragStart}
              onClick={() => handleImageClick(currentIndex)}
              style={{
                transform: `translateX(${dragOffset}px)`,
                transition: isDragging ? "none" : "transform 0.3s ease-out",
              }}
            >
              <OptimizedImage
                src={galleryImages[currentIndex].url}
                alt={
                  galleryImages[currentIndex].alt_text ||
                  `${eventName} - Image ${currentIndex + 1}`
                }
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 60vw"
                className="object-cover hover:scale-105 transition-transform duration-300"
                priority={currentIndex === 0}
              />

              {/* Primary badge */}
              {galleryImages[currentIndex].is_primary && (
                <div className="absolute top-4 left-4">
                  <Badge className="bg-primary text-primary-foreground shadow-lg">
                    Primary Image
                  </Badge>
                </div>
              )}

              {/* Navigation indicators */}
              {galleryImages.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-2">
                  {galleryImages.map((_, index) => (
                    <button
                      key={index}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentIndex(index);
                      }}
                      className={`w-2 h-2 rounded-full transition-all ${
                        index === currentIndex
                          ? "bg-white shadow-lg"
                          : "bg-white/50 hover:bg-white/75"
                      }`}
                    />
                  ))}
                </div>
              )}

              {/* Navigation arrows */}
              {galleryImages.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePrev();
                    }}
                    disabled={currentIndex === 0}
                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/20 hover:bg-black/40 text-white border-0"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNext();
                    }}
                    disabled={currentIndex === galleryImages.length - 1}
                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/20 hover:bg-black/40 text-white border-0"
                  >
                    <ChevronRight className="h-6 w-6" />
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Thumbnail strip */}
          {galleryImages.length > 1 && (
            <div className="flex space-x-2 overflow-x-auto pb-2">
              {galleryImages.map((image, index) => (
                <button
                  key={image.id}
                  onClick={() => handleThumbnailClick(index)}
                  className={`relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${
                    index === currentIndex
                      ? "border-primary shadow-lg scale-105"
                      : "border-muted hover:border-primary/50"
                  }`}
                >
                  <OptimizedImage
                    src={image.url}
                    alt={
                      image.alt_text || `${eventName} - Thumbnail ${index + 1}`
                    }
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                  {image.is_primary && (
                    <div className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Image count */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {galleryImages.length} image
              {galleryImages.length !== 1 ? "s" : ""} available
            </span>
            <div className="flex items-center space-x-2">
              {currentIndex !== primaryImageIndex && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentIndex(primaryImageIndex)}
                  className="text-primary hover:text-primary/80"
                >
                  Show Primary
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleImageClick(currentIndex)}
                className="text-primary hover:text-primary/80"
              >
                View Full Size
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxOpen && (
        <Lightbox
          images={galleryImages}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
          onNext={handleLightboxNext}
          onPrev={handleLightboxPrev}
          eventName={eventName}
        />
      )}
    </>
  );
}
