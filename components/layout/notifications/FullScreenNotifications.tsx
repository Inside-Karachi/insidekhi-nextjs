"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Bell, Loader2, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { NotificationsFeedHandle } from "@/hooks/useNotificationsFeed";
import { NotificationsPanel } from "./NotificationsPanel";
import { useRouter } from "next/navigation";

interface FullScreenNotificationsProps {
    isOpen: boolean;
    onClose: () => void;
    feed: NotificationsFeedHandle;
}

export function FullScreenNotifications({
    isOpen,
    onClose,
    feed,
}: FullScreenNotificationsProps) {
    const [mounted, setMounted] = useState(false);
    const router = useRouter();

    // Handle client-side mounting for portal
    useEffect(() => {
        setMounted(true);
    }, []);

    // Lock body scroll when open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [isOpen]);

    // Don't render on server or before mount
    if (!mounted) return null;

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="fixed inset-0 z-[9999] flex flex-col bg-background/95 backdrop-blur-xl overflow-hidden"
                >
                    {/* Header */}
                    <div className="relative flex-none">
                        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent" />
                        <div className="relative flex items-center justify-between p-6 border-b border-border/50">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
                                    <Bell className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                                        Notifications
                                    </h2>
                                    <p className="text-sm text-muted-foreground">
                                        {feed.unreadCount > 0
                                            ? `${feed.unreadCount} new alert${feed.unreadCount === 1 ? "" : "s"
                                            }`
                                            : "No new alerts"}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-10 w-10 hover:bg-primary/10 rounded-xl"
                                    onClick={() => void feed.refresh()}
                                    disabled={feed.isLoading}
                                >
                                    <RefreshCcw
                                        className={cn(
                                            "h-5 w-5 text-muted-foreground",
                                            feed.isLoading && "animate-spin"
                                        )}
                                    />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={onClose}
                                    className="h-10 w-10 hover:bg-primary/10 rounded-xl"
                                >
                                    <X className="h-6 w-6" />
                                    <span className="sr-only">Close</span>
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Actions Bar */}
                    <div className="flex-none px-6 py-3 border-b border-border/30 bg-background/50 flex items-center justify-between">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="rounded-xl h-8 px-3 text-xs font-medium"
                            disabled={
                                feed.unreadCount === 0 || feed.isMarkingAll || feed.isLoading
                            }
                            onClick={() => void feed.markAllAsRead()}
                        >
                            {feed.isMarkingAll ? (
                                <>
                                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                    Marking...
                                </>
                            ) : (
                                "Mark all read"
                            )}
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-xl h-8 px-3 text-xs font-medium text-muted-foreground hover:text-foreground"
                            onClick={() => {
                                onClose();
                                router.push("/dashboard/notifications");
                            }}
                        >
                            View History
                        </Button>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 flex flex-col min-h-0 overflow-hidden px-6 pt-4">
                        <NotificationsPanel
                            feed={feed}
                            variant="mobile"
                            onClose={onClose}
                            className="h-full"
                        />
                    </div>

                    {/* Bottom Safe Area */}
                    <div className="flex-shrink-0 h-6 sm:h-8" />
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
}
