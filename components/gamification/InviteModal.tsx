"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Mail,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Copy,
  Users,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import confetti from "canvas-confetti";
import { z } from "zod";
import type {
  InviteModalProps,
  CreateInvitationResponse,
} from "@/types/invite-share.types";

// Email validation schema
const inviteSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type InviteState = "idle" | "loading" | "success" | "error";

export function InviteModal({
  isOpen,
  onClose,
  onInviteSuccess,
}: InviteModalProps) {
  const [state, setState] = React.useState<InviteState>("idle");
  const [email, setEmail] = React.useState("");
  const [inviteData, setInviteData] = React.useState<
    CreateInvitationResponse["data"] | null
  >(null);
  const [error, setError] = React.useState("");
  const { toast } = useToast();
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Responsive state
  const [isMobile, setIsMobile] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    const checkMobile = () => {
      setIsMobile(window.matchMedia("(max-width: 768px)").matches);
    };

    // Initial check
    checkMobile();

    // Listen for resize
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Lock body scroll when open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      // Focus input after animation
      setTimeout(() => inputRef.current?.focus(), 300);
    } else {
      document.body.style.overflow = "";
      // Reset state on close
      const timer = setTimeout(() => {
        setState("idle");
        setEmail("");
        setError("");
        setInviteData(null);
      }, 300);
      return () => clearTimeout(timer);
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validate email
    const result = inviteSchema.safeParse({ email });
    if (!result.success) {
      setError(result.error.errors[0].message);
      return;
    }

    setState("loading");

    try {
      const response = await fetch("/api/invitations/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitee_email: email }),
      });

      const data: CreateInvitationResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to create invitation");
      }

      setState("success");
      setInviteData(data.data || null);

      // Trigger confetti
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#ff184d", "#e11d48", "#be185d"],
      });

      toast({
        title: "Invitation Sent! 🎉",
        description: `We've sent an invite to ${email}`,
        variant: "default",
      });

      onInviteSuccess?.(data.data!);
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Something went wrong");
      toast({
        title: "Invitation Failed",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    }
  };

  const copyInviteLink = async () => {
    if (!inviteData?.invite_url) return;

    try {
      await navigator.clipboard.writeText(inviteData.invite_url);
      toast({
        title: "Copied!",
        description: "Invite link copied to clipboard",
      });
    } catch (_err) {
      toast({
        title: "Failed to copy",
        description: "Please copy the link manually",
        variant: "destructive",
      });
    }
  };

  const copyInviteCode = async () => {
    if (!inviteData?.invite_code) return;

    try {
      await navigator.clipboard.writeText(inviteData.invite_code);
      toast({
        title: "Copied!",
        description: "Invite code copied to clipboard",
      });
    } catch (_err) {
      toast({
        title: "Failed to copy",
        description: "Please copy the code manually",
        variant: "destructive",
      });
    }
  };

  // Shared content for both views
  const renderContent = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3 md:hidden mb-6">
        {/* Mobile-only header content inside the scrollable area if needed, 
             but we have a fixed header for mobile drawer. 
             So we keep this cleaner. */}
      </div>

      {state !== "success" ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">
              Friend&apos;s Email
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                ref={inputRef}
                id="email"
                type="email"
                placeholder="friend@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError("");
                }}
                className="pl-10 h-12 border-border/50 focus:border-primary"
                disabled={state === "loading"}
              />
            </div>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-destructive flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4" />
                {error}
              </motion.p>
            )}
          </div>

          <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-rose-500/10 border border-primary/20">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <div className="text-sm space-y-1">
                <p className="font-medium text-foreground">How it works:</p>
                <ul className="text-muted-foreground space-y-1">
                  <li>• They get an invite email with a special link</li>
                  <li>• When they sign up, you both get 25 XP!</li>
                  <li>• XP awarded after profile completion</li>
                </ul>
              </div>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full h-12 bg-gradient-to-r from-primary to-rose-600 hover:from-primary/90 hover:to-rose-600/90 text-white font-medium shadow-lg shadow-primary/20"
            disabled={state === "loading"}
          >
            {state === "loading" ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Sending Invite...
              </>
            ) : (
              <>
                <Send className="w-5 h-5 mr-2" />
                Send Invitation
              </>
            )}
          </Button>
        </form>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="space-y-6"
        >
          <div className="flex justify-center">
            <div className="p-4 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/20">
              <CheckCircle2 className="w-12 h-12 text-green-500" />
            </div>
          </div>

          <div className="text-center space-y-2">
            <h3 className="text-xl font-bold">Invitation Sent!</h3>
            <p className="text-sm text-muted-foreground">
              We&apos;ve sent an invite to{" "}
              <span className="font-medium text-foreground">{email}</span>
            </p>
          </div>

          {inviteData && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">
                  Share this link:
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={inviteData.invite_url}
                    readOnly
                    className="text-sm"
                  />
                  <Button
                    onClick={copyInviteLink}
                    variant="outline"
                    size="sm"
                    className="flex-shrink-0"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">
                  Or use code:
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={inviteData.invite_code}
                    readOnly
                    className="text-sm font-mono font-bold text-center tracking-wider"
                  />
                  <Button
                    onClick={copyInviteCode}
                    variant="outline"
                    size="sm"
                    className="flex-shrink-0"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <p className="text-xs text-center text-muted-foreground">
                Expires on{" "}
                {new Date(inviteData.expires_at).toLocaleDateString()}
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <Button
              onClick={() => {
                setState("idle");
                setEmail("");
                setInviteData(null);
              }}
              variant="outline"
              className="flex-1"
            >
              Invite Another
            </Button>
            <Button onClick={onClose} className="flex-1">
              Done
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );

  if (!mounted) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {isMobile ? (
            // MOBILE: Full Screen Drawer (Replicating FullScreenMenu style)
            createPortal(
              <motion.div
                initial={{ opacity: 0, y: "100%" }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="fixed inset-0 z-[9999] flex flex-col bg-background/95 backdrop-blur-xl"
              >
                {/* Header */}
                <div className="relative flex-shrink-0">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent pointer-events-none" />
                  <div className="relative flex items-center justify-between p-6 border-b border-border/50">
                    <div>
                      <h2 className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                        Invite a Friend
                      </h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        Give 25 XP, Get 25 XP
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={onClose}
                      className="hover:bg-primary/10"
                    >
                      <X className="h-6 w-6" />
                      <span className="sr-only">Close invite</span>
                    </Button>
                  </div>
                </div>

                {/* Mobile Content */}
                <div className="flex-1 overflow-y-auto p-6">
                  {renderContent()}
                </div>
              </motion.div>,
              document.body,
            )
          ) : (
            // DESKTOP: Centered Modal (Classic Style)
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                onClick={onClose}
              />
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  className="pointer-events-auto relative w-full max-w-md bg-gradient-to-br from-background via-background to-muted border border-border/50 rounded-2xl shadow-2xl overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Desktop Header */}
                  <div className="relative px-6 pt-6 pb-4 border-b border-border/50">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-rose-500/10 to-pink-500/10 pointer-events-none" />
                    <button
                      onClick={onClose}
                      className="absolute right-4 top-4 p-2 rounded-lg hover:bg-muted/50 transition-colors z-10"
                    >
                      <X className="w-5 h-5 text-muted-foreground" />
                    </button>

                    <div className="relative flex items-center gap-3">
                      <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-rose-500/20">
                        <Users className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold">Invite a Friend</h2>
                        <p className="text-sm text-muted-foreground">
                          Both get 25 XP when they join! 🎁
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Desktop Content */}
                  <div className="relative p-6">{renderContent()}</div>
                </motion.div>
              </div>
            </>
          )}
        </>
      )}
    </AnimatePresence>
  );
}
