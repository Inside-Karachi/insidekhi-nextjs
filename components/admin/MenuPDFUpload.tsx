"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Upload, X, FileText, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface MenuPDFUploadProps {
  listingId: number | null;
  currentPdfUrl?: string | null;
  onPdfUpdate: (pdfUrl: string | null) => void;
  isLoading?: boolean;
}

export function MenuPDFUpload({
  listingId,
  currentPdfUrl,
  onPdfUpdate,
  isLoading = false,
}: MenuPDFUploadProps) {
  const [isUploading, setIsUploading] = React.useState(false);
  const [isRemoving, setIsRemoving] = React.useState(false);
  const [dragActive, setDragActive] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const ALLOWED_TYPES = React.useMemo(() => ["application/pdf"], []);
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  const validateFile = React.useCallback(
    (file: File): string | null => {
      if (!ALLOWED_TYPES.includes(file.type)) {
        return "Only PDF files are allowed";
      }
      if (file.size > MAX_FILE_SIZE) {
        return "File size must be less than 10MB";
      }
      return null;
    },
    [ALLOWED_TYPES, MAX_FILE_SIZE]
  );

  const uploadFile = React.useCallback(
    async (file: File) => {
      if (!listingId) {
        toast({
          title: "Error",
          description: "Listing ID is required to upload PDF",
          variant: "destructive",
        });
        return;
      }

      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append("pdf", file);

        const response = await fetch(
          `/api/admin/listings/${listingId}/menu-pdf`,
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
        onPdfUpdate(data.data.pdf_url);

        toast({
          title: "Success",
          description: "Menu PDF uploaded successfully!",
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
    [listingId, toast, onPdfUpdate]
  );

  const handleDrag = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = React.useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length === 0) return;

      const file = files[0];
      const validationError = validateFile(file);
      if (validationError) {
        toast({
          title: "Invalid File",
          description: validationError,
          variant: "destructive",
        });
        return;
      }

      await uploadFile(file);
    },
    [toast, validateFile, uploadFile]
  );

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const validationError = validateFile(file);
    if (validationError) {
      toast({
        title: "Invalid File",
        description: validationError,
        variant: "destructive",
      });
      return;
    }

    await uploadFile(file);
  };

  const handleRemovePdf = async () => {
    if (!listingId) return;

    setIsRemoving(true);
    try {
      const response = await fetch(
        `/api/admin/listings/${listingId}/menu-pdf`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to remove PDF");
      }

      onPdfUpdate(null);
      toast({
        title: "Success",
        description: "Menu PDF removed successfully!",
      });
    } catch (error) {
      console.error("Remove error:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to remove PDF",
        variant: "destructive",
      });
    } finally {
      setIsRemoving(false);
    }
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Upload a PDF file containing your restaurant&apos;s menu. Maximum file
          size: 10MB.
        </p>
      </div>

      {/* Current PDF Display */}
      {currentPdfUrl && (
        <Card className="border-emerald-200/50 dark:border-emerald-800/50 bg-gradient-to-r from-emerald-50/50 via-emerald-25/30 to-emerald-50/50 dark:from-emerald-950/20 dark:via-emerald-900/10 dark:to-emerald-950/20 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-200 dark:from-emerald-800 dark:to-emerald-700 shadow-sm">
                  <FileText className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                    Menu PDF
                  </p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">
                    PDF document uploaded successfully
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open(currentPdfUrl, "_blank")}
                  className="text-emerald-700 dark:text-emerald-300 hover:text-emerald-800 dark:hover:text-emerald-200 hover:bg-emerald-100/50 dark:hover:bg-emerald-800/30 transition-all duration-200 rounded-lg"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemovePdf}
                  disabled={isLoading || isRemoving}
                  className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-100/50 dark:hover:bg-red-900/30 transition-all duration-200 rounded-lg disabled:opacity-50"
                >
                  {isRemoving ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                  ) : (
                    <X className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Removing State */}
      {isRemoving && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-md">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
          <span className="text-sm text-red-800 dark:text-red-200">
            Removing menu PDF...
          </span>
        </div>
      )}

      {/* Upload Area */}
      {!currentPdfUrl && (
        <Card
          className={cn(
            "border-2 border-dashed transition-colors cursor-pointer",
            dragActive
              ? "border-primary bg-primary/5"
              : "border-gray-300 hover:border-gray-400",
            isUploading && "pointer-events-none opacity-50"
          )}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={openFileDialog}
        >
          <CardContent className="p-6">
            <div className="flex flex-col items-center justify-center text-center">
              {isUploading ? (
                <>
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
                  <p className="text-sm text-muted-foreground">
                    Uploading PDF...
                  </p>
                </>
              ) : (
                <>
                  <div className="p-3 rounded-full bg-gray-100 mb-4">
                    <Upload className="h-6 w-6 text-gray-600" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Upload Menu PDF</p>
                    <p className="text-xs text-muted-foreground">
                      Drag and drop a PDF file here, or click to browse
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Maximum file size: 10MB
                    </p>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        onChange={handleFileSelect}
        className="hidden"
        disabled={isUploading || isLoading}
      />

      {/* Error States */}
      {isUploading && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span className="text-sm text-blue-800">Uploading menu PDF...</span>
        </div>
      )}
    </div>
  );
}
