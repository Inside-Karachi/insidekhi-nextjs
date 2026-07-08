"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Scan,
  X,
  Camera,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import confetti from "canvas-confetti";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

interface QRScannerProps {
  onClose?: () => void;
  onScanSuccess?: (data: {
    success: boolean;
    xp_awarded: number;
    message: string;
  }) => void;
}

type ScanState = "idle" | "scanning" | "processing" | "success" | "error";

export function QRScanner({ onClose, onScanSuccess }: QRScannerProps) {
  const [scanState, setScanState] = React.useState<ScanState>("idle");
  const [errorMessage, setErrorMessage] = React.useState<string>("");
  const [cameraPermission, setCameraPermission] = React.useState<
    "pending" | "granted" | "denied"
  >("pending");
  const scannerRef = React.useRef<Html5Qrcode | null>(null);
  const hasProcessedRef = React.useRef(false);
  const { toast } = useToast();

  // Cleanup function
  const stopScanner = React.useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === 2) {
          // Html5QrcodeScannerState.SCANNING
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (e) {
        console.error("Error stopping scanner:", e);
      }
      scannerRef.current = null;
    }
  }, []);

  // Process scanned QR code
  const processScan = React.useCallback(
    async (code: string) => {
      // Prevent duplicate processing
      if (hasProcessedRef.current) return;
      hasProcessedRef.current = true;

      setScanState("processing");

      try {
        // Stop scanner while processing
        await stopScanner();

        const response = await fetch("/api/gamification/qr-codes/scan", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
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
          setScanState("success");

          // Trigger confetti
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
          });

          toast({
            title: "Scan Successful! 🎉",
            description: data.message,
            variant: "default",
          });

          onScanSuccess?.(data);

          // Auto close after success
          setTimeout(() => {
            onClose?.();
          }, 2000);
        } else {
          setScanState("error");
          setErrorMessage(data.error || "Invalid QR code");

          toast({
            title: "Scan Failed",
            description: data.error || "Invalid QR code",
            variant: "destructive",
          });

          // Allow retry after error
          setTimeout(() => {
            hasProcessedRef.current = false;
            setScanState("idle");
            setErrorMessage("");
          }, 3000);
        }
      } catch (error) {
        console.error("API error:", error);
        setScanState("error");
        setErrorMessage("Failed to process scan. Please try again.");

        toast({
          title: "Error",
          description: "Failed to process scan. Please try again.",
          variant: "destructive",
        });

        // Allow retry after error
        setTimeout(() => {
          hasProcessedRef.current = false;
          setScanState("idle");
          setErrorMessage("");
        }, 3000);
      }
    },
    [stopScanner, toast, onScanSuccess, onClose]
  );

  // Start camera scanner
  const startScanner = React.useCallback(async () => {
    const readerElement = document.getElementById("qr-reader");
    if (!readerElement) return;

    try {
      // Check if camera is available
      const devices = await Html5Qrcode.getCameras();

      if (!devices || devices.length === 0) {
        setCameraPermission("denied");
        setErrorMessage("No camera found on this device");
        return;
      }

      setCameraPermission("granted");
      setScanState("scanning");

      // Initialize scanner
      const html5QrCode = new Html5Qrcode("qr-reader", {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
      });
      scannerRef.current = html5QrCode;

      // Find back camera if available
      const backCamera = devices.find(
        (camera) =>
          camera.label.toLowerCase().includes("back") ||
          camera.label.toLowerCase().includes("rear") ||
          camera.label.toLowerCase().includes("environment")
      );
      const cameraId = backCamera ? backCamera.id : devices[0].id;

      await html5QrCode.start(
        cameraId,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          // On successful scan
          processScan(decodedText);
        },
        () => {
          // Scan error - ignore, keep scanning
        }
      );
    } catch (error) {
      setCameraPermission("denied");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to access camera. Please grant camera permission."
      );
    }
  }, [processScan]);

  // Initialize on mount
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      startScanner();
    }, 500);

    return () => {
      clearTimeout(timeoutId);
      stopScanner();
    };
  }, [startScanner, stopScanner]);

  // Handle close
  const handleClose = async () => {
    await stopScanner();
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="relative w-full max-w-md bg-card border border-border rounded-3xl overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/50 to-transparent">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Scan className="w-5 h-5" />
            Scan QR Code
          </h3>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20 rounded-full"
            onClick={handleClose}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Camera Viewport */}
        <div className="relative aspect-square bg-black flex flex-col items-center justify-center overflow-hidden">
          {/* Scanner container */}
          <div
            id="qr-reader"
            className="w-full h-full"
            style={{ minHeight: "300px" }}
          />

          {/* Scanning Overlay */}
          <AnimatePresence>
            {scanState === "scanning" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 pointer-events-none"
              >
                <div className="absolute inset-0 border-[2px] border-primary/50 m-12 rounded-2xl">
                  <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-primary -mt-1 -ml-1 rounded-tl-lg" />
                  <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-primary -mt-1 -mr-1 rounded-tr-lg" />
                  <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-primary -mb-1 -ml-1 rounded-bl-lg" />
                  <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-primary -mb-1 -mr-1 rounded-br-lg" />

                  {/* Scanning Line Animation */}
                  <motion.div
                    className="absolute left-0 right-0 h-0.5 bg-primary shadow-[0_0_10px_rgba(var(--primary),0.8)]"
                    animate={{ top: ["0%", "100%", "0%"] }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* State Overlays */}
          <AnimatePresence>
            {/* Camera Permission Denied */}
            {cameraPermission === "denied" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-4 p-8"
              >
                <AlertCircle className="w-12 h-12 text-destructive" />
                <p className="text-white text-center text-sm">{errorMessage}</p>
                <Button onClick={startScanner} variant="secondary" size="sm">
                  Try Again
                </Button>
              </motion.div>
            )}

            {/* Processing */}
            {scanState === "processing" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-3"
              >
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
                <p className="text-white text-sm font-medium">Verifying...</p>
              </motion.div>
            )}

            {/* Success */}
            {scanState === "success" && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-3"
              >
                <CheckCircle2 className="w-16 h-16 text-green-500" />
                <p className="text-white text-lg font-semibold">Success!</p>
              </motion.div>
            )}

            {/* Error */}
            {scanState === "error" && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-3 p-8"
              >
                <AlertCircle className="w-12 h-12 text-destructive" />
                <p className="text-white text-center text-sm">{errorMessage}</p>
                <p className="text-white/60 text-xs">Retrying in a moment...</p>
              </motion.div>
            )}

            {/* Idle - waiting for camera */}
            {scanState === "idle" && cameraPermission === "pending" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 flex flex-col items-center justify-center bg-black gap-4"
              >
                <Camera className="w-12 h-12 text-white/40" />
                <p className="text-white/60 text-sm text-center px-8">
                  Starting camera...
                </p>
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="p-6 bg-card space-y-4">
          <div className="flex items-start gap-3 text-sm text-muted-foreground">
            <div className="p-2 rounded-full bg-primary/10 text-primary shrink-0">
              <Scan className="w-4 h-4" />
            </div>
            <p>
              Scan QR codes at partner locations and events to earn XP, unlock
              badges, and climb the leaderboard.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
