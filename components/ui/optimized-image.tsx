"use client";

import Image, { ImageProps } from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { ImageSkeleton } from "@/components/ui/skeleton";

interface OptimizedImageProps extends Omit<ImageProps, "onLoad" | "onError"> {
  fallbackSrc?: string;
  showSkeleton?: boolean;
  skeletonClassName?: string;
  /** Use instant display mode - no skeleton, just blur-up placeholder */
  instant?: boolean;
  /** Fetch priority for critical LCP images */
  fetchPriority?: "high" | "low" | "auto";
  /** Image quality (1-100, default: 75 for non-priority, 90 for priority) */
  quality?: number;
}

// High quality blur placeholder - creates a nice blur-up effect
const BLUR_DATA_URL =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxIDEiPjxyZWN0IGZpbGw9IiM4ODgiIG9wYWNpdHk9IjAuMyIgd2lkdGg9IjEiIGhlaWdodD0iMSIvPjwvc3ZnPg==";

export function OptimizedImage({
  src,
  alt,
  className,
  fallbackSrc,
  showSkeleton = true,
  skeletonClassName,
  instant = false,
  priority,
  fetchPriority,
  quality,
  ...props
}: OptimizedImageProps) {
  const [isLoading, setIsLoading] = useState(!priority && !instant);
  const [hasError, setHasError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(src);

  // Use lower quality for non-priority images
  const imageQuality = quality ?? (priority ? 90 : 75);

  const handleLoad = () => {
    setIsLoading(false);
  };

  const handleError = () => {
    setHasError(true);
    setIsLoading(false);

    // Track image load failures for monitoring
    if (typeof window !== "undefined" && src) {
      try {
        fetch("/api/monitoring/image-errors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageUrl: src,
            timestamp: new Date().toISOString(),
            pathname: window.location.pathname,
          }),
        }).catch(() => {
          // Silently fail
        });
      } catch {
        // Ignore monitoring errors
      }
    }

    if (fallbackSrc && currentSrc !== fallbackSrc) {
      setCurrentSrc(fallbackSrc);
      setHasError(false);
      setIsLoading(true);
    }
  };

  // Check if using fill prop
  const isFill = "fill" in props && props.fill;

  // CRITICAL: Force instant mode for priority images to eliminate render delay
  // Priority images should paint immediately without skeleton overhead
  const shouldUseInstant = instant || !showSkeleton || priority;

  // For instant mode or when skeleton is disabled - use native blur placeholder only
  if (shouldUseInstant) {
    if (isFill) {
      return (
        <>
          {" "}
          <Image
            src={currentSrc}
            alt={alt}
            className={cn(
              "transition-opacity duration-200",
              isLoading ? "opacity-80" : "opacity-100",
              className,
            )}
            onLoad={handleLoad}
            onError={handleError}
            quality={imageQuality}
            placeholder="blur"
            blurDataURL={BLUR_DATA_URL}
            fetchPriority={fetchPriority}
            {...props}
          />
          {hasError && !fallbackSrc && (
            <div
              className={cn(
                "absolute inset-0 bg-muted/50 flex items-center justify-center text-muted-foreground/50 text-xs",
                className,
              )}
            >
              ⚠️
            </div>
          )}
        </>
      );
    }

    return (
      <div className="relative">
        <Image
          src={currentSrc}
          alt={alt}
          priority={priority}
          className={cn(
            "transition-opacity duration-200",
            isLoading ? "opacity-80" : "opacity-100",
            className,
          )}
          onLoad={handleLoad}
          onError={handleError}
          quality={imageQuality}
          placeholder="blur"
          blurDataURL={BLUR_DATA_URL}
          fetchPriority={fetchPriority}
          {...props}
        />
        {hasError && !fallbackSrc && (
          <div
            className={cn(
              "absolute inset-0 bg-muted/50 flex items-center justify-center text-muted-foreground/50 text-xs",
              className,
            )}
          >
            ⚠️
          </div>
        )}
      </div>
    );
  }

  if (isFill) {
    return (
      <>
        {/* Shimmer Skeleton - lighter */}
        {isLoading && (
          <ImageSkeleton
            className={cn("absolute inset-0 z-10", skeletonClassName)}
          />
        )}

        {/* Image with faster transition */}
        <Image
          src={currentSrc}
          alt={alt}
          priority={priority}
          className={cn(
            "transition-opacity duration-200",
            isLoading ? "opacity-0" : "opacity-100",
            className,
          )}
          onLoad={handleLoad}
          onError={handleError}
          quality={imageQuality}
          placeholder="blur"
          fetchPriority={fetchPriority}
          blurDataURL={BLUR_DATA_URL}
          {...props}
        />

        {/* Error State */}
        {hasError && !fallbackSrc && (
          <div
            className={cn(
              "absolute inset-0 bg-muted/60 dark:bg-zinc-800/60 flex items-center justify-center text-muted-foreground text-sm",
              className,
            )}
          >
            <svg
              className="w-5 h-5 mr-2 opacity-50"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            Failed to load
          </div>
        )}
      </>
    );
  }

  // For non-fill images, use wrapper div
  return (
    <div className="relative">
      {/* Shimmer Skeleton */}
      {isLoading && (
        <ImageSkeleton
          className={cn("absolute inset-0 z-10", skeletonClassName)}
        />
      )}

      {/* Image */}
      <Image
        src={currentSrc}
        alt={alt}
        priority={priority}
        className={cn(
          "transition-opacity duration-200",
          isLoading ? "opacity-0" : "opacity-100",
          className,
        )}
        onLoad={handleLoad}
        onError={handleError}
        quality={imageQuality}
        placeholder="blur"
        blurDataURL={BLUR_DATA_URL}
        fetchPriority={fetchPriority}
        {...props}
      />

      {/* Error State */}
      {hasError && !fallbackSrc && (
        <div
          className={cn(
            "absolute inset-0 bg-muted/60 dark:bg-zinc-800/60 flex items-center justify-center text-muted-foreground text-sm",
            className,
          )}
        >
          <svg
            className="w-5 h-5 mr-2 opacity-50"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          Failed to load
        </div>
      )}
    </div>
  );
}
