"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  WifiOff,
  Wifi,
  RefreshCw,
  X,
  AlertCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface QueuedAction {
  id: string;
  type: string;
  description: string;
  timestamp: number;
  retryCount: number;
  execute: () => Promise<void>;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

export function OfflineIndicator() {
  const { toast } = useToast();
  const [isOnline, setIsOnline] = React.useState(true);
  const [wasOffline, setWasOffline] = React.useState(false);
  const [showDetails, setShowDetails] = React.useState(false);
  const [queue, setQueue] = React.useState<QueuedAction[]>([]);
  const [processedCount, setProcessedCount] = React.useState(0);
  const retryTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Process queued actions when online
  const processQueue = React.useCallback(async () => {
    if (!navigator.onLine || queue.length === 0) return;

    const queueCopy = [...queue];
    const successfulIds: string[] = [];

    for (const action of queueCopy) {
      try {
        await action.execute();
        successfulIds.push(action.id);
        setProcessedCount((prev) => prev + 1);
      } catch (error) {
        console.error("Failed to execute queued action:", error);

        // Retry if under limit
        if (action.retryCount < MAX_RETRIES) {
          const updatedAction = {
            ...action,
            retryCount: action.retryCount + 1,
          };

          setQueue((prev) =>
            prev.map((a) => (a.id === action.id ? updatedAction : a)),
          );

          // Schedule retry
          retryTimerRef.current = setTimeout(
            () => {
              processQueue();
            },
            RETRY_DELAY_MS * (action.retryCount + 1),
          );
        } else {
          // Max retries reached
          toast({
            title: "Sync Failed",
            description: `Unable to sync: ${action.description}`,
            variant: "destructive",
          });
        }
      }
    }

    // Remove successful actions from queue
    if (successfulIds.length > 0) {
      setQueue((prev) => prev.filter((a) => !successfulIds.includes(a.id)));

      if (successfulIds.length === queueCopy.length) {
        toast({
          title: "All Changes Synced",
          description: `Successfully synced ${successfulIds.length} pending change${successfulIds.length > 1 ? "s" : ""}.`,
        });
      }
    }
  }, [queue, toast]);

  // Monitor online/offline status
  React.useEffect(() => {
    const updateOnlineStatus = () => {
      const online = navigator.onLine;
      const previousState = isOnline;

      setIsOnline(online);

      if (!online && previousState) {
        // Just went offline
        setWasOffline(true);
        toast({
          title: "Connection Lost",
          description:
            "You&apos;re currently offline. Changes will be saved locally.",
          variant: "destructive",
        });
      } else if (online && !previousState) {
        // Just came back online
        toast({
          title: "Connection Restored",
          description: "You&apos;re back online. Syncing pending changes...",
        });

        // Process queued actions
        if (queue.length > 0) {
          processQueue();
        }
      }
    };

    // Check initial state
    updateOnlineStatus();

    // Listen for connectivity changes
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);

    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);

      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
    };
  }, [isOnline, queue, toast, processQueue]);

  // Manual retry
  const handleRetry = () => {
    if (isOnline) {
      processQueue();
    } else {
      toast({
        title: "Still Offline",
        description: "Please check your internet connection",
        variant: "destructive",
      });
    }
  };

  // Clear queue
  const handleClearQueue = () => {
    if (confirm("Are you sure you want to clear all pending actions?")) {
      setQueue([]);
      toast({
        title: "Queue Cleared",
        description: "All pending actions have been removed",
      });
    }
  };

  // Don't show indicator if always online
  if (isOnline && !wasOffline && queue.length === 0) {
    return null;
  }

  return (
    <>
      {/* Floating Status Badge */}
      <AnimatePresence>
        {(!isOnline || queue.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed bottom-6 right-6 z-50"
          >
            <Card
              className={`shadow-2xl border-2 cursor-pointer ${
                isOnline
                  ? "border-amber-500 bg-amber-50 dark:bg-amber-950"
                  : "border-red-500 bg-red-50 dark:bg-red-950"
              }`}
              onClick={() => setShowDetails(!showDetails)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-full ${
                      isOnline
                        ? "bg-amber-100 dark:bg-amber-900"
                        : "bg-red-100 dark:bg-red-900"
                    }`}
                  >
                    {isOnline ? (
                      <Wifi className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    ) : (
                      <WifiOff className="h-5 w-5 text-red-600 dark:text-red-400 animate-pulse" />
                    )}
                  </div>
                  <div>
                    <div className="font-semibold text-sm">
                      {isOnline ? "Syncing" : "Offline Mode"}
                    </div>
                    {queue.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        {queue.length} pending action
                        {queue.length > 1 ? "s" : ""}
                      </div>
                    )}
                  </div>
                  {queue.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {queue.length}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Details Panel */}
      <AnimatePresence>
        {showDetails && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
              onClick={() => setShowDetails(false)}
            />

            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed bottom-24 right-6 w-96 z-50"
            >
              <Card className="shadow-2xl">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isOnline ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-red-600" />
                      )}
                      <CardTitle className="text-lg">Network Status</CardTitle>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowDetails(false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <CardDescription>
                    {isOnline
                      ? "You&apos;re connected to the internet"
                      : "You&apos;re currently working offline"}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Status Info */}
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-2">
                      <div
                        className={`h-3 w-3 rounded-full ${
                          isOnline ? "bg-green-500 animate-pulse" : "bg-red-500"
                        }`}
                      />
                      <span className="font-medium">
                        {isOnline ? "Online" : "Offline"}
                      </span>
                    </div>
                    {processedCount > 0 && (
                      <Badge variant="outline">{processedCount} synced</Badge>
                    )}
                  </div>

                  {/* Pending Actions */}
                  {queue.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold">
                          Pending Actions
                        </h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleClearQueue}
                          className="h-7 text-xs"
                        >
                          Clear All
                        </Button>
                      </div>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {queue.map((action) => (
                          <div
                            key={action.id}
                            className="p-3 bg-muted rounded-lg text-sm"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <div className="font-medium">
                                  {action.description}
                                </div>
                                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  {new Date(
                                    action.timestamp,
                                  ).toLocaleTimeString()}
                                  {action.retryCount > 0 && (
                                    <Badge
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      Retry {action.retryCount}/{MAX_RETRIES}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    {isOnline && queue.length > 0 && (
                      <Button
                        size="sm"
                        onClick={handleRetry}
                        className="flex-1"
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Retry Now
                      </Button>
                    )}
                    {!isOnline && (
                      <div className="text-xs text-muted-foreground text-center w-full p-3 bg-muted rounded-lg">
                        Changes will sync automatically when you&apos;re back
                        online
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

// Hook for offline queue management in other components
export function useOfflineQueue() {
  const [queue, setQueue] = React.useState<QueuedAction[]>([]);

  const queueAction = React.useCallback(
    (type: string, description: string, execute: () => Promise<void>) => {
      const action: QueuedAction = {
        id: `${Date.now()}-${Math.random()}`,
        type,
        description,
        timestamp: Date.now(),
        retryCount: 0,
        execute,
      };

      setQueue((prev) => [...prev, action]);
    },
    [],
  );

  return { queue, queueAction };
}
