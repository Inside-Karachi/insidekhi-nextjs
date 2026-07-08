"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { ImageIcon, Loader2, Trash2, ExternalLink } from "lucide-react";
import { OptimizedImage } from "@/components/ui/optimized-image";

interface MenuImage {
  id: number;
  listing_id: number;
  url: string;
  alt_text: string | null;
  display_order: number;
  created_at: string;
  source: "storage";
}

interface MenuImagesGalleryProps {
  listingId: number | null;
}

export function MenuImagesGallery({ listingId }: MenuImagesGalleryProps) {
  const { toast } = useToast();
  const [images, setImages] = React.useState<MenuImage[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [selectedImage, setSelectedImage] = React.useState<MenuImage | null>(
    null,
  );
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
  const [showFullImage, setShowFullImage] = React.useState(false);

  const fetchMenuImages = React.useCallback(async () => {
    if (!listingId) {
      setImages([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/admin/listings/${listingId}/menu-images`,
      );

      if (!response.ok) {
        throw new Error("Failed to fetch menu images");
      }

      const result = await response.json();
      setImages(result.data || []);
    } catch (error) {
      console.error("[MENU IMAGES] Fetch error:", error);
      toast({
        title: "Error",
        description: "Failed to load menu images",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [listingId, toast]);

  React.useEffect(() => {
    fetchMenuImages();
  }, [fetchMenuImages]);

  const handleDeleteClick = (image: MenuImage) => {
    setSelectedImage(image);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedImage || !listingId) return;

    setIsDeleting(true);
    try {
      const response = await fetch(
        `/api/admin/listings/${listingId}/menu-images`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageUrl: selectedImage.url,
          }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to delete menu image");
      }

      toast({
        title: "Success",
        description: "Menu image deleted successfully",
      });

      // Refresh images list
      await fetchMenuImages();
    } catch (error) {
      console.error("[MENU IMAGES] Delete error:", error);
      toast({
        title: "Error",
        description: "Failed to delete menu image",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setSelectedImage(null);
    }
  };

  const handleViewImage = (image: MenuImage) => {
    setSelectedImage(image);
    setShowFullImage(true);
  };

  if (!listingId) {
    return (
      <Card className="p-6">
        <div className="text-center text-muted-foreground">
          <ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>Save the listing first to view menu images</p>
        </div>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">
            Loading menu images...
          </span>
        </div>
      </Card>
    );
  }

  if (images.length === 0) {
    return (
      <Card className="p-6">
        <div className="text-center text-muted-foreground">
          <ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="mb-1">No menu images found</p>
          <p className="text-sm">
            Menu images are automatically imported during scraping
          </p>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h4 className="font-medium">Menu Images from Scraper</h4>
            <p className="text-sm text-muted-foreground">
              {images.length} image{images.length !== 1 ? "s" : ""} found
            </p>
          </div>
          <Badge variant="secondary" className="text-xs">
            Auto-synced from Peekaboo
          </Badge>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {images.map((image) => (
            <div
              key={`${image.source}-${image.id}`}
              className="group relative aspect-square rounded-lg overflow-hidden border bg-muted/20"
            >
              <OptimizedImage
                src={image.url}
                alt={image.alt_text || "Menu image"}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                instant
              />

              {/* Overlay with actions */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleViewImage(image)}
                  className="h-8 px-2"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDeleteClick(image)}
                  className="h-8 px-2"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Menu Image?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the menu image from both the database
              and storage. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Full Image Preview Dialog */}
      <AlertDialog open={showFullImage} onOpenChange={setShowFullImage}>
        <AlertDialogContent className="max-w-4xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Menu Image Preview</AlertDialogTitle>
          </AlertDialogHeader>
          {selectedImage && (
            <div className="relative w-full h-[60vh] rounded-lg overflow-hidden bg-muted">
              <OptimizedImage
                src={selectedImage.url}
                alt={selectedImage.alt_text || "Menu image"}
                fill
                className="object-contain"
                sizes="(max-width: 1024px) 90vw, 800px"
                priority
              />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => window.open(selectedImage?.url, "_blank")}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open in New Tab
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
