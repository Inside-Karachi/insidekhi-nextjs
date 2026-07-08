"use client";

import { useState, useCallback } from "react";
import { Upload, X, Link } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";

interface MenuItemImageUploadProps {
  listingId: number;
  sectionId: number;
  itemId: number;
  currentImageUrl?: string | null;
  currentImageAlt?: string | null;
  onImageUpdate: (imageUrl: string | null, imageAlt: string | null) => void;
  isLoading?: boolean;
}

export function MenuItemImageUpload({
  listingId,
  sectionId,
  itemId,
  currentImageUrl,
  currentImageAlt,
  onImageUpdate,
  isLoading = false,
}: MenuItemImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [urlInput, setUrlInput] = useState(currentImageUrl || "");
  const [altInput, setAltInput] = useState(currentImageAlt || "");
  const [uploadMode, setUploadMode] = useState<"url" | "file">("url");
  const { toast } = useToast();

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const uploadFile = useCallback(
    async (file: File) => {
      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("alt", altInput.trim());

        const response = await fetch(
          `/api/admin/listings/${listingId}/menu/sections/${sectionId}/items/${itemId}/image`,
          {
            method: "POST",
            body: formData,
          }
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Upload failed");
        }

        const data = await response.json();
        onImageUpdate(
          data.data.image_url,
          data.data.image_alt || altInput.trim()
        );
        setUrlInput(data.data.image_url);

        toast({
          title: "Success",
          description: "Image uploaded successfully!",
        });
      } catch (error) {
        console.error("Upload error:", error);
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Upload failed",
          variant: "destructive",
        });
      } finally {
        setIsUploading(false);
      }
    },
    [listingId, sectionId, itemId, altInput, onImageUpdate, setUrlInput, toast]
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 1) {
        toast({
          title: "Error",
          description: "Please upload only one image at a time.",
          variant: "destructive",
        });
        return;
      }

      const file = files[0];
      if (!file.type.startsWith("image/")) {
        toast({
          title: "Error",
          description: "Please upload a valid image file.",
          variant: "destructive",
        });
        return;
      }

      if (file.size > 2 * 1024 * 1024) {
        toast({
          title: "Error",
          description: "Image size must be less than 2MB.",
          variant: "destructive",
        });
        return;
      }

      await uploadFile(file);
    },
    [toast, uploadFile]
  );

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Error",
        description: "Please upload a valid image file.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "Image size must be less than 2MB.",
        variant: "destructive",
      });
      return;
    }

    await uploadFile(file);
  };

  const handleUrlSubmit = async () => {
    if (!urlInput.trim()) {
      toast({
        title: "Error",
        description: "Please enter a valid image URL.",
        variant: "destructive",
      });
      return;
    }

    // Check if URL is the same as current image (duplicate prevention)
    if (currentImageUrl && urlInput.trim() === currentImageUrl.trim()) {
      toast({
        title: "No Change",
        description: "The image URL is the same as the current one.",
        variant: "default",
      });
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("url", urlInput.trim());
      formData.append("alt", altInput.trim());

      const response = await fetch(
        `/api/admin/listings/${listingId}/menu/sections/${sectionId}/items/${itemId}/image`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Upload failed");
      }

      const data = await response.json();
      onImageUpdate(
        data.data.image_url,
        data.data.image_alt || altInput.trim()
      );
      setUrlInput(data.data.image_url);

      toast({
        title: "Success",
        description: "Image uploaded successfully!",
      });
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Upload failed",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = async () => {
    try {
      const response = await fetch(
        `/api/admin/listings/${listingId}/menu/sections/${sectionId}/items/${itemId}/image`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Delete failed");
      }

      onImageUpdate("", "");
      setUrlInput("");
      setAltInput("");

      toast({
        title: "Success",
        description: "Image removed successfully!",
      });
    } catch (error) {
      console.error("Delete error:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Delete failed",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="w-full">
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Menu Item Image</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={uploadMode === "url" ? "default" : "outline"}
                size="sm"
                onClick={() => setUploadMode("url")}
              >
                <Link className="w-4 h-4 mr-2" />
                URL
              </Button>
              <Button
                type="button"
                variant={uploadMode === "file" ? "default" : "outline"}
                size="sm"
                onClick={() => setUploadMode("file")}
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload
              </Button>
            </div>
          </div>

          {uploadMode === "url" ? (
            <div className="space-y-3">
              <div>
                <Label htmlFor="imageUrl" className="text-sm">
                  Image URL
                </Label>
                <Input
                  id="imageUrl"
                  type="url"
                  placeholder="https://example.com/image.jpg"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="imageAlt" className="text-sm">
                  Alt Text (Optional)
                </Label>
                <Input
                  id="imageAlt"
                  type="text"
                  placeholder="Describe the image"
                  value={altInput}
                  onChange={(e) => setAltInput(e.target.value)}
                />
              </div>
              <Button
                type="button"
                onClick={handleUrlSubmit}
                disabled={
                  !urlInput.trim() ||
                  Boolean(
                    currentImageUrl &&
                      urlInput.trim() === currentImageUrl.trim()
                  )
                }
                className="w-full"
              >
                Update Image URL
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <Label htmlFor="imageAlt" className="text-sm">
                  Alt Text (Optional)
                </Label>
                <Input
                  id="imageAlt"
                  type="text"
                  placeholder="Describe the image"
                  value={altInput}
                  onChange={(e) => setAltInput(e.target.value)}
                />
              </div>

              <div
                className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                  dragActive
                    ? "border-primary bg-primary/5"
                    : "border-gray-300 hover:border-gray-400"
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  id="file-upload"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  accept="image/*"
                  onChange={handleFileSelect}
                  disabled={isUploading || isLoading}
                />

                <div className="flex flex-col items-center justify-center space-y-2">
                  <Upload
                    className={`w-8 h-8 ${
                      dragActive ? "text-primary" : "text-gray-400"
                    }`}
                  />
                  <div className="text-sm text-gray-600">
                    {isUploading ? (
                      "Uploading..."
                    ) : (
                      <>
                        <span className="font-medium">Click to upload</span> or
                        drag and drop
                        <br />
                        <span className="text-xs">
                          JPEG, PNG, WebP up to 2MB
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {(currentImageUrl || urlInput) && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">
                Current Image Preview
              </Label>
              <div className="relative w-full max-w-xs mx-auto">
                {(() => {
                  const imageUrl = currentImageUrl || urlInput;
                  const isSupabaseUrl =
                    imageUrl?.includes("supabase") ||
                    imageUrl?.includes("menu-item-images");

                  if (isSupabaseUrl && imageUrl) {
                    // Use Next.js Image for our own Supabase URLs (optimized)
                    return (
                      <Image
                        src={imageUrl}
                        alt={currentImageAlt || altInput || "Menu item image"}
                        width={250}
                        height={150}
                        className="w-full h-auto rounded-lg object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = "/placeholder-image.png";
                        }}
                      />
                    );
                  } else if (imageUrl) {
                    // Use Next.js Image with unoptimized for external URLs
                    return (
                      <Image
                        src={imageUrl}
                        alt={currentImageAlt || altInput || "Menu item image"}
                        width={250}
                        height={150}
                        className="w-full h-auto rounded-lg object-cover"
                        unoptimized // Skip optimization for external URLs
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = "/placeholder-image.png";
                          target.alt = "Image failed to load";
                        }}
                      />
                    );
                  }
                  return null;
                })()}
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={handleRemoveImage}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
