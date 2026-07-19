"use client";

import * as React from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Upload, X, AlertCircle, ImageIcon, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ListingImage {
  id: number;
  listing_id: number;
  url: string;
  alt_text: string | null;
  is_primary: boolean;
  display_order: number;
  created_at: string;
}

interface UploadItem {
  file: File;
  id: string;
  status: "pending" | "uploading" | "completed" | "error";
  progress: number;
  error?: string;
}

interface ListingGalleryUploadProps {
  listingId: number | null;
  tempSessionId?: string;
  images: ListingImage[];
  onImagesChange: (
    images: ListingImage[] | ((prevImages: ListingImage[]) => ListingImage[]),
  ) => void;
  isLoading?: boolean;
  /** IDs of images marked for deletion (soft delete until Save) */
  pendingDeletions?: Set<number>;
  /** Callback when pending deletions change */
  onPendingDeletionsChange?: (deletions: Set<number>) => void;
}

export function ListingGalleryUpload({
  listingId,
  tempSessionId,
  images,
  onImagesChange,
  isLoading = false,
  pendingDeletions = new Set(),
  onPendingDeletionsChange,
}: ListingGalleryUploadProps) {
  const [dragActive, setDragActive] = React.useState(false);
  const [uploadQueue, setUploadQueue] = React.useState<UploadItem[]>([]);
  // Local pending deletions state for when parent doesn't manage it
  const [localPendingDeletions, setLocalPendingDeletions] = React.useState<
    Set<number>
  >(new Set());

  // Use parent-managed state if provided, otherwise local state
  const effectivePendingDeletions = onPendingDeletionsChange
    ? pendingDeletions
    : localPendingDeletions;
  const setEffectivePendingDeletions = onPendingDeletionsChange
    ? onPendingDeletionsChange
    : setLocalPendingDeletions;

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const MAX_IMAGES = 20;
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return "Only JPEG, PNG, and WebP images are allowed";
    }
    if (file.size > MAX_FILE_SIZE) {
      return "File size must be less than 5MB";
    }
    return null;
  };

  const handleDrag = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (!listingId && !tempSessionId) {
      toast({
        title: "Error",
        description: "Unable to upload images: missing temp session.",
        variant: "destructive",
      });
      return;
    }
    const files = Array.from(e.dataTransfer.files);
    await handleFiles(files);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!listingId && !tempSessionId) {
      toast({
        title: "Error",
        description: "Unable to upload images: missing temp session.",
        variant: "destructive",
      });
      return;
    }
    await handleFiles(files);
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFiles = async (files: File[]) => {
    if (images.length + files.length > MAX_IMAGES) {
      toast({
        title: "Error",
        description: `You can only upload up to ${MAX_IMAGES} images`,
        variant: "destructive",
      });
      return;
    }

    const validFiles = files.filter((file) => {
      const error = validateFile(file);
      if (error) {
        toast({
          title: "Invalid file",
          description: `${file.name}: ${error}`,
          variant: "destructive",
        });
        return false;
      }
      return true;
    });

    // Create upload items
    const uploadItems: UploadItem[] = validFiles.map((file) => ({
      file,
      id: `${Date.now()}-${Math.random()}`,
      status: "pending",
      progress: 0,
    }));

    // Add to upload queue
    setUploadQueue((prev) => [...prev, ...uploadItems]);

    // Start concurrent uploads
    const uploadPromises = uploadItems.map((item) => uploadFile(item));

    try {
      await Promise.allSettled(uploadPromises);
    } finally {
      // Clear only completed items from queue after a delay
      // Keep error items visible for retry attempts
      setTimeout(() => {
        setUploadQueue((prev) =>
          prev.filter(
            (item) => item.status === "uploading" || item.status === "error",
          ),
        );
      }, 2000);
    }
  };

  const uploadFile = async (uploadItem: UploadItem) => {
    const { file, id } = uploadItem;

    // Update status to uploading
    setUploadQueue((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, status: "uploading", progress: 10 } : item,
      ),
    );

    try {
      const formData = new FormData();
      formData.append("file", file);
      let response;
      if (listingId) {
        formData.append("listingId", listingId.toString());
        response = await fetch(`/api/admin/listings/${listingId}/images`, {
          method: "POST",
          body: formData,
        });
      } else if (tempSessionId) {
        formData.append("tempSessionId", tempSessionId);
        response = await fetch(`/api/admin/listings/temp-images`, {
          method: "POST",
          body: formData,
        });
      } else {
        throw new Error("Missing listingId or tempSessionId");
      }

      // Update progress
      setUploadQueue((prev) =>
        prev.map((item) => (item.id === id ? { ...item, progress: 30 } : item)),
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || error.error || "Upload failed");
      }

      // Update progress
      setUploadQueue((prev) =>
        prev.map((item) => (item.id === id ? { ...item, progress: 80 } : item)),
      );

      const result = await response.json();
      const newImage: ListingImage = result.data;

      onImagesChange((prevImages) => [...prevImages, newImage]);

      // Mark as completed
      setUploadQueue((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, status: "completed", progress: 100 }
            : item,
        ),
      );

      toast({
        title: "Success",
        description: `${file.name} uploaded successfully`,
      });
    } catch (error) {
      console.error("Upload error:", error);

      // Mark as error
      setUploadQueue((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                status: "error",
                error:
                  error instanceof Error
                    ? error.message
                    : "Unknown error occurred",
              }
            : item,
        ),
      );

      toast({
        title: "Upload failed",
        description: `${file.name}: ${
          error instanceof Error ? error.message : "Unknown error occurred"
        }`,
        variant: "destructive",
      });
    }
  };

  const handleDeleteImage = (imageId: number) => {
    // Soft delete: mark for deletion, don't persist to DB yet
    // For temp images (new listing), we can delete immediately since they're not saved yet
    if (!listingId && tempSessionId) {
      // Temp image - delete immediately from storage
      handleImmediateDelete(imageId);
      return;
    }

    // For existing listing images: soft delete (mark for deletion)
    const newDeletions = new Set(effectivePendingDeletions);
    newDeletions.add(imageId);
    setEffectivePendingDeletions(newDeletions);

    toast({
      title: "Image marked for deletion",
      description:
        "Changes will be saved when you click Save. Click Undo to restore.",
    });
  };

  const handleUndoDelete = (imageId: number) => {
    const newDeletions = new Set(effectivePendingDeletions);
    newDeletions.delete(imageId);
    setEffectivePendingDeletions(newDeletions);

    toast({
      title: "Deletion cancelled",
      description: "Image will be kept.",
    });
  };

  // Immediate delete for temp images only
  const handleImmediateDelete = async (imageId: number) => {
    try {
      const image = images.find((img) => img.id === imageId);
      const params = new URLSearchParams({
        imageId: String(imageId),
      });
      if (tempSessionId) {
        params.set("tempSessionId", tempSessionId);
      }
      if (image?.url) {
        params.set("url", image.url);
      }

      const response = await fetch(
        `/api/admin/listings/temp-images?${params.toString()}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Delete failed");
      }

      onImagesChange((prevImages) =>
        prevImages.filter((img) => img.id !== imageId),
      );

      toast({
        title: "Success",
        description: "Image deleted successfully",
      });
    } catch (error) {
      console.error("Delete error:", error);
      toast({
        title: "Delete failed",
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    }
  };

  const retryUpload = async (uploadItem: UploadItem) => {
    // Reset item status
    setUploadQueue((prev) =>
      prev.map((item) =>
        item.id === uploadItem.id
          ? { ...item, status: "pending", progress: 0, error: undefined }
          : item,
      ),
    );

    // Retry upload
    await uploadFile(uploadItem);
  };

  const dismissError = (uploadId: string) => {
    setUploadQueue((prev) => prev.filter((item) => item.id !== uploadId));
  };

  const handleSetPrimary = async (imageId: number) => {
    try {
      const response = await fetch(
        `/api/admin/listings/${listingId}/images/${imageId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_primary: true }),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Update failed");
      }

      // Update local state
      onImagesChange((prevImages) =>
        prevImages.map((img) => ({
          ...img,
          is_primary: img.id === imageId ? true : false,
        })),
      );

      toast({
        title: "Success",
        description: "Primary image updated",
      });
    } catch (error) {
      console.error("Update error:", error);
      toast({
        title: "Update failed",
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-primary" />
            <h3 className="text-lg font-medium">Listing Gallery</h3>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                Upload up to {MAX_IMAGES} images (max 5MB each)
              </p>
            </div>
            <div className="text-sm text-muted-foreground">
              {images.length}/{MAX_IMAGES} images
            </div>
          </div>

          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
              dragActive
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-muted-foreground/50",
              (isLoading ||
                uploadQueue.some((item) => item.status === "uploading")) &&
                "opacity-50 pointer-events-none",
            )}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <div className="space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <Upload className="w-6 h-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">
                  {dragActive ? "Drop images here" : "Drag & drop images here"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  or click to browse files
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={
                  isLoading ||
                  images.length >= MAX_IMAGES ||
                  uploadQueue.some((item) => item.status === "uploading")
                }
              >
                Choose Files
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ALLOWED_TYPES.join(",")}
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          </div>

          {images.length >= MAX_IMAGES && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800/50">
              <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                Maximum number of images reached
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Upload Progress */}
      {uploadQueue.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Upload className="h-4 w-4 text-primary" />
            <h4 className="text-md font-medium">Uploading Images</h4>
          </div>
          <div className="space-y-3">
            {uploadQueue.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 p-3 rounded-lg border"
              >
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  {item.status === "completed" && (
                    <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-white" />
                    </div>
                  )}
                  {item.status === "error" && (
                    <X className="w-4 h-4 text-red-500" />
                  )}
                  {item.status === "uploading" && (
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  )}
                  {item.status === "pending" && (
                    <Upload className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {item.file.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(item.file.size / 1024 / 1024).toFixed(1)} MB
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {item.status === "uploading" && (
                    <div className="text-xs text-muted-foreground">
                      {item.progress}%
                    </div>
                  )}
                  {item.status === "error" && item.error && (
                    <>
                      <div className="text-xs text-red-500 max-w-32 truncate">
                        {item.error}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => retryUpload(item)}
                        className="text-xs h-6"
                      >
                        Retry
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => dismissError(item.id)}
                        className="text-xs h-6 px-2"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </>
                  )}
                  {item.status === "completed" && (
                    <div className="text-xs text-green-500">Done</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Pending Deletions Notice */}
      {effectivePendingDeletions.size > 0 && (
        <Card className="p-4 border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <span className="font-medium">
                {effectivePendingDeletions.size} image(s)
              </span>{" "}
              marked for deletion. Changes will be saved when you click{" "}
              <strong>Save</strong>. Click <strong>Cancel</strong> to restore
              all.
            </p>
          </div>
        </Card>
      )}

      {/* Image Grid */}
      {images.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <ImageIcon className="h-4 w-4 text-primary" />
            <h4 className="text-md font-medium">Uploaded Images</h4>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {images.map((image) => {
              const isPendingDeletion = effectivePendingDeletions.has(image.id);

              return (
                <div key={image.id} className="relative group">
                  <div
                    className={cn(
                      "relative aspect-square rounded-lg overflow-hidden bg-muted transition-all",
                      isPendingDeletion && "opacity-40 grayscale",
                    )}
                  >
                    <Image
                      src={image.url}
                      alt={image.alt_text || "Listing image"}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      className="object-cover"
                    />
                  </div>

                  {/* Pending deletion overlay */}
                  {isPendingDeletion && (
                    <div className="absolute inset-0 bg-red-500/20 rounded-lg flex flex-col items-center justify-center gap-2 border-2 border-red-500 border-dashed">
                      <div className="bg-red-500 text-white text-xs px-2 py-1 rounded font-medium">
                        Will be deleted
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleUndoDelete(image.id)}
                        className="text-xs h-7"
                      >
                        <Undo2 className="w-3 h-3 mr-1" />
                        Undo
                      </Button>
                    </div>
                  )}

                  {/* Normal overlay with actions (only show if not pending deletion) */}
                  {!isPendingDeletion && (
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleSetPrimary(image.id)}
                        disabled={image.is_primary === true || !listingId}
                        className="text-xs"
                      >
                        {image.is_primary ? "Primary" : "Set Primary"}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteImage(image.id)}
                        className="text-xs"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  )}

                  {/* Primary indicator */}
                  {image.is_primary && !isPendingDeletion && (
                    <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded">
                      Primary
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
