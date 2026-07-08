"use client";

interface ImportPreviewRow {
  row: number;
  [key: string]: string | number;
}

interface ImportPreviewWarning {
  row: number;
  field: string;
  message: string;
  severity: "warning";
}

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  Download,
  FileText,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react";

interface ExportImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: "export" | "import";
  onImportComplete?: () => void; // Callback to refresh data after import
}

interface ImportResult {
  success: boolean;
  totalProcessed: number;
  successful: number;
  failed: number;
  skipped: number;
  updated?: number;
  fieldStats: {
    processed: number;
    skipped: number;
    errors: number;
    details: {
      socialLinks: { processed: number; skipped: number };
      coordinates: {
        processed: number;
        skipped: number;
        precisionIssues: number;
      };
      openingHours: { processed: number; skipped: number; parseErrors: number };
      categories: { processed: number; skipped: number; notFound: number };
      phoneNumbers: { processed: number; skipped: number; invalid: number };
      emails: { processed: number; skipped: number; invalid: number };
      urls: { processed: number; skipped: number; invalid: number };
    };
  };
  errors: Array<{
    row: number;
    name: string;
    error: string;
    field?: string;
  }>;
  preview?: ImportPreviewRow[];
  previewWarnings?: ImportPreviewWarning[];
  importId?: string;
  rollbackAvailable?: boolean;
}

export function ExportImportModal({
  isOpen,
  onClose,
  mode,
  onImportComplete,
}: ExportImportModalProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [importResult, setImportResult] = React.useState<ImportResult | null>(
    null,
  );
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [previewData, setPreviewData] = React.useState<
    ImportPreviewRow[] | null
  >(null);
  const [previewWarnings, setPreviewWarnings] = React.useState<
    ImportPreviewWarning[]
  >([]);

  // Export filters
  const [exportFilters, setExportFilters] = React.useState({
    status: "all",
    categoryId: "all",
    isFeatured: "all",
    search: "",
  });

  // Import options
  const [importOptions, setImportOptions] = React.useState({
    skipDuplicates: true,
    updateExisting: false,
    preview: false,
  });

  const { toast } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const modalRef = React.useRef<HTMLDivElement>(null);

  const initialBodyState = React.useRef({
    scrollHeight: 0,
    clientHeight: 0,
    scrollWidth: 0,
    clientWidth: 0,
    marginRight: "",
    paddingRight: "",
    overflow: "",
    position: "",
    minHeight: "",
    height: "",
    maxHeight: "",
  });

  const handleExport = async () => {
    try {
      setIsLoading(true);
      setProgress(10);

      const response = await fetch("/api/admin/listings/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filters: exportFilters,
          includeRelated: true,
        }),
      });

      setProgress(50);

      if (!response.ok) {
        throw new Error("Export failed");
      }

      // Create download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `listings_export_${
        new Date().toISOString().split("T")[0]
      }.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setProgress(100);

      toast({
        title: "Export Complete",
        description: "Your listings have been exported successfully.",
      });

      onClose();
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Export Failed",
        description: "There was an error exporting your listings.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setProgress(0);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setImportResult(null);
      setPreviewData(null);
      setPreviewWarnings([]);
    }
  };

  const handlePreview = async () => {
    if (!selectedFile) return;

    try {
      setIsLoading(true);
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append(
        "options",
        JSON.stringify({ ...importOptions, preview: true }),
      );

      const response = await fetch("/api/admin/listings/import", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (result.success && result.preview) {
        setPreviewData(result.preview);
        setPreviewWarnings(result.previewWarnings || []);
      } else {
        throw new Error(result.error || "Preview failed");
      }
    } catch (error) {
      console.error("Preview error:", error);
      toast({
        title: "Preview Failed",
        description: "Could not preview the CSV file.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;

    try {
      setIsLoading(true);
      setProgress(10);
      setImportResult(null);

      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append(
        "options",
        JSON.stringify({ ...importOptions, preview: false }),
      );

      setProgress(30);

      const response = await fetch("/api/admin/listings/import", {
        method: "POST",
        body: formData,
      });

      setProgress(80);

      const result = await response.json();

      if (result.success) {
        setImportResult(result);
        setProgress(100);

        toast({
          title: "Import Complete",
          description: `Successfully imported ${result.successful} listings.`,
        });

        // Trigger data refresh callback
        if (onImportComplete) {
          onImportComplete();
        }
      } else {
        throw new Error(result.error || "Import failed");
      }
    } catch (error) {
      console.error("Import error:", error);
      toast({
        title: "Import Failed",
        description: "There was an error importing your listings.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setProgress(0);
    }
  };

  const resetModal = () => {
    setSelectedFile(null);
    setImportResult(null);
    setPreviewData(null);
    setPreviewWarnings([]);
    setProgress(0);
    setExportFilters({
      status: "all",
      categoryId: "all",
      isFeatured: "all",
      search: "",
    });
    setImportOptions({
      skipDuplicates: true,
      updateExisting: false,
      preview: false,
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  React.useEffect(() => {
    if (!isOpen) {
      resetModal();
    }
  }, [isOpen]);

  // Initialize body state capture
  React.useEffect(() => {
    const body = document.body;

    // Capture the pristine body state
    initialBodyState.current = {
      scrollHeight: body.scrollHeight,
      clientHeight: body.clientHeight,
      scrollWidth: body.scrollWidth,
      clientWidth: body.clientWidth,
      marginRight: body.style.marginRight || getComputedStyle(body).marginRight,
      paddingRight:
        body.style.paddingRight || getComputedStyle(body).paddingRight,
      overflow: body.style.overflow || getComputedStyle(body).overflow,
      position: body.style.position || getComputedStyle(body).position,
      minHeight: body.style.minHeight || getComputedStyle(body).minHeight,
      height: body.style.height || getComputedStyle(body).height,
      maxHeight: body.style.maxHeight || getComputedStyle(body).maxHeight,
    };

    // Initial body state captured
  }, []); // Empty dependency array - run only once on mount

  // Apply CSS containment when modal opens
  React.useEffect(() => {
    if (isOpen && modalRef.current) {
      // Dialog content mounted
      // Dialog mounted

      // Apply CSS containment to prevent layout shifts
      modalRef.current.style.contain = "layout style paint";
      modalRef.current.style.isolation = "isolate";
      modalRef.current.style.position = "relative";

      // Applied CSS containment to modal
    }
  }, [isOpen]);

  // Prevent layout shift when Radix Select dropdowns open
  React.useEffect(() => {
    if (isOpen) {
      const body = document.body;
      const removeScrollLock = () => {
        body.hasAttribute("data-scroll-locked");

        body.removeAttribute("data-scroll-locked");
        body.style.marginRight = "";
        body.style.paddingRight = "";
        body.style.overflow = "";
      };

      // Remove immediately and set up observer to catch any future additions
      removeScrollLock();

      const observer = new MutationObserver((mutations) => {
        let scrollLockDetected = false;
        mutations.forEach((mutation) => {
          if (mutation.type === "attributes") {
            if (
              mutation.attributeName === "data-scroll-locked" &&
              body.hasAttribute("data-scroll-locked")
            ) {
              scrollLockDetected = true;
            }
            if (mutation.attributeName === "style") {
              const newStyle = body.getAttribute("style") || "";
              if (
                newStyle.includes("margin-right") ||
                newStyle.includes("padding-right") ||
                newStyle.includes("overflow")
              ) {
                // Style change detected
              }
            }
          }
        });

        if (scrollLockDetected) {
          removeScrollLock();
        }
      });

      observer.observe(body, {
        attributes: true,
        attributeFilter: ["data-scroll-locked", "style"],
        attributeOldValue: true,
      });

      return () => {
        observer.disconnect();
        removeScrollLock();
      };
    }
  }, [isOpen]);

  // Prevent body height/layout shifts when modal opens - PROACTIVE APPROACH
  React.useEffect(() => {
    if (isOpen) {
      // Body stabilization active

      const body = document.body;
      const html = document.documentElement;

      // Immediately restore initial body state to prevent any shifts
      const restoreInitialState = () => {
        // Force body to maintain exact initial dimensions
        body.style.setProperty(
          "height",
          initialBodyState.current.height,
          "important",
        );
        body.style.setProperty(
          "min-height",
          initialBodyState.current.minHeight,
          "important",
        );
        body.style.setProperty(
          "max-height",
          initialBodyState.current.maxHeight,
          "important",
        );
        body.style.setProperty(
          "margin-right",
          initialBodyState.current.marginRight,
          "important",
        );
        body.style.setProperty(
          "padding-right",
          initialBodyState.current.paddingRight,
          "important",
        );
        body.style.setProperty(
          "overflow",
          initialBodyState.current.overflow,
          "important",
        );
        body.style.setProperty(
          "position",
          initialBodyState.current.position,
          "important",
        );

        // Prevent any layout shifts by fixing body dimensions
        if (
          !initialBodyState.current.height ||
          initialBodyState.current.height === "auto"
        ) {
          body.style.setProperty(
            "height",
            `${initialBodyState.current.scrollHeight}px`,
            "important",
          );
        }

        // Also ensure html doesn't change
        html.style.overflow = "visible";
        html.style.height = "auto";
      };

      // Restore immediately
      restoreInitialState();

      // Set up aggressive monitoring to prevent any changes
      const preventBodyChanges = () => {
        const currentScrollHeight = body.scrollHeight;
        const currentClientHeight = body.clientHeight;

        // If body dimensions have changed from initial state, restore them
        if (
          Math.abs(
            currentScrollHeight - initialBodyState.current.scrollHeight,
          ) > 5 ||
          Math.abs(
            currentClientHeight - initialBodyState.current.clientHeight,
          ) > 5
        ) {
          restoreInitialState();
        }

        // Check for any style changes that might affect layout
        const computedStyle = getComputedStyle(body);
        if (
          computedStyle.overflow !== initialBodyState.current.overflow ||
          computedStyle.position !== initialBodyState.current.position ||
          computedStyle.marginRight !== initialBodyState.current.marginRight
        ) {
          // Body style shift detected - restoring
          restoreInitialState();
        }
      };

      // Monitor continuously with high frequency
      const stabilizationInterval = setInterval(preventBodyChanges, 16); // ~60fps

      // Also monitor for modal-specific changes
      const modalStabilizationTimer = setTimeout(() => {
        // Modal stabilization check
        preventBodyChanges();
      }, 100);

      return () => {
        // Cleaning up body stabilization
        clearInterval(stabilizationInterval);
        clearTimeout(modalStabilizationTimer);

        // Restore initial state one final time on cleanup
        restoreInitialState();
      };
    }
  }, [isOpen]);

  // Modal content detection with multiple strategies
  React.useEffect(() => {
    if (isOpen) {
      // Modal detection starting

      let retryCount = 0;
      const maxRetries = 15;
      let resizeObserver: ResizeObserver | null = null;

      const findModalContent = (): HTMLElement | null => {
        // Try multiple selectors for Radix Dialog content
        const selectors = [
          "[data-radix-dialog-content]",
          "[data-radix-portal] [data-radix-dialog-content]",
          ".fixed [data-radix-dialog-content]",
          '[role="dialog"]',
          '[data-state="open"][data-radix-dialog-content]',
          "[data-radix-dialog-overlay] + [data-radix-dialog-content]",
          "body > div:last-child [data-radix-dialog-content]",
        ];

        for (const selector of selectors) {
          const element = document.querySelector(selector) as HTMLElement;
          if (element && element.offsetWidth > 0 && element.offsetHeight > 0) {
            // Found modal content with selector
            return element;
          }
        }
        return null;
      };

      const setupEnhancedTracking = () => {
        const modalContent = findModalContent();

        if (modalContent) {
          // Modal tracking active

          resizeObserver = new ResizeObserver(() => {
            // Modal resize detected
          });

          resizeObserver.observe(modalContent);
          // ResizeObserver active

          return true;
        } else {
          retryCount++;
          if (retryCount < maxRetries) {
            const delay = Math.min(50 + retryCount * 10, 200); // Progressive delay
            // Detection retry
            setTimeout(setupEnhancedTracking, delay);
          } else {
            // Detection failed
          }
          return false;
        }
      };

      // Start with minimal delay for portal rendering
      setTimeout(setupEnhancedTracking, 5);

      return () => {
        // Cleaning up modal detection
        if (resizeObserver) {
          resizeObserver.disconnect();
        }
      };
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        ref={modalRef}
        className="max-w-4xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-background via-background to-background/95 border-border/50 shadow-2xl"
        style={{
          contain: "layout style paint",
          isolation: "isolate",
        }}
      >
        <DialogHeader className="space-y-4 pb-6">
          <div className="flex items-center justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl" />
              <div className="relative bg-gradient-to-br from-primary to-primary/80 p-4 rounded-full shadow-lg">
                {mode === "export" ? (
                  <Download className="h-8 w-8 text-white" />
                ) : (
                  <Upload className="h-8 w-8 text-white" />
                )}
              </div>
            </div>
          </div>
          <div className="text-center space-y-2">
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
              {mode === "export" ? "Export Listings" : "Import Listings"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground max-w-md mx-auto">
              {mode === "export"
                ? "Export your listings data to a CSV file with customizable filters. Use the search field to find specific listings by name or description."
                : "Import listings from a CSV file. Preview data before importing."}
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="space-y-8">
          {mode === "export" ? (
            // Export section
            <div className="space-y-6">
              {/* Search Section - Highlighted */}
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 rounded-2xl" />
                <div className="relative bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6 shadow-lg">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">
                        Search & Filter
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Find specific listings by name or description
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label
                        htmlFor="search"
                        className="text-sm font-medium text-foreground/90"
                      >
                        Search Listings
                      </Label>
                      <div className="relative">
                        <Input
                          id="search"
                          placeholder="Type to search by name or description..."
                          value={exportFilters.search}
                          onChange={(e) =>
                            setExportFilters((prev) => ({
                              ...prev,
                              search: e.target.value,
                            }))
                          }
                          className="pl-10 bg-background/50 border-border/50 focus:border-primary/50 focus:ring-primary/20 transition-all duration-200"
                        />
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                      {exportFilters.search && (
                        <p className="text-xs text-muted-foreground">
                          Will export only listings containing &ldquo;
                          {exportFilters.search}&rdquo; in name or description
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Filters grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-card/30 backdrop-blur-sm border border-border/50 rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-200">
                  <div className="space-y-3">
                    <Label
                      htmlFor="status"
                      className="text-sm font-medium text-foreground/90 flex items-center gap-2"
                    >
                      <div className="w-2 h-2 bg-primary rounded-full" />
                      Status Filter
                    </Label>
                    <Select
                      value={exportFilters.status}
                      onValueChange={(value) =>
                        setExportFilters((prev) => ({ ...prev, status: value }))
                      }
                    >
                      <SelectTrigger className="bg-background/50 border-border/50 focus:border-primary/50 focus:ring-primary/20">
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="published">Published</SelectItem>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="bg-card/30 backdrop-blur-sm border border-border/50 rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-200">
                  <div className="space-y-3">
                    <Label
                      htmlFor="featured"
                      className="text-sm font-medium text-foreground/90 flex items-center gap-2"
                    >
                      <div className="w-2 h-2 bg-primary rounded-full" />
                      Featured Filter
                    </Label>
                    <Select
                      value={exportFilters.isFeatured}
                      onValueChange={(value) =>
                        setExportFilters((prev) => ({
                          ...prev,
                          isFeatured: value,
                        }))
                      }
                    >
                      <SelectTrigger className="bg-background/50 border-border/50 focus:border-primary/50 focus:ring-primary/20">
                        <SelectValue placeholder="All listings" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Listings</SelectItem>
                        <SelectItem value="true">Featured Only</SelectItem>
                        <SelectItem value="false">Non-Featured Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Export Summary */}
              <div className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 rounded-xl p-4 border border-primary/20">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Download className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">
                      Export Summary
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {exportFilters.search
                        ? `Exporting listings matching "${exportFilters.search}"`
                        : "Exporting all matching listings"}{" "}
                      • CSV format with all related data
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Import section
            <div className="space-y-6">
              {/* File Upload Section */}
              <div className="bg-card/30 backdrop-blur-sm border border-border/50 rounded-xl p-6 shadow-sm">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Upload className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">
                        File Upload
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Select a CSV file to import listings
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="file"
                      className="text-sm font-medium text-foreground/90"
                    >
                      CSV File
                    </Label>
                    <div className="flex items-center gap-3">
                      <Input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv"
                        onChange={handleFileSelect}
                        className="flex-1 bg-background/50 border-border/50 focus:border-primary/50 focus:ring-primary/20 transition-all duration-200"
                      />
                      {selectedFile && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 rounded-lg border border-primary/20">
                          <FileText className="h-4 w-4 text-primary" />
                          <span className="text-sm font-medium text-primary">
                            {selectedFile.name}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {selectedFile && (
                <div className="space-y-6">
                  {/* Import Options */}
                  <div className="bg-card/30 backdrop-blur-sm border border-border/50 rounded-xl p-6 shadow-sm">
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <CheckCircle className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground">
                            Import Options
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            Configure how to handle the import
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                          <Checkbox
                            id="skipDuplicates"
                            checked={importOptions.skipDuplicates}
                            onCheckedChange={(checked) =>
                              setImportOptions((prev) => ({
                                ...prev,
                                skipDuplicates: checked as boolean,
                              }))
                            }
                          />
                          <div>
                            <Label
                              htmlFor="skipDuplicates"
                              className="font-medium cursor-pointer"
                            >
                              Skip Duplicates
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              Skip listings with matching names
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                          <Checkbox
                            id="updateExisting"
                            checked={importOptions.updateExisting}
                            onCheckedChange={(checked) =>
                              setImportOptions((prev) => ({
                                ...prev,
                                updateExisting: checked as boolean,
                              }))
                            }
                          />
                          <div>
                            <Label
                              htmlFor="updateExisting"
                              className="font-medium cursor-pointer"
                            >
                              Update Existing
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              Update listings with matching names
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-center gap-4 pt-4">
                    <Button
                      variant="outline"
                      onClick={handlePreview}
                      disabled={isLoading}
                      className="px-6 py-2 border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all duration-200"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Preview Data
                    </Button>
                    <Button
                      onClick={handleImport}
                      disabled={isLoading}
                      className="px-6 py-2 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg hover:shadow-xl transition-all duration-200"
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Upload className="h-4 w-4 mr-2" />
                      )}
                      Import Listings
                    </Button>
                  </div>
                </div>
              )}

              {/* Preview Data */}
              {previewData && (
                <div className="space-y-2">
                  <Label>Preview (First 5 rows)</Label>

                  {previewWarnings.length > 0 && (
                    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
                      <p className="text-sm font-medium text-amber-900">
                        JSON Diagnostics ({previewWarnings.length})
                      </p>
                      <p className="text-xs text-amber-800 mt-1">
                        These rows have JSON payload issues in refactor columns
                        and may be skipped for those fields.
                      </p>
                      <ul className="mt-2 max-h-32 overflow-y-auto text-xs text-amber-900 space-y-1">
                        {previewWarnings.map((warning, index) => (
                          <li key={`${warning.row}-${warning.field}-${index}`}>
                            Row {warning.row} - {warning.field}:{" "}
                            {warning.message}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="border rounded-lg overflow-hidden">
                    <div className="max-h-60 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted">
                          <tr>
                            <th className="p-2 text-left">Row</th>
                            <th className="p-2 text-left">Name</th>
                            <th className="p-2 text-left">Address</th>
                            <th className="p-2 text-left">Phone</th>
                          </tr>
                        </thead>
                        <tbody>
                          {previewData.map((row, index) => (
                            <tr key={index} className="border-t">
                              <td className="p-2">{row.row}</td>
                              <td className="p-2">{row.Name}</td>
                              <td className="p-2">{row.Address}</td>
                              <td className="p-2">{row.Phone}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Progress */}
          {isLoading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Processing...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          )}

          {/* Import Results */}
          {importResult && (
            <Alert
              className={
                importResult.success ? "border-green-500" : "border-red-500"
              }
            >
              <div className="flex items-start gap-2">
                {importResult.success ? (
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500 mt-0.5" />
                )}
                <div className="flex-1">
                  <AlertDescription>
                    <div className="space-y-2">
                      <p className="font-medium">
                        Import Results: {importResult.successful} imported,{" "}
                        {importResult.updated || 0} updated,{" "}
                        {importResult.failed} failed, {importResult.skipped}{" "}
                        skipped
                      </p>

                      {/* Field Statistics */}
                      {importResult.fieldStats && (
                        <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                          <p className="text-sm font-medium mb-2">
                            📊 Field Processing Summary:
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                            <div className="space-y-1">
                              <div>
                                <span className="font-medium">
                                  Social Links:
                                </span>{" "}
                                <span className="text-green-600">
                                  {
                                    importResult.fieldStats.details.socialLinks
                                      .processed
                                  }{" "}
                                  processed
                                </span>
                                {importResult.fieldStats.details.socialLinks
                                  .skipped > 0 && (
                                  <span className="text-yellow-600">
                                    ,{" "}
                                    {
                                      importResult.fieldStats.details
                                        .socialLinks.skipped
                                    }{" "}
                                    skipped
                                  </span>
                                )}
                              </div>
                              <div>
                                <span className="font-medium">
                                  Coordinates:
                                </span>{" "}
                                <span className="text-green-600">
                                  {
                                    importResult.fieldStats.details.coordinates
                                      .processed
                                  }{" "}
                                  processed
                                </span>
                                {importResult.fieldStats.details.coordinates
                                  .precisionIssues > 0 && (
                                  <span className="text-yellow-600">
                                    ,{" "}
                                    {
                                      importResult.fieldStats.details
                                        .coordinates.precisionIssues
                                    }{" "}
                                    precision issues
                                  </span>
                                )}
                              </div>
                              <div>
                                <span className="font-medium">
                                  Opening Hours:
                                </span>{" "}
                                <span className="text-green-600">
                                  {
                                    importResult.fieldStats.details.openingHours
                                      .processed
                                  }{" "}
                                  processed
                                </span>
                                {importResult.fieldStats.details.openingHours
                                  .parseErrors > 0 && (
                                  <span className="text-red-600">
                                    ,{" "}
                                    {
                                      importResult.fieldStats.details
                                        .openingHours.parseErrors
                                    }{" "}
                                    parse errors
                                  </span>
                                )}
                                {importResult.fieldStats.details.openingHours
                                  .skipped > 0 && (
                                  <span className="text-yellow-600">
                                    ,{" "}
                                    {
                                      importResult.fieldStats.details
                                        .openingHours.skipped
                                    }{" "}
                                    skipped
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="space-y-1">
                              <div>
                                <span className="font-medium">Categories:</span>{" "}
                                <span className="text-green-600">
                                  {
                                    importResult.fieldStats.details.categories
                                      .processed
                                  }{" "}
                                  processed
                                </span>
                                {importResult.fieldStats.details.categories
                                  .notFound > 0 && (
                                  <span className="text-red-600">
                                    ,{" "}
                                    {
                                      importResult.fieldStats.details.categories
                                        .notFound
                                    }{" "}
                                    not found
                                  </span>
                                )}
                              </div>
                              <div>
                                <span className="font-medium">
                                  Phone Numbers:
                                </span>{" "}
                                <span className="text-green-600">
                                  {
                                    importResult.fieldStats.details.phoneNumbers
                                      .processed
                                  }{" "}
                                  processed
                                </span>
                                {importResult.fieldStats.details.phoneNumbers
                                  .invalid > 0 && (
                                  <span className="text-red-600">
                                    ,{" "}
                                    {
                                      importResult.fieldStats.details
                                        .phoneNumbers.invalid
                                    }{" "}
                                    invalid
                                  </span>
                                )}
                              </div>
                              <div>
                                <span className="font-medium">Emails:</span>{" "}
                                <span className="text-green-600">
                                  {
                                    importResult.fieldStats.details.emails
                                      .processed
                                  }{" "}
                                  processed
                                </span>
                                {importResult.fieldStats.details.emails
                                  .invalid > 0 && (
                                  <span className="text-red-600">
                                    ,{" "}
                                    {
                                      importResult.fieldStats.details.emails
                                        .invalid
                                    }{" "}
                                    invalid
                                  </span>
                                )}
                              </div>
                              <div>
                                <span className="font-medium">URLs:</span>{" "}
                                <span className="text-green-600">
                                  {
                                    importResult.fieldStats.details.urls
                                      .processed
                                  }{" "}
                                  processed
                                </span>
                                {importResult.fieldStats.details.urls.invalid >
                                  0 && (
                                  <span className="text-red-600">
                                    ,{" "}
                                    {
                                      importResult.fieldStats.details.urls
                                        .invalid
                                    }{" "}
                                    invalid
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Import Details */}
                      {importResult.importId && (
                        <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                          <p className="font-medium text-blue-800">
                            Import ID: {importResult.importId}
                          </p>
                          {importResult.rollbackAvailable && (
                            <p className="text-blue-600">
                              Rollback available if needed
                            </p>
                          )}
                        </div>
                      )}

                      {importResult.errors.length > 0 && (
                        <div className="mt-3">
                          <p className="text-sm font-medium text-red-700 mb-2">
                            ⚠️ Errors Found ({importResult.errors.length}):
                          </p>
                          <div className="max-h-40 overflow-y-auto space-y-2 border border-red-200 rounded p-2 bg-red-50">
                            {importResult.errors
                              .slice(0, 10)
                              .map((error, index) => (
                                <div
                                  key={index}
                                  className="text-xs p-2 bg-white border border-red-100 rounded"
                                >
                                  <div className="font-medium text-red-800">
                                    Row {error.row}: {error.name}
                                  </div>
                                  <div className="text-red-600 mt-1">
                                    {error.error}
                                    {error.field && (
                                      <span className="ml-2 px-1 py-0.5 bg-red-100 text-red-700 rounded text-xs">
                                        Field: {error.field}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            {importResult.errors.length > 10 && (
                              <p className="text-xs text-red-600 text-center py-2">
                                ... and {importResult.errors.length - 10} more
                                errors
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </AlertDescription>
                </div>
              </div>
            </Alert>
          )}

          {/* Actions */}
          {/* Footer Actions */}
          <div className="flex justify-end gap-4 pt-6 border-t border-border/50">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="px-6 py-2 border-border/50 hover:border-border hover:bg-muted/50 transition-all duration-200"
            >
              Cancel
            </Button>
            {mode === "export" && (
              <Button
                onClick={handleExport}
                disabled={isLoading}
                className="px-6 py-2 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg hover:shadow-xl transition-all duration-200"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Export Listings
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
