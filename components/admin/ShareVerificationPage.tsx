"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  XCircle,
  Eye,
  RefreshCw,
  ExternalLink,
  HandCoins,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { PendingShare } from "@/types/invite-share.types";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export function ShareVerificationPage() {
  const [shares, setShares] = React.useState<PendingShare[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [verifyingId, setVerifyingId] = React.useState<number | null>(null);
  const [rejectingId, setRejectingId] = React.useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = React.useState("");
  const { toast } = useToast();

  const fetchShares = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/shares/pending");
      const data = await response.json();

      if (response.ok && data.success) {
        setShares(data.shares || []);
      } else {
        toast({
          title: "Failed to fetch shares",
          description: data.error || "Please try again",
          variant: "destructive",
        });
      }
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to load pending shares",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchShares();
  }, [fetchShares]);

  const handleVerify = async (
    shareId: number,
    status: "verified" | "rejected",
    notes?: string,
  ) => {
    setVerifyingId(shareId);

    try {
      const response = await fetch("/api/shares/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ share_id: shareId, status, notes }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast({
          title:
            status === "verified" ? "Share Approved! 🎉" : "Share Rejected",
          description:
            status === "verified"
              ? `User earned ${data.xp_awarded || 10} XP`
              : "User was notified with reason",
        });

        // Remove from list
        setShares((prev) => prev.filter((s) => s.id !== shareId));
        setRejectingId(null);
        setRejectionReason("");
      } else {
        throw new Error(data.error || "Failed to verify share");
      }
    } catch (error) {
      toast({
        title: "Verification Failed",
        description:
          error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setVerifyingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-cyan-500/5 to-transparent rounded-2xl" />
          <div className="relative p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-500/10 rounded-xl">
                <HandCoins className="h-6 w-6 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">
                  Verify Shares
                </h1>
                <p className="text-muted-foreground mt-1">Loading...</p>
              </div>
            </div>
          </div>
        </div>
        <div className="grid gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-64 bg-muted/50 rounded-xl animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-cyan-500/5 to-transparent rounded-2xl" />
        <div className="relative p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-500/10 rounded-xl">
                <HandCoins className="h-6 w-6 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">
                  Verify Shares
                </h1>
                <p className="text-muted-foreground mt-1">
                  {shares.length} pending share{shares.length !== 1 ? "s" : ""}{" "}
                  to review
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={fetchShares} variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <a
                href="/admin/gamification"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
                Back to Dashboard
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      {shares.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-xl">
          <CheckCircle2 className="w-16 h-16 mx-auto text-green-500 mb-4" />
          <h3 className="text-xl font-semibold mb-2">All Caught Up!</h3>
          <p className="text-muted-foreground">
            No pending shares to verify at the moment
          </p>
        </div>
      ) : (
        <div className="grid gap-6">
          {shares.map((share, index) => (
            <motion.div
              key={share.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-gradient-to-br from-background via-background to-muted border border-border rounded-xl p-6 shadow-lg"
            >
              <div className="flex flex-col md:flex-row gap-6">
                {/* Screenshot */}
                <div className="md:w-1/3">
                  {share.screenshot_url ? (
                    <a
                      href={share.screenshot_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block relative aspect-video rounded-lg overflow-hidden border border-border hover:border-primary transition-colors group"
                    >
                      <OptimizedImage
                        src={share.screenshot_url}
                        alt="Share screenshot"
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className="object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <Eye className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </a>
                  ) : (
                    <div className="aspect-video rounded-lg bg-muted flex items-center justify-center">
                      <p className="text-sm text-muted-foreground">
                        No screenshot
                      </p>
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 space-y-4">
                  {/* User Info */}
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage
                        src={
                          share.profiles?.avatar_url ||
                          share.user_profile?.avatar_url ||
                          undefined
                        }
                      />
                      <AvatarFallback>
                        {(
                          share.profiles?.full_name ||
                          share.user_profile?.full_name ||
                          "U"
                        ).charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">
                        {share.profiles?.full_name ||
                          share.user_profile?.full_name ||
                          "Unknown User"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {share.created_at
                          ? new Date(share.created_at).toLocaleString()
                          : "Unknown"}
                      </p>
                    </div>
                  </div>

                  {/* Share Details */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Platform</p>
                      <p className="font-medium capitalize">{share.platform}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Content</p>
                      <p className="font-medium capitalize">
                        {share.content_type}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground mb-1">
                        Shared Content
                      </p>
                      <a
                        href={share.content_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline flex items-center gap-1"
                      >
                        {share.content_title}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-4">
                    <Button
                      onClick={() => handleVerify(share.id, "verified")}
                      disabled={verifyingId !== null}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                    >
                      {verifyingId === share.id ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Approving...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Approve
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => {
                        setRejectingId(share.id);
                        setRejectionReason("");
                      }}
                      disabled={verifyingId !== null}
                      variant="destructive"
                      className="flex-1"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Reject
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Rejection Dialog */}
      <Dialog
        open={rejectingId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRejectingId(null);
            setRejectionReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Share</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this share. This will be
              sent to the user.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Screenshot blurry, wrong platform..."
              className="min-h-[100px]"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectingId(null);
                setRejectionReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (rejectingId) {
                  handleVerify(rejectingId, "rejected", rejectionReason);
                }
              }}
              disabled={verifyingId !== null || !rejectionReason.trim()}
            >
              {verifyingId ? "Rejecting..." : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
