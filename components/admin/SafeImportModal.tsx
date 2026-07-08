"use client";

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
import { Progress } from "@/components/ui/progress";
// Removed unused Alert, AlertDescription
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  FileText,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2,
  Shield,
  History,
  Eye,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Play,
  BarChart3,
  Share2,
  MapPin,
  Clock,
  Tag,
  Phone,
  Mail,
  Link,
} from "lucide-react";

interface SafeImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: () => void; // Callback to refresh data after import
}

interface ImportHistory {
  id: number;
  filename: string;
  total_records: number;
  successful_imports: number;
  failed_imports: number;
  status: "completed" | "failed" | "rolled_back";
  import_type: string;
  started_at: string;
  completed_at?: string;
  rollback_available: boolean;
  profiles?: {
    username: string | null;
    full_name: string | null;
    role: string;
  };
}

interface ImportOptions {
  skipDuplicates: boolean;
  updateExisting: boolean;
  preview: boolean;
  dryRun: boolean;
}

interface ImportResult {
  success: boolean;
  totalProcessed: number;
  successful: number;
  failed: number;
  skipped: number;
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
  preview?: import("@/types/import.types").ImportPreviewRow[];
  dryRun?: import("@/types/import.types").ImportDryRunRow[];
  importId?: string;
  rollbackAvailable?: boolean;
}

const HISTORY_PAGE_SIZE = 20;

export function SafeImportModal({
  isOpen,
  onClose,
  onImportComplete,
}: SafeImportModalProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = React.useState<"import" | "history">(
    "import",
  );
  const [file, setFile] = React.useState<File | null>(null);
  const [options, setOptions] = React.useState<ImportOptions>({
    skipDuplicates: true,
    updateExisting: false,
    preview: false,
    dryRun: false,
  });
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [progressMessage, setProgressMessage] = React.useState("");
  const [result, setResult] = React.useState<ImportResult | null>(null);
  const [importHistory, setImportHistory] = React.useState<ImportHistory[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = React.useState(false);
  const [historyPage, setHistoryPage] = React.useState(0);
  const [historyTotal, setHistoryTotal] = React.useState(0);
  const [historyHasMore, setHistoryHasMore] = React.useState(false);
  const [isDragOver, setIsDragOver] = React.useState(false);
  const [dragCounter, setDragCounter] = React.useState(0);
  const [isFileDialogOpen, setIsFileDialogOpen] = React.useState(false);

  const modalRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const progressIntervalRef = React.useRef<ReturnType<
    typeof setInterval
  > | null>(null);

  const stopAmbientProgress = React.useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []);

  const startAmbientProgress = React.useCallback(() => {
    stopAmbientProgress();
    progressIntervalRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) {
          if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
          }
          return prev;
        }
        const increment = prev < 40 ? 8 : prev < 60 ? 6 : prev < 80 ? 4 : 2;
        const next = Math.min(prev + increment, 95);
        return next;
      });
    }, 1600);
  }, [stopAmbientProgress]);

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

  // Move loadImportHistory above useEffect
  const loadImportHistory = React.useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const offset = historyPage * HISTORY_PAGE_SIZE;
      const query = new URLSearchParams({
        limit: HISTORY_PAGE_SIZE.toString(),
        offset: offset.toString(),
      });

      const response = await fetch(
        `/api/admin/listings/import/rollback?${query.toString()}`,
      );
      const data = await response.json();

      if (data.success) {
        const history = Array.isArray(data.history)
          ? data.history
          : Array.isArray(data.imports)
            ? data.imports
            : [];

        const pagination = data.pagination ?? {};
        const total =
          typeof pagination.total === "number"
            ? pagination.total
            : history.length;
        const hasMore =
          typeof pagination.hasMore === "boolean"
            ? pagination.hasMore
            : total > offset + history.length ||
              history.length === HISTORY_PAGE_SIZE;

        if (
          history.length === 0 &&
          total > 0 &&
          historyPage > 0 &&
          offset >= total
        ) {
          const maxPage = Math.max(Math.ceil(total / HISTORY_PAGE_SIZE) - 1, 0);
          setHistoryPage(maxPage);
          return;
        }

        setImportHistory(history);
        setHistoryTotal(total);
        setHistoryHasMore(hasMore);
      } else {
        toast({
          title: "Failed to load import history",
          description: data.error || "Unknown error",
          variant: "destructive",
        });
        setImportHistory([]);
        setHistoryTotal(0);
        setHistoryHasMore(false);
      }
    } catch (error) {
      toast({
        title: "Error loading import history",
        description: String(error),
        variant: "destructive",
      });
      setImportHistory([]);
      setHistoryTotal(0);
      setHistoryHasMore(false);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [historyPage, toast]);

  // Load import history on mount
  React.useEffect(() => {
    if (isOpen && activeTab === "history") {
      loadImportHistory();
    }
  }, [isOpen, activeTab, loadImportHistory]);

  // Reset file dialog state when modal closes
  React.useEffect(() => {
    if (!isOpen) {
      setIsFileDialogOpen(false);
      setIsDragOver(false);
      setDragCounter(0);
      setHistoryPage(0);
      setHistoryTotal(0);
      setHistoryHasMore(false);
      setImportHistory([]);
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

  // (Removed duplicate definition)

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];

    if (selectedFile) {
      if (!selectedFile.name.endsWith(".csv")) {
        toast({
          title: "Invalid file type",
          description: "Please select a CSV file",
          variant: "destructive",
        });
        // Reset the input value to allow re-selection of the same file
        resetFileInput();
        setIsFileDialogOpen(false);
        return;
      }
      setFile(selectedFile);
      setResult(null);
    }

    // Always reset dialog state after file selection attempt
    setIsFileDialogOpen(false);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter((prev) => prev + 1);
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter((prev) => prev - 1);
    if (dragCounter - 1 === 0) {
      setIsDragOver(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    setDragCounter(0);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const droppedFile = files[0];
      if (!droppedFile.name.endsWith(".csv")) {
        toast({
          title: "Invalid file type",
          description: "Please drop a CSV file",
          variant: "destructive",
        });
        return;
      }
      setFile(droppedFile);
      setResult(null);
    }
  };

  const handleFileUploadClick = () => {
    // Prevent opening file picker if already open or if processing
    if (isFileDialogOpen || isProcessing) return;

    // If a file is already selected and we're not in drag state, don't reopen picker
    if (file && !isDragOver) return;

    setIsFileDialogOpen(true);
    fileInputRef.current?.click();
  };

  const handleFileInputFocus = () => {
    setIsFileDialogOpen(true);
  };

  const resetFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileInputBlur = () => {
    // Use a longer delay to ensure file selection is complete
    setTimeout(() => {
      // Only reset if we're not processing and no file was selected
      if (!isProcessing && !file) {
        setIsFileDialogOpen(false);
      }
    }, 300);
  };

  React.useEffect(() => {
    return () => {
      stopAmbientProgress();
    };
  }, [stopAmbientProgress]);

  const handleImport = async () => {
    if (!file) return;

    stopAmbientProgress();
    setIsProcessing(true);
    setProgress(0);
    setProgressMessage("Initializing import...");
    setResult(null);

    try {
      setProgress(10);
      setProgressMessage("Validating CSV file...");

      const formData = new FormData();
      formData.append("file", file);
      formData.append("options", JSON.stringify(options));

      setProgress(20);
      setProgressMessage("Uploading import bundle to the server...");

      if (!options.preview && !options.dryRun) {
        startAmbientProgress();
      }

      const response = await fetch("/api/admin/listings/import", {
        method: "POST",
        body: formData,
      });

      stopAmbientProgress();
      setProgress(50);
      setProgressMessage("Analyzing records...");

      const data = await response.json();

      setProgress(80);
      setProgressMessage("Finalizing results...");

      if (data.success) {
        stopAmbientProgress();
        setResult(data);
        setProgress(100);
        setProgressMessage("Import completed successfully!");
        toast({
          title: "Import completed",
          description: `${data.successful} successful, ${data.failed} failed`,
        });

        // Trigger data refresh callback
        if (onImportComplete) {
          onImportComplete();
        }

        // Reload history if we're on the history tab
        if (activeTab === "history") {
          if (historyPage === 0) {
            loadImportHistory();
          } else {
            setHistoryPage(0);
          }
        }
      } else {
        stopAmbientProgress();
        setProgress(100);
        setProgressMessage("Import failed");
        toast({
          title: "Import failed",
          description: data.error || "Unknown error occurred",
          variant: "destructive",
        });
      }
    } catch {
      stopAmbientProgress();
      setProgress(100);
      setProgressMessage("Import failed");
      toast({
        title: "Import failed",
        description: "Network error occurred",
        variant: "destructive",
      });
    } finally {
      stopAmbientProgress();
      setIsProcessing(false);
    }
  };

  const handleRollback = async (importId: number) => {
    if (
      !confirm(
        "Are you sure you want to rollback this import? This action cannot be undone.",
      )
    ) {
      return;
    }

    try {
      const response = await fetch("/api/admin/listings/import/rollback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ importId }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Rollback successful",
          description: data.message,
        });
        loadImportHistory();
      } else {
        toast({
          title: "Rollback failed",
          description: data.error || "Unknown error occurred",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Rollback failed",
        description: "Network error occurred",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge variant="default" className="bg-green-100 text-green-800">
            Completed
          </Badge>
        );
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      case "rolled_back":
        return <Badge variant="secondary">Rolled Back</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const importHistoryLength = importHistory.length;

  const paginationSummary = React.useMemo(() => {
    const baseTotal =
      historyTotal > 0
        ? historyTotal
        : historyPage * HISTORY_PAGE_SIZE + importHistoryLength;

    if (importHistoryLength === 0) {
      const totalPages =
        baseTotal === 0
          ? 1
          : Math.max(1, Math.ceil(baseTotal / HISTORY_PAGE_SIZE));

      return {
        total: baseTotal,
        pageStart: 0,
        pageEnd: 0,
        totalPages,
        canGoNext: historyHasMore || historyPage < totalPages - 1,
        canGoPrev: historyPage > 0,
      } as const;
    }

    const pageStart = historyPage * HISTORY_PAGE_SIZE + 1;
    const pageEnd = Math.min(baseTotal, pageStart + importHistoryLength - 1);
    const totalPages = Math.max(1, Math.ceil(baseTotal / HISTORY_PAGE_SIZE));

    return {
      total: baseTotal,
      pageStart,
      pageEnd,
      totalPages,
      canGoNext: historyHasMore || historyPage < totalPages - 1,
      canGoPrev: historyPage > 0,
    } as const;
  }, [historyHasMore, historyPage, historyTotal, importHistoryLength]);

  const {
    total: paginationTotal,
    pageStart,
    pageEnd,
    totalPages,
    canGoNext,
    canGoPrev,
  } = paginationSummary;

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
                <Shield className="h-8 w-8 text-white" />
              </div>
            </div>
          </div>
          <div className="text-center space-y-2">
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
              Safe Import System
            </DialogTitle>
            <DialogDescription className="text-muted-foreground max-w-md mx-auto">
              Import listings with full safety controls, preview, and rollback
              capabilities
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="space-y-8">
          <Tabs
            value={activeTab}
            onValueChange={(value) =>
              setActiveTab(value as "import" | "history")
            }
          >
            <TabsList className="grid w-full grid-cols-2 bg-muted/50 p-1 rounded-xl">
              <TabsTrigger
                value="import"
                className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg transition-all duration-200"
              >
                <div className="p-1 bg-primary/10 rounded-md">
                  <Upload className="h-4 w-4 text-primary" />
                </div>
                Import Listings
              </TabsTrigger>
              <TabsTrigger
                value="history"
                className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg transition-all duration-200"
              >
                <div className="p-1 bg-primary/10 rounded-md">
                  <History className="h-4 w-4 text-primary" />
                </div>
                Import History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="import" className="space-y-6 mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* File Upload Section */}
                <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6 shadow-lg">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">
                        File Upload
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Drag & drop or click to select a CSV file containing
                        your listings data
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label
                        htmlFor="file-upload"
                        className="text-sm font-medium text-foreground/90"
                      >
                        CSV File
                      </Label>

                      {/* Drag and Drop Area */}
                      <div
                        className={`relative border-2 border-dashed rounded-lg p-6 transition-all duration-200 cursor-pointer ${
                          isDragOver
                            ? "border-primary bg-primary/5 scale-[1.02]"
                            : isFileDialogOpen
                              ? "border-primary/50 bg-primary/5"
                              : "border-border/50 hover:border-primary/50 hover:bg-primary/5"
                        }`}
                        onDragEnter={handleDragEnter}
                        onDragLeave={handleDragLeave}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        onClick={handleFileUploadClick}
                      >
                        <div className="text-center">
                          <div
                            className={`inline-flex items-center justify-center mb-4 p-3 rounded-full transition-colors duration-200 ${
                              isDragOver ? "bg-primary/20" : "bg-primary/10"
                            }`}
                          >
                            <Upload
                              className={`h-6 w-6 transition-colors duration-200 ${
                                isDragOver ? "text-primary" : "text-primary/70"
                              }`}
                            />
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-foreground">
                              {isDragOver
                                ? "Drop your CSV file here"
                                : isFileDialogOpen
                                  ? "Select a file..."
                                  : "Drag & drop your CSV file here"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {isFileDialogOpen
                                ? "File dialog is open"
                                : "or click to browse files"}
                            </p>
                          </div>
                        </div>
                        <Input
                          ref={fileInputRef}
                          id="file-upload"
                          type="file"
                          accept=".csv"
                          onChange={handleFileChange}
                          onFocus={handleFileInputFocus}
                          onBlur={handleFileInputBlur}
                          disabled={isProcessing}
                          className="absolute inset-0 w-full h-full opacity-0"
                        />
                      </div>

                      {file && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 rounded-lg border border-primary/20">
                          <FileText className="h-4 w-4 text-primary" />
                          <span className="text-sm font-medium text-primary">
                            {file.name}
                          </span>
                          <span className="text-xs text-muted-foreground ml-auto">
                            ({(file.size / 1024).toFixed(1)} KB)
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Import Options */}
                <div className="bg-card/30 backdrop-blur-sm border border-border/50 rounded-xl p-5 shadow-sm">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Shield className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">
                          Safety Options
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Configure safety and processing options
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="skip-duplicates"
                        checked={options.skipDuplicates}
                        onCheckedChange={(checked) =>
                          setOptions((prev) => ({
                            ...prev,
                            skipDuplicates: checked as boolean,
                          }))
                        }
                      />
                      <Label htmlFor="skip-duplicates">
                        Skip duplicate listings
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="dry-run"
                        checked={options.dryRun}
                        onCheckedChange={(checked) =>
                          setOptions((prev) => ({
                            ...prev,
                            dryRun: checked as boolean,
                            preview: checked ? false : prev.preview, // Disable preview when dry run is enabled
                          }))
                        }
                      />
                      <div className="flex flex-col">
                        <Label htmlFor="dry-run" className="font-medium">
                          Dry run (validate ALL records)
                        </Label>
                        <span className="text-xs text-muted-foreground">
                          Simulates import and shows errors for every record
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="preview"
                        checked={options.preview}
                        disabled={options.dryRun} // Disable when dry run is active
                        onCheckedChange={(checked) =>
                          setOptions((prev) => ({
                            ...prev,
                            preview: checked as boolean,
                            dryRun: checked ? false : prev.dryRun, // Disable dry run when preview is enabled
                          }))
                        }
                      />
                      <div className="flex flex-col">
                        <Label htmlFor="preview" className="font-medium">
                          Preview first 5 records only
                        </Label>
                        <span className="text-xs text-muted-foreground">
                          Quick preview without validation
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-center gap-4 pt-4">
                <Button
                  variant="outline"
                  onClick={onClose}
                  disabled={isProcessing}
                  className="px-6 py-2 border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all duration-200"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={!file || isProcessing}
                  className="px-6 py-2 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2"
                >
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  {options.dryRun
                    ? "Validate All Records"
                    : options.preview
                      ? "Preview First 5"
                      : "Import All Records"}
                </Button>
              </div>

              {/* Progress */}
              {isProcessing && (
                <div className="bg-card/30 backdrop-blur-sm border border-border/50 rounded-xl p-6 shadow-sm">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Loader2 className="h-5 w-5 text-primary animate-spin" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">
                          Processing Import
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Please wait while we process your data
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-foreground/90">
                          Processing...
                        </span>
                        <span className="text-foreground/90 font-medium">
                          {progress}%
                        </span>
                      </div>
                      <Progress value={progress} className="w-full" />
                      {progressMessage && (
                        <div className="text-sm text-muted-foreground text-center mt-2 bg-muted/50 rounded-lg py-2">
                          {progressMessage}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Results Display */}
              {result && (
                <div className="glass-card rounded-2xl p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div
                      className={`p-2 rounded-lg ${
                        result.success
                          ? "bg-green-500/10 border border-green-500/20"
                          : "bg-red-500/10 border border-red-500/20"
                      }`}
                    >
                      {result.success ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">
                        Import Results
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {result.success
                          ? "Import completed successfully"
                          : "Import completed with errors"}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                    <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-4 shadow-sm">
                      <div className="text-2xl font-bold text-foreground mb-1">
                        {result.totalProcessed.toLocaleString()}
                      </div>
                      <div className="text-sm text-muted-foreground">Total</div>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/30 rounded-xl p-4 shadow-sm">
                      <div className="text-2xl font-bold text-green-700 dark:text-green-400 mb-1">
                        {result.successful.toLocaleString()}
                      </div>
                      <div className="text-sm text-green-600 dark:text-green-500">
                        Successful
                      </div>
                    </div>
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-xl p-4 shadow-sm">
                      <div className="text-2xl font-bold text-red-700 dark:text-red-400 mb-1">
                        {result.failed.toLocaleString()}
                      </div>
                      <div className="text-sm text-red-600 dark:text-red-500">
                        Failed
                      </div>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/30 rounded-xl p-4 shadow-sm">
                      <div className="text-2xl font-bold text-blue-700 dark:text-blue-400 mb-1">
                        {(result.skipped || 0).toLocaleString()}
                      </div>
                      <div className="text-sm text-blue-600 dark:text-blue-500">
                        Skipped
                      </div>
                    </div>
                    <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800/30 rounded-xl p-4 shadow-sm">
                      <div className="text-2xl font-bold text-orange-700 dark:text-orange-400 mb-1">
                        {result.errors.length.toLocaleString()}
                      </div>
                      <div className="text-sm text-orange-600 dark:text-orange-500">
                        Errors
                      </div>
                    </div>
                  </div>

                  {/* Field Statistics */}
                  {result.fieldStats && (
                    <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-5 shadow-sm">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <BarChart3 className="h-4 w-4 text-primary" />
                        </div>
                        <h4 className="font-semibold text-foreground">
                          Field Processing Summary
                        </h4>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Share2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            <span className="font-medium">Social Links</span>
                          </div>
                          <span className="text-muted-foreground">
                            {result.fieldStats.details.socialLinks.processed}{" "}
                            processed,{" "}
                            {result.fieldStats.details.socialLinks.skipped}{" "}
                            skipped
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-green-600 dark:text-green-400" />
                            <span className="font-medium">Coordinates</span>
                          </div>
                          <span className="text-muted-foreground">
                            {result.fieldStats.details.coordinates.processed}{" "}
                            processed,{" "}
                            {
                              result.fieldStats.details.coordinates
                                .precisionIssues
                            }{" "}
                            precision issues
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                            <span className="font-medium">Opening Hours</span>
                          </div>
                          <span className="text-muted-foreground">
                            {result.fieldStats.details.openingHours.processed}{" "}
                            processed,{" "}
                            {result.fieldStats.details.openingHours.parseErrors}{" "}
                            parse errors
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Tag className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                            <span className="font-medium">Categories</span>
                          </div>
                          <span className="text-muted-foreground">
                            {result.fieldStats.details.categories.processed}{" "}
                            processed,{" "}
                            {result.fieldStats.details.categories.notFound} not
                            found
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                            <span className="font-medium">Phone Numbers</span>
                          </div>
                          <span className="text-muted-foreground">
                            {result.fieldStats.details.phoneNumbers.processed}{" "}
                            processed,{" "}
                            {result.fieldStats.details.phoneNumbers.invalid}{" "}
                            invalid
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-pink-600 dark:text-pink-400" />
                            <span className="font-medium">Emails</span>
                          </div>
                          <span className="text-muted-foreground">
                            {result.fieldStats.details.emails.processed}{" "}
                            processed,{" "}
                            {result.fieldStats.details.emails.invalid} invalid
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg md:col-span-2">
                          <div className="flex items-center gap-2">
                            <Link className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                            <span className="font-medium">URLs</span>
                          </div>
                          <span className="text-muted-foreground">
                            {result.fieldStats.details.urls.processed}{" "}
                            processed, {result.fieldStats.details.urls.invalid}{" "}
                            invalid
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {result.errors && result.errors.length > 0 && (
                    <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-5 shadow-sm">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-red-900 dark:text-red-100">
                            Errors Found ({result.errors.length})
                          </h4>
                          <p className="text-sm text-red-700 dark:text-red-300">
                            Please fix these errors before proceeding
                          </p>
                        </div>
                      </div>
                      <ScrollArea className="h-48 w-full border border-red-200/30 dark:border-red-800/30 rounded-lg bg-red-50/30 dark:bg-red-950/10">
                        <div className="p-4 space-y-3">
                          {result.errors.slice(0, 10).map((error, index) => (
                            <div
                              key={index}
                              className="bg-white/70 dark:bg-red-950/20 rounded-lg p-4 border border-red-100 dark:border-red-800/30 hover:bg-red-50/50 dark:hover:bg-red-950/30 transition-colors duration-200"
                            >
                              <div className="flex items-start gap-3">
                                <div className="p-1.5 bg-red-100 dark:bg-red-900/30 rounded-md mt-0.5">
                                  <XCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="font-medium text-red-900 dark:text-red-100 text-sm">
                                      Row {error.row}: {error.name}
                                    </span>
                                    {error.field && (
                                      <Badge
                                        variant="outline"
                                        className="text-xs border-red-300 dark:border-red-700 text-red-700 dark:text-red-300"
                                      >
                                        {error.field}
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-red-700 dark:text-red-300 text-sm leading-relaxed">
                                    {error.error}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                          {result.errors.length > 10 && (
                            <div className="text-center py-3 text-red-600 dark:text-red-400 text-sm font-medium bg-red-50/50 dark:bg-red-950/20 rounded-lg border border-red-200/30 dark:border-red-800/30">
                              ... and {result.errors.length - 10} more errors
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                  )}

                  {result?.rollbackAvailable && result?.importId && (
                    <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-4 shadow-sm">
                      <div className="flex items-start gap-3">
                        <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-md">
                          <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="flex-1">
                          <h5 className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                            Import Information
                          </h5>
                          <p className="text-blue-700 dark:text-blue-300 text-sm">
                            Import ID:{" "}
                            <span className="font-mono font-medium">
                              {result.importId}
                            </span>{" "}
                            - Rollback available if needed
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Dry Run Results */}
              {result?.dryRun && (
                <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Eye className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground text-lg">
                        Dry Run Results
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Validated ALL {result.dryRun.length} records - shows
                        exactly what will happen
                      </p>
                    </div>
                  </div>

                  {/* Summary Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-4 shadow-sm">
                      <div className="text-2xl font-bold text-foreground mb-1">
                        {result.dryRun.length.toLocaleString()}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Total Records
                      </div>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/30 rounded-xl p-4 shadow-sm">
                      <div className="text-2xl font-bold text-green-700 dark:text-green-400 mb-1">
                        {result.dryRun
                          .filter(
                            (
                              item: import("@/types/import.types").ImportDryRunRow,
                            ) => item.action === "create",
                          )
                          .length.toLocaleString()}
                      </div>
                      <div className="text-sm text-green-600 dark:text-green-500">
                        Will Create
                      </div>
                    </div>
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/30 rounded-xl p-4 shadow-sm">
                      <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-400 mb-1">
                        {result.dryRun
                          .filter(
                            (
                              item: import("@/types/import.types").ImportDryRunRow,
                            ) => item.action === "skip_duplicate",
                          )
                          .length.toLocaleString()}
                      </div>
                      <div className="text-sm text-yellow-600 dark:text-yellow-500">
                        Duplicates
                      </div>
                    </div>
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-xl p-4 shadow-sm">
                      <div className="text-2xl font-bold text-red-700 dark:text-red-400 mb-1">
                        {result.dryRun
                          .filter(
                            (
                              item: import("@/types/import.types").ImportDryRunRow,
                            ) => item.action === "error",
                          )
                          .length.toLocaleString()}
                      </div>
                      <div className="text-sm text-red-600 dark:text-red-500">
                        Errors
                      </div>
                    </div>
                  </div>

                  <ScrollArea className="h-80 w-full border border-border/50 rounded-xl bg-card/30">
                    <div className="p-4 space-y-2">
                      {result.dryRun.map(
                        (
                          item: import("@/types/import.types").ImportDryRunRow,
                          index: number,
                        ) => (
                          <div
                            key={index}
                            className={`flex items-center justify-between p-4 rounded-lg border transition-colors duration-200 ${
                              item.action === "error"
                                ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/30"
                                : item.action === "skip_duplicate"
                                  ? "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800/30"
                                  : "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/30"
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div
                                className={`p-1.5 rounded-md mt-0.5 ${
                                  item.action === "error"
                                    ? "bg-red-200/50 dark:bg-red-800/50"
                                    : item.action === "skip_duplicate"
                                      ? "bg-yellow-200/50 dark:bg-yellow-800/50"
                                      : "bg-green-200/50 dark:bg-green-800/50"
                                }`}
                              >
                                {item.action === "error" ? (
                                  <XCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                                ) : item.action === "skip_duplicate" ? (
                                  <AlertCircle className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400" />
                                ) : (
                                  <CheckCircle className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="font-medium text-foreground text-sm">
                                    Row {item.row}: {item.name}
                                  </span>
                                  <Badge
                                    variant={
                                      item.action === "error"
                                        ? "destructive"
                                        : item.action === "skip_duplicate"
                                          ? "secondary"
                                          : "default"
                                    }
                                    className="text-xs"
                                  >
                                    {item.action === "skip_duplicate"
                                      ? "Skip"
                                      : item.action}
                                  </Badge>
                                </div>
                                {item.error && (
                                  <div className="text-red-700 dark:text-red-300 text-sm bg-red-100/50 dark:bg-red-900/20 rounded-md p-2 border border-red-200/30 dark:border-red-800/30">
                                    {item.error}
                                  </div>
                                )}
                                {item.duplicateCheck?.found && (
                                  <div className="text-yellow-700 dark:text-yellow-300 text-sm bg-yellow-100/50 dark:bg-yellow-900/20 rounded-md p-2 border border-yellow-200/30 dark:border-yellow-800/30">
                                    Duplicate of existing listing
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  </ScrollArea>

                  {result.dryRun.some(
                    (item: import("@/types/import.types").ImportDryRunRow) =>
                      item.action === "error",
                  ) && (
                    <div className="mt-4 bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-4 shadow-sm">
                      <div className="flex items-start gap-3">
                        <div className="p-1.5 bg-red-100 dark:bg-red-900/30 rounded-md">
                          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                        </div>
                        <div className="flex-1">
                          <h5 className="font-medium text-red-900 dark:text-red-100 mb-1">
                            Action Required
                          </h5>
                          <p className="text-red-700 dark:text-red-300 text-sm">
                            Fix the errors above before running the actual
                            import. Use &quot;Preview&quot; mode to see raw data
                            or check your CSV file.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="history" className="space-y-6">
              <div className="bg-card/30 backdrop-blur-sm border border-border/50 rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <History className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">
                      Import History
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      View and manage past imports
                    </p>
                  </div>
                </div>

                <div>
                  {isLoadingHistory ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : importHistory.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No import history found
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      <ScrollArea className="h-96 w-full">
                        <div className="space-y-4">
                          {importHistory.map((item) => (
                            <Card key={item.id}>
                              <CardContent className="pt-4">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <FileText className="h-4 w-4" />
                                    <span className="font-medium">
                                      {item.filename}
                                    </span>
                                    {getStatusBadge(item.status)}
                                  </div>
                                  {item.rollback_available &&
                                    item.status === "completed" && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleRollback(item.id)}
                                        className="flex items-center gap-2"
                                      >
                                        <RotateCcw className="h-4 w-4" />
                                        Rollback
                                      </Button>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                  <div>
                                    <div className="text-muted-foreground">
                                      Records
                                    </div>
                                    <div className="font-medium">
                                      {item.total_records}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-muted-foreground">
                                      Successful
                                    </div>
                                    <div className="font-medium text-green-600">
                                      {item.successful_imports}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-muted-foreground">
                                      Failed
                                    </div>
                                    <div className="font-medium text-red-600">
                                      {item.failed_imports}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-muted-foreground">
                                      Started
                                    </div>
                                    <div className="font-medium">
                                      {new Date(
                                        item.started_at,
                                      ).toLocaleString()}
                                    </div>
                                  </div>
                                </div>
                                {item.profiles && (
                                  <div className="mt-2 text-sm text-muted-foreground">
                                    By:{" "}
                                    {item.profiles?.username ||
                                      item.profiles?.full_name ||
                                      "Unknown"}
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </ScrollArea>

                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="text-sm text-muted-foreground">
                          Showing {pageStart}-{pageEnd} of {paginationTotal}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setHistoryPage((prev) => Math.max(prev - 1, 0))
                            }
                            disabled={isLoadingHistory || !canGoPrev}
                            className="gap-2"
                          >
                            <ChevronLeft className="h-4 w-4" />
                            Previous
                          </Button>
                          <span className="text-sm text-muted-foreground">
                            Page {historyPage + 1} of {totalPages}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setHistoryPage((prev) => prev + 1)}
                            disabled={isLoadingHistory || !canGoNext}
                            className="gap-2"
                          >
                            Next
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
