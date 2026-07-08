"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Heart, Share2 } from "lucide-react";
import { useState } from "react";
import { toggleFavorite } from "@/lib/favorites";
import { useToast } from "@/hooks/use-toast";

interface ListingNavigationProps {
  listingName: string;
  onBack?: () => void;
}

export function ListingNavigation({
  listingName,
  onBack,
}: ListingNavigationProps) {
  const [isFavorited, setIsFavorited] = useState(false);
  const [favLoading, setFavLoading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  const handleShare = async () => {
    setIsSharing(true);

    try {
      if (navigator.share) {
        await navigator.share({
          title: listingName,
          text: `Check out ${listingName} on Inside Karachi`,
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        // You could show a toast notification here
      }
    } catch (error) {
      console.log("Share cancelled or failed", error);
    } finally {
      setIsSharing(false);
    }
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      window.history.back();
    }
  };

  const { toast } = useToast();

  return (
    <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="container mx-auto px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center justify-between py-4"
        >
          {/* Back Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back to Listings</span>
            <span className="sm:hidden">Back</span>
          </Button>

          {/* Page Title - Hidden on mobile to save space */}
          <h1 className="hidden md:block text-lg font-semibold truncate max-w-md">
            {listingName}
          </h1>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (favLoading) return;
                setFavLoading(true);
                try {
                  const res = await toggleFavorite(
                    Number(window.location.pathname.split("/").pop())
                  );
                  setIsFavorited(Boolean(res?.favorited));
                } catch (err) {
                  console.error("Favorite toggle failed", err);
                  if (
                    err instanceof Error &&
                    (err as { status?: number }).status === 401
                  ) {
                    toast({
                      title: "Sign in required",
                      description: "Please sign in to save favorites.",
                    });
                    const redirect = encodeURIComponent(window.location.href);
                    window.location.href = `/login?redirect=${redirect}`;
                  }
                } finally {
                  setFavLoading(false);
                }
              }}
              className={`transition-all duration-300 ${
                isFavorited
                  ? "text-red-500 hover:text-red-600"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Heart
                className={`w-4 h-4 transition-all duration-300 ${
                  isFavorited ? "fill-current scale-110" : ""
                }`}
              />
              <span className="hidden sm:inline ml-2">
                {isFavorited ? "Saved" : "Save"}
              </span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleShare}
              disabled={isSharing}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <Share2
                className={`w-4 h-4 ${isSharing ? "animate-pulse" : ""}`}
              />
              <span className="hidden sm:inline ml-2">Share</span>
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
