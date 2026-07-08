"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Upload,
  Trash2,
  Star,
  AlertCircle,
  Image as ImageIcon,
} from "lucide-react";
import type { Database } from "@/types/supabase";
import Image from "next/image";

type ListingImage = Database["public"]["Tables"]["listing_images"]["Row"];

interface GalleryTabProps {
  listingId: number;
}

export default function GalleryTab({ listingId }: GalleryTabProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [images, setImages] = useState<ListingImage[]>([]);
  const [deletingImage, setDeletingImage] = useState<ListingImage | null>(null);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch images
  const fetchImages = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/business/listings/${listingId}/gallery`,
      );
      if (response.ok) {
        const data = await response.json();
        setImages(data.data.images || []);
      }
    } catch (error) {
      console.error("Failed to fetch images:", error);
    } finally {
      setLoading(false);
    }
  }, [listingId]);

  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  // Handle file selection
  async function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Validate
    if (files.length > 10) {
      toast({
        title: "Too Many Files",
        description: "Maximum 10 images per upload",
        variant: "destructive",
      });
      return;
    }

    if (images.length + files.length > 20) {
      toast({
        title: "Image Limit",
        description: `Maximum 20 images per listing. You can upload ${20 - images.length} more.`,
        variant: "destructive",
      });
      return;
    }

    await uploadImages(files);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  // Upload images
  async function uploadImages(files: FileList) {
    try {
      setUploading(true);
      setUploadErrors([]);

      const formData = new FormData();
      Array.from(files).forEach((file) => {
        formData.append("images", file);
      });

      const response = await fetch(
        `/api/business/listings/${listingId}/gallery`,
        {
          method: "POST",
          body: formData,
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to upload images");
      }

      const {
        uploaded: _uploaded,
        errors,
        successful,
        failed: _failed,
      } = data.data;

      if (successful > 0) {
        toast({
          title: "Upload Complete",
          description: `${successful} image(s) uploaded successfully`,
        });
        fetchImages();
      }

      if (errors && errors.length > 0) {
        setUploadErrors(errors);
      }
    } catch (error) {
      toast({
        title: "Upload Failed",
        description:
          error instanceof Error ? error.message : "Failed to upload images",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  }

  // Delete image
  async function deleteImage(image: ListingImage) {
    try {
      setLoading(true);

      const response = await fetch(
        `/api/business/listings/${listingId}/gallery/${image.id}`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete image");
      }

      toast({
        title: "Image Deleted",
        description: "Image removed successfully",
      });

      setDeletingImage(null);
      fetchImages();
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to delete image",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Gallery</h3>
          <p className="text-sm text-muted-foreground">
            Upload images ({images.length}/20)
          </p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || images.length >= 20}
          >
            {uploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Upload Images
          </Button>
        </div>
      </div>

      {/* Upload Errors */}
      {uploadErrors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="font-semibold mb-2">
              Some images failed to upload:
            </div>
            <ul className="list-disc pl-4 space-y-1">
              {uploadErrors.map((error, i) => (
                <li key={i} className="text-sm">
                  {error}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Upload Guidelines */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <div className="space-y-1 text-sm">
            <div className="font-semibold">Image Requirements:</div>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>Maximum 5MB per image</li>
              <li>Minimum 200x200px, maximum 4096x4096px</li>
              <li>Formats: JPEG, PNG, WebP</li>
              <li>Maximum aspect ratio: 3:1</li>
            </ul>
          </div>
        </AlertDescription>
      </Alert>

      {/* Images Grid */}
      {loading && images.length === 0 ? (
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
        </div>
      ) : images.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map((image) => (
            <Card key={image.id} className="overflow-hidden group relative">
              <CardContent className="p-0">
                <div className="relative aspect-square">
                  <Image
                    src={image.url}
                    alt={image.alt_text || "Listing image"}
                    fill
                    className="object-cover"
                  />
                  {image.is_primary && (
                    <Badge className="absolute top-2 left-2 gap-1">
                      <Star className="h-3 w-3" />
                      Primary
                    </Badge>
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button
                      size="icon"
                      variant="destructive"
                      onClick={() => setDeletingImage(image)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h4 className="font-semibold mb-2">No Images Yet</h4>
          <p className="text-sm text-muted-foreground mb-4">
            Upload images to showcase your business
          </p>
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Upload className="mr-2 h-4 w-4" />
            Upload Images
          </Button>
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deletingImage}
        onOpenChange={(open) => !open && setDeletingImage(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Image?</AlertDialogTitle>
            <AlertDialogDescription>
              This image will be permanently deleted. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingImage && deleteImage(deletingImage)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
