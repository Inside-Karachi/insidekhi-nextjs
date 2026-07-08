"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  ScanLine,
  Keyboard,
  CheckCircle2,
  XCircle,
  AlertCircle,
  User,
  Ticket,
  Calendar,
  RefreshCw,
  X,
  Camera,
  Loader2,
  Sparkles,
  MapPin,
  ArrowLeft,
  ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type ScanMode = "ticket" | "location";
type InputMode = "scan" | "manual";
type VerificationStatus =
  | "idle"
  | "scanning"
  | "processing"
  | "success"
  | "error"
  | "already_checked_in";

interface TicketInfo {
  id: number;
  code: string;
  status: string;
  guestName?: string;
  ticketType?: string;
  eventName?: string;
  alreadyCheckedIn: boolean;
  checkedInAt?: string;
}

interface LocationScanResult {
  success: boolean;
  xp_awarded: number;
  message: string;
}

interface VerificationResult {
  success: boolean;
  message: string;
  ticket?: TicketInfo;
  xpAwarded?: number;
  error?: string;
}

interface UnifiedScannerClientProps {
  isOrganizer: boolean;
  isAdmin: boolean;
  userRole: string;
}

export function UnifiedScannerClient({
  isOrganizer,
  isAdmin,
  userRole: _userRole,
}: UnifiedScannerClientProps) {
  const router = useRouter();

  // Organizers can ONLY scan tickets, not location QR
  // Only regular users (public_user) should see location QR
  const isTicketScannerOnly = isOrganizer || isAdmin;
  const defaultMode: ScanMode = isTicketScannerOnly ? "ticket" : "location";

  const [scanMode, setScanMode] = React.useState<ScanMode>(defaultMode);
  const [inputMode, setInputMode] = React.useState<InputMode>("scan");
  const [status, setStatus] = React.useState<VerificationStatus>("idle");
  const [manualCode, setManualCode] = React.useState("");
  const [lastResult, setLastResult] = React.useState<VerificationResult | null>(
    null
  );
  const [locationResult, setLocationResult] =
    React.useState<LocationScanResult | null>(null);
  const [showScanner, setShowScanner] = React.useState(false);
  const [cameraError, setCameraError] = React.useState<string | null>(null);
  const [isProcessingImage, setIsProcessingImage] = React.useState(false);
  const { toast } = useToast();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const scannerRef = React.useRef<import("html5-qrcode").Html5Qrcode | null>(
    null
  );
  const hasProcessedRef = React.useRef(false);

  // Only admins can switch between ticket and location modes
  // Organizers are locked to ticket scanning only
  const canSwitchModes = isAdmin && !isOrganizer;

  React.useEffect(() => {
    if (inputMode === "manual" && inputRef.current && status === "idle") {
      inputRef.current.focus();
    }
  }, [inputMode, status]);

  React.useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const resetForNextScan = () => {
    setStatus("idle");
    setLastResult(null);
    setLocationResult(null);
    setManualCode("");
    hasProcessedRef.current = false;
    setCameraError(null);
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === 2) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (e) {
        console.error("Error stopping scanner:", e);
      }
      scannerRef.current = null;
    }
  };

  const triggerConfetti = async () => {
    try {
      const { default: confetti } = await import("canvas-confetti");
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    } catch (error) {
      // Confetti is non-critical; preserve success flow if animation chunk fails.
      console.error("Confetti effect unavailable:", error);
    }
  };

  const verifyTicket = async (code: string) => {
    setStatus("processing");
    setShowScanner(false);
    await stopScanner();

    try {
      const response = await fetch("/api/tickets/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      const data: VerificationResult = await response.json();
      setLastResult(data);

      if (data.success) {
        if (data.ticket?.alreadyCheckedIn) {
          setStatus("already_checked_in");
          toast({
            title: "Already Checked In",
            description: `This ticket was checked in at ${
              data.ticket.checkedInAt
                ? new Date(data.ticket.checkedInAt).toLocaleTimeString()
                : "earlier"
            }`,
          });
        } else {
          setStatus("success");
          void triggerConfetti();
          toast({ title: "Check-in Successful! ✓", description: data.message });
        }
      } else {
        setStatus("error");
        toast({
          title: "Verification Failed",
          description: data.message,
          variant: "destructive",
        });
      }
    } catch (_error) {
      setStatus("error");
      setLastResult({
        success: false,
        message: "Network error. Please check your connection.",
        error: "NETWORK_ERROR",
      });
      toast({
        title: "Connection Error",
        description: "Unable to verify ticket.",
        variant: "destructive",
      });
    }
  };

  const scanLocationQR = async (code: string) => {
    setStatus("processing");
    setShowScanner(false);
    await stopScanner();

    try {
      const response = await fetch("/api/gamification/qr-codes/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          deviceInfo: {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
          },
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setStatus("success");
        setLocationResult(data);
        void triggerConfetti();
        toast({ title: "Scan Successful! 🎉", description: data.message });
      } else {
        setStatus("error");
        setLastResult({
          success: false,
          message: data.error || "Invalid QR code",
          error: data.error,
        });
        toast({
          title: "Scan Failed",
          description: data.error || "Invalid QR code",
          variant: "destructive",
        });
      }
    } catch (_error) {
      setStatus("error");
      setLastResult({
        success: false,
        message: "Network error.",
        error: "NETWORK_ERROR",
      });
      toast({
        title: "Error",
        description: "Failed to process scan.",
        variant: "destructive",
      });
    }
  };

  const handleScanResult = (code: string) => {
    if (hasProcessedRef.current) return;
    hasProcessedRef.current = true;
    if (scanMode === "ticket") verifyTicket(code);
    else scanLocationQR(code);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = manualCode.toUpperCase().trim();
    if (!code) {
      toast({
        title: "Enter Code",
        description: "Please enter a ticket code",
        variant: "destructive",
      });
      return;
    }
    const formattedCode = code.startsWith("IK-") ? code : `IK-${code}`;
    hasProcessedRef.current = false;
    verifyTicket(formattedCode);
  };

  const startScanner = async () => {
    setCameraError(null);
    setStatus("scanning");
    hasProcessedRef.current = false;

    const readerElement = document.getElementById("unified-qr-reader");
    if (!readerElement) {
      setCameraError("Scanner container not found");
      return;
    }

    try {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import(
        "html5-qrcode"
      );

      // Get available cameras - this will trigger permission request
      let devices;
      try {
        devices = await Html5Qrcode.getCameras();
      } catch (cameraErr) {
        // getCameras throws when permission is denied
        const errMsg =
          cameraErr instanceof Error ? cameraErr.message : String(cameraErr);

        if (
          errMsg.toLowerCase().includes("notallowed") ||
          errMsg.toLowerCase().includes("permission") ||
          errMsg.toLowerCase().includes("denied")
        ) {
          setCameraError(
            "Camera access denied. Please allow camera access:\n\n" +
              "• Tap the lock/info icon (🔒) in your browser's address bar\n" +
              "• Find 'Camera' or 'Permissions'\n" +
              "• Set Camera to 'Allow'\n" +
              "• Then refresh this page"
          );
        } else {
          setCameraError("Could not access camera: " + errMsg);
        }
        setStatus("error");
        return;
      }

      if (!devices || devices.length === 0) {
        setCameraError("No camera found on this device.");
        setStatus("error");
        return;
      }

      const html5QrCode = new Html5Qrcode("unified-qr-reader", {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
      });
      scannerRef.current = html5QrCode;

      const backCamera = devices.find(
        (camera) =>
          camera.label.toLowerCase().includes("back") ||
          camera.label.toLowerCase().includes("rear") ||
          camera.label.toLowerCase().includes("environment")
      );
      const cameraId = backCamera?.id || devices[0].id;

      await html5QrCode.start(
        cameraId,
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          handleScanResult(decodedText);
        },
        () => {}
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to access camera";

      // Handle specific permission denied errors
      if (
        errorMessage.toLowerCase().includes("permission") ||
        errorMessage.toLowerCase().includes("denied") ||
        errorMessage.toLowerCase().includes("notallowed")
      ) {
        setCameraError(
          "Camera access denied. Please allow camera access:\n\n" +
            "• Tap the lock/info icon (🔒) in your browser's address bar\n" +
            "• Find 'Camera' or 'Permissions'\n" +
            "• Set Camera to 'Allow'\n" +
            "• Then refresh this page"
        );
      } else if (
        errorMessage.toLowerCase().includes("notfound") ||
        errorMessage.toLowerCase().includes("no camera")
      ) {
        setCameraError("No camera found on this device.");
      } else {
        setCameraError(errorMessage);
      }
      setStatus("error");
    }
  };

  const closeScanner = async () => {
    await stopScanner();
    setShowScanner(false);
    setStatus("idle");
    hasProcessedRef.current = false;
  };

  // Scan QR code from uploaded image file
  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessingImage(true);
    setCameraError(null);
    setStatus("processing");

    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const html5QrCode = new Html5Qrcode("unified-qr-reader-hidden");

      const decodedText = await html5QrCode.scanFile(file, true);

      // Clear the file input for future scans
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      // Process the decoded QR code
      hasProcessedRef.current = false;
      handleScanResult(decodedText);
    } catch (error) {
      console.error("Image scan error:", error);
      setStatus("error");
      setCameraError(
        "Could not find a QR code in this image. Please try a clearer image."
      );
      toast({
        title: "Scan Failed",
        description: "No QR code found in the image",
        variant: "destructive",
      });
    } finally {
      setIsProcessingImage(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hidden element for file-based QR scanning */}
      <div id="unified-qr-reader-hidden" style={{ display: "none" }} />

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        className="hidden"
        id="qr-image-upload"
      />

      {/* Header with Back Button */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          className="shrink-0 rounded-full hover:bg-muted"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10">
              <ScanLine className="w-5 h-5 text-primary" />
            </div>
            {isTicketScannerOnly ? "Ticket Scanner" : "QR Scanner"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isTicketScannerOnly
              ? "Verify tickets & check-in attendees"
              : scanMode === "ticket"
              ? "Verify tickets & check-in attendees"
              : "Earn XP at partner locations"}
          </p>
        </div>
      </div>

      {/* Mode Switcher - Only for admins (not organizers) */}
      {canSwitchModes && (
        <div className="flex justify-center">
          <div className="inline-flex p-1.5 bg-muted/50 dark:bg-muted/30 rounded-2xl border border-border/50">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setScanMode("ticket");
                resetForNextScan();
              }}
              className={cn(
                "gap-2 rounded-xl px-4 transition-all",
                scanMode === "ticket"
                  ? "bg-background dark:bg-card shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Ticket className="w-4 h-4" />
              <span className="hidden sm:inline">Verify</span> Tickets
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setScanMode("location");
                resetForNextScan();
              }}
              className={cn(
                "gap-2 rounded-xl px-4 transition-all",
                scanMode === "location"
                  ? "bg-background dark:bg-card shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <MapPin className="w-4 h-4" />
              <span className="hidden sm:inline">Location</span> QR
            </Button>
          </div>
        </div>
      )}

      {/* Main Scanner Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border bg-card/80 dark:bg-card/50 backdrop-blur-sm overflow-hidden shadow-lg"
      >
        <AnimatePresence mode="wait">
          {/* Idle State - Choose Input Mode */}
          {status === "idle" && !showScanner && (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-6"
            >
              {/* Input Mode Toggle for Ticket Scanning */}
              {scanMode === "ticket" && (
                <div className="flex justify-center mb-6">
                  <div className="inline-flex p-1 bg-muted/30 dark:bg-muted/20 rounded-xl">
                    <button
                      onClick={() => setInputMode("scan")}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all",
                        inputMode === "scan"
                          ? "bg-primary text-primary-foreground shadow-md"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      )}
                    >
                      <Camera className="w-4 h-4" />
                      Camera
                    </button>
                    <button
                      onClick={() => setInputMode("manual")}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all",
                        inputMode === "manual"
                          ? "bg-primary text-primary-foreground shadow-md"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      )}
                    >
                      <Keyboard className="w-4 h-4" />
                      Manual
                    </button>
                  </div>
                </div>
              )}

              {/* Camera Scan Button */}
              {(scanMode === "location" || inputMode === "scan") && (
                <div className="flex flex-col items-center justify-center py-8">
                  <motion.button
                    whileHover={{ scale: 1.03, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setShowScanner(true);
                      setTimeout(startScanner, 100);
                    }}
                    className="group relative w-56 h-56 rounded-3xl bg-gradient-to-br from-primary/15 via-primary/10 to-primary/5 dark:from-primary/20 dark:via-primary/10 dark:to-transparent border-2 border-dashed border-primary/30 hover:border-primary/60 transition-all flex flex-col items-center justify-center gap-4"
                  >
                    {/* Corner markers */}
                    <div className="absolute top-4 left-4 w-8 h-8 border-t-3 border-l-3 border-primary/50 rounded-tl-xl" />
                    <div className="absolute top-4 right-4 w-8 h-8 border-t-3 border-r-3 border-primary/50 rounded-tr-xl" />
                    <div className="absolute bottom-4 left-4 w-8 h-8 border-b-3 border-l-3 border-primary/50 rounded-bl-xl" />
                    <div className="absolute bottom-4 right-4 w-8 h-8 border-b-3 border-r-3 border-primary/50 rounded-br-xl" />

                    <div className="p-5 rounded-2xl bg-primary/15 dark:bg-primary/25 group-hover:bg-primary/25 dark:group-hover:bg-primary/35 transition-colors">
                      <Camera className="w-12 h-12 text-primary" />
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-lg">Tap to Scan</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {scanMode === "ticket"
                          ? "Point at ticket QR"
                          : "Scan location QR"}
                      </p>
                    </div>
                  </motion.button>
                </div>
              )}

              {/* Manual Entry Form */}
              {scanMode === "ticket" && inputMode === "manual" && (
                <div className="space-y-4">
                  <form onSubmit={handleManualSubmit} className="space-y-4">
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-mono font-bold text-lg select-none">
                        IK-
                      </div>
                      <Input
                        ref={inputRef}
                        value={manualCode.replace(/^IK-/i, "")}
                        onChange={(e) =>
                          setManualCode(e.target.value.toUpperCase())
                        }
                        placeholder="XXXXXX"
                        className="h-14 pl-14 text-xl font-mono tracking-[0.2em] uppercase bg-muted/30 dark:bg-muted/20 border-border/50 focus:border-primary"
                        maxLength={10}
                        autoComplete="off"
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full h-12 text-base font-semibold"
                      size="lg"
                    >
                      <Ticket className="w-5 h-5 mr-2" />
                      Verify Ticket
                    </Button>
                  </form>
                  <p className="text-center text-sm text-muted-foreground">
                    Enter the 6-character code from the ticket
                  </p>
                </div>
              )}

              {/* Tips */}
              <div className="mt-6 pt-6 border-t border-border/50">
                <p className="text-xs text-muted-foreground text-center">
                  {scanMode === "ticket"
                    ? "Tip: Use bright lighting for faster scanning"
                    : "Visit partner locations to earn XP rewards!"}
                </p>
              </div>
            </motion.div>
          )}

          {/* Processing */}
          {status === "processing" && (
            <motion.div
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-6 flex flex-col items-center justify-center min-h-[300px]"
            >
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
                <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
              </div>
              <p className="mt-4 font-medium">
                {scanMode === "ticket"
                  ? "Verifying ticket..."
                  : "Processing..."}
              </p>
            </motion.div>
          )}

          {/* Success - Ticket */}
          {status === "success" &&
            scanMode === "ticket" &&
            lastResult?.ticket && (
              <motion.div
                key="ticket-success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="p-6 space-y-4"
              >
                <div className="flex justify-center">
                  <div className="w-20 h-20 rounded-full bg-emerald-500/20 dark:bg-emerald-500/30 flex items-center justify-center">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                  </div>
                </div>
                <div className="text-center">
                  <h3 className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                    Check-in Successful!
                  </h3>
                  {typeof lastResult.xpAwarded === "number" &&
                    lastResult.xpAwarded > 0 && (
                      <p className="text-sm text-emerald-500 mt-1">
                        +{lastResult.xpAwarded} XP awarded to attendee
                      </p>
                    )}
                </div>
                <div className="space-y-3 p-4 bg-muted/30 dark:bg-muted/20 rounded-xl">
                  {lastResult.ticket.guestName && (
                    <div className="flex items-center gap-3">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">
                        {lastResult.ticket.guestName}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <Ticket className="w-4 h-4 text-muted-foreground" />
                    <span className="font-mono text-sm">
                      {lastResult.ticket.code}
                    </span>
                  </div>
                  {lastResult.ticket.ticketType && (
                    <div className="flex items-center gap-3">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span>{lastResult.ticket.ticketType}</span>
                    </div>
                  )}
                </div>
                <Button
                  onClick={resetForNextScan}
                  className="w-full h-12"
                  size="lg"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Scan Next Ticket
                </Button>
              </motion.div>
            )}

          {/* Success - Location */}
          {status === "success" &&
            scanMode === "location" &&
            locationResult && (
              <motion.div
                key="location-success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="p-6 space-y-4"
              >
                <div className="flex justify-center">
                  <div className="w-20 h-20 rounded-full bg-primary/20 dark:bg-primary/30 flex items-center justify-center">
                    <Sparkles className="w-10 h-10 text-primary" />
                  </div>
                </div>
                <div className="text-center">
                  <h3 className="text-3xl font-bold text-primary">
                    +{locationResult.xp_awarded} XP
                  </h3>
                  <p className="text-muted-foreground mt-2">
                    {locationResult.message}
                  </p>
                </div>
                <Button
                  onClick={resetForNextScan}
                  className="w-full h-12"
                  size="lg"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Scan Another
                </Button>
              </motion.div>
            )}

          {/* Already Checked In */}
          {status === "already_checked_in" && lastResult?.ticket && (
            <motion.div
              key="already-checked"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="p-6 space-y-4"
            >
              <div className="flex justify-center">
                <div className="w-20 h-20 rounded-full bg-amber-500/20 dark:bg-amber-500/30 flex items-center justify-center">
                  <AlertCircle className="w-10 h-10 text-amber-500" />
                </div>
              </div>
              <div className="text-center">
                <h3 className="text-xl font-bold text-amber-600 dark:text-amber-400">
                  Already Checked In
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Used at{" "}
                  {lastResult.ticket.checkedInAt
                    ? new Date(
                        lastResult.ticket.checkedInAt
                      ).toLocaleTimeString()
                    : "earlier"}
                </p>
              </div>
              <div className="space-y-3 p-4 bg-muted/30 dark:bg-muted/20 rounded-xl">
                {lastResult.ticket.guestName && (
                  <div className="flex items-center gap-3">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">
                      {lastResult.ticket.guestName}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <Ticket className="w-4 h-4 text-muted-foreground" />
                  <span className="font-mono text-sm">
                    {lastResult.ticket.code}
                  </span>
                </div>
              </div>
              <Button
                onClick={resetForNextScan}
                className="w-full h-12"
                size="lg"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Scan Next Ticket
              </Button>
            </motion.div>
          )}

          {/* Error */}
          {status === "error" && !showScanner && (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="p-6 space-y-4"
            >
              <div className="flex justify-center">
                <div className="w-20 h-20 rounded-full bg-destructive/20 dark:bg-destructive/30 flex items-center justify-center">
                  <XCircle className="w-10 h-10 text-destructive" />
                </div>
              </div>
              <div className="text-center">
                <h3 className="text-xl font-bold text-destructive">
                  {scanMode === "ticket"
                    ? "Verification Failed"
                    : "Scan Failed"}
                </h3>
                <p className="text-muted-foreground mt-2">
                  {lastResult?.message || cameraError}
                </p>
              </div>
              <Button
                onClick={resetForNextScan}
                className="w-full h-12"
                size="lg"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Full-screen Scanner Modal */}
      <AnimatePresence>
        {showScanner && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black"
          >
            <div id="unified-qr-reader" className="w-full h-full" />

            {/* Scanner UI Overlay */}
            <div className="absolute inset-0 pointer-events-none">
              {/* Header */}
              <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center pointer-events-auto bg-gradient-to-b from-black/80 to-transparent">
                <div className="flex items-center gap-3 text-white">
                  <div className="p-2 rounded-xl bg-white/10 backdrop-blur-sm">
                    <ScanLine className="w-5 h-5" />
                  </div>
                  <span className="font-semibold">
                    {scanMode === "ticket" ? "Scan Ticket" : "Scan Location QR"}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20 rounded-full h-10 w-10"
                  onClick={closeScanner}
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Scanner Frame */}
              {status === "scanning" && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative w-72 h-72">
                    <div className="absolute inset-0 border-2 border-white/20 rounded-3xl" />
                    <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-primary rounded-tl-2xl" />
                    <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-primary rounded-tr-2xl" />
                    <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-primary rounded-bl-2xl" />
                    <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-primary rounded-br-2xl" />
                    {/* Scanning line animation */}
                    <motion.div
                      animate={{ top: ["5%", "95%", "5%"] }}
                      transition={{
                        duration: 2.5,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                      className="absolute left-4 right-4 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent shadow-lg shadow-primary/50"
                    />
                  </div>
                </div>
              )}

              {/* Camera Error */}
              {cameraError && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/90 pointer-events-auto">
                  <div className="text-center p-8 max-w-sm">
                    <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center mx-auto mb-4">
                      <AlertCircle className="w-8 h-8 text-destructive" />
                    </div>
                    <h3 className="text-white font-semibold text-lg mb-2">
                      Camera Access Required
                    </h3>
                    <p className="text-white/70 mb-4 text-sm whitespace-pre-line">
                      {cameraError}
                    </p>

                    {/* Image Upload Fallback */}
                    <div className="mb-4 p-3 rounded-lg bg-white/10 border border-white/20">
                      <p className="text-white/80 text-sm mb-3">
                        Or scan from an image file:
                      </p>
                      <Button
                        variant="secondary"
                        className="w-full"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isProcessingImage}
                      >
                        {isProcessingImage ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <ImageIcon className="w-4 h-4 mr-2" />
                        )}
                        {isProcessingImage
                          ? "Processing..."
                          : "Upload QR Image"}
                      </Button>
                    </div>

                    <div className="flex gap-3 justify-center">
                      <Button
                        variant="outline"
                        className="text-white border-white/30"
                        onClick={closeScanner}
                      >
                        Cancel
                      </Button>
                      <Button onClick={startScanner}>Try Again</Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Processing Overlay */}
              {status === "processing" && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                  <div className="text-center">
                    <Loader2 className="w-14 h-14 animate-spin text-primary mx-auto mb-4" />
                    <p className="text-white font-medium text-lg">
                      Processing...
                    </p>
                  </div>
                </div>
              )}

              {/* Bottom Hint */}
              {status === "scanning" && (
                <div className="absolute bottom-24 left-0 right-0 text-center pointer-events-auto">
                  <p className="text-white/90 text-lg font-medium">
                    Point camera at QR code
                  </p>
                  <p className="text-white/60 text-sm mt-1">
                    Hold steady for best results
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
