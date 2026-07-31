"use client";

import * as React from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Upload, X, ImageIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface FeaturedImageUploadProps {
  imageUrl: string | null;
  onUploaded: (tempFileName: string, imageUrl: string) => void;
  onRemove: () => void;
  disabled?: boolean;
}

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 2 * 1024 * 1024;

export function FeaturedImageUpload({
  imageUrl,
  onUploaded,
  onRemove,
  disabled,
}: FeaturedImageUploadProps) {
  const [dragActive, setDragActive] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const uploadFile = async (file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast({
        title: "Invalid file",
        description: "Only JPEG, PNG, and WebP images are allowed.",
        variant: "destructive",
      });
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: "File too large",
        description: "Image must be smaller than 2MB.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/writer/blogs/temp-images", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Upload failed");
      }

      onUploaded(result.data.tempFileName, result.data.image_url);
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (disabled || uploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  };

  if (imageUrl) {
    return (
      <div className="relative rounded-xl overflow-hidden border border-border/50 aspect-[16/9] max-w-md">
        <Image src={imageUrl} alt="Featured image" fill className="object-cover" />
        {!disabled && (
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2 h-8 w-8"
            onClick={onRemove}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      onDragEnter={(e) => {
        e.preventDefault();
        if (!disabled) setDragActive(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setDragActive(false);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      onClick={() => !disabled && !uploading && fileInputRef.current?.click()}
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 max-w-md cursor-pointer transition-colors",
        dragActive ? "border-primary bg-primary/5" : "border-border/50",
        (disabled || uploading) && "opacity-60 cursor-not-allowed",
      )}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_TYPES.join(",")}
        className="hidden"
        onChange={handleFileSelect}
        disabled={disabled || uploading}
      />
      {uploading ? (
        <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
      ) : (
        <ImageIcon className="h-8 w-8 text-muted-foreground" />
      )}
      <p className="text-sm text-muted-foreground text-center">
        {uploading ? (
          "Uploading..."
        ) : (
          <>
            <Upload className="h-3.5 w-3.5 inline mr-1" />
            Drag & drop or click to upload a featured image
          </>
        )}
      </p>
      <p className="text-xs text-muted-foreground">JPEG, PNG, or WebP, up to 2MB</p>
    </div>
  );
}
