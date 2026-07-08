"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

interface ReportIssueModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportType: "listing" | "event";
  itemId: number | null;
  itemName: string | null;
  itemSlug: string | null;
}

const LISTING_ISSUE_TYPES = [
  { value: "incorrect_hours", label: "Incorrect Opening Hours" },
  { value: "wrong_address", label: "Wrong Address/Location" },
  { value: "wrong_phone", label: "Wrong Phone Number" },
  { value: "closed_permanently", label: "Business Closed Permanently" },
  { value: "incorrect_info", label: "Other Incorrect Information" },
  { value: "inappropriate_content", label: "Inappropriate Content" },
  { value: "duplicate", label: "Duplicate Listing" },
  { value: "other", label: "Other Issue" },
];

const EVENT_ISSUE_TYPES = [
  { value: "wrong_datetime", label: "Wrong Event Date/Time" },
  { value: "wrong_venue", label: "Incorrect Venue Information" },
  { value: "wrong_pricing", label: "Wrong Ticket Pricing" },
  { value: "event_cancelled", label: "Event Cancelled" },
  { value: "sold_out", label: "Event Sold Out" },
  { value: "incorrect_details", label: "Incorrect Event Details" },
  { value: "inappropriate_content", label: "Inappropriate Content" },
  { value: "duplicate", label: "Duplicate Event" },
  { value: "other", label: "Other Issue" },
];

export function ReportIssueModal({
  isOpen,
  onClose,
  reportType,
  itemId,
  itemName,
  itemSlug,
}: ReportIssueModalProps) {
  const [issueType, setIssueType] = useState("");
  const [description, setDescription] = useState("");
  const [email, setEmail] = useState("");
  const [honeypot, setHoneypot] = useState(""); // Honeypot for bot detection
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { toast } = useToast();

  const issueTypes =
    reportType === "listing" ? LISTING_ISSUE_TYPES : EVENT_ISSUE_TYPES;
  const itemTypeLabel = reportType === "listing" ? "listing" : "event";
  const formType = reportType === "listing" ? "listing_report" : "event_report";

  // Capture initial body state on component mount - BEFORE any modal interactions
  const initialBodyState = useRef({
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

  // Initialize body state capture
  useEffect(() => {
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
  }, []);

  // Mount state for portal
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Prevent body height/layout shifts when modal opens - PROACTIVE APPROACH
  useEffect(() => {
    if (isOpen) {
      const body = document.body;
      const html = document.documentElement;

      // Immediately restore initial body state to prevent any shifts
      const restoreInitialState = () => {
        // Force body to maintain exact initial dimensions with !important
        body.style.setProperty(
          "height",
          initialBodyState.current.height || "auto",
          "important"
        );
        body.style.setProperty(
          "min-height",
          initialBodyState.current.minHeight,
          "important"
        );
        body.style.setProperty(
          "max-height",
          initialBodyState.current.maxHeight,
          "important"
        );
        body.style.setProperty(
          "margin-right",
          initialBodyState.current.marginRight,
          "important"
        );
        body.style.setProperty(
          "padding-right",
          initialBodyState.current.paddingRight,
          "important"
        );
        body.style.setProperty("overflow", "hidden", "important");
        body.style.setProperty(
          "position",
          initialBodyState.current.position,
          "important"
        );

        // Remove Radix scroll lock attribute
        body.removeAttribute("data-scroll-locked");

        // Prevent any layout shifts by fixing body dimensions
        if (
          !initialBodyState.current.height ||
          initialBodyState.current.height === "auto"
        ) {
          body.style.setProperty(
            "height",
            `${initialBodyState.current.scrollHeight}px`,
            "important"
          );
        }

        // Also ensure html doesn't change
        html.style.overflow = "hidden";
        html.style.height = "auto";
      };

      // Restore immediately
      restoreInitialState();

      // Set up aggressive monitoring to prevent any changes from Radix Select
      const preventBodyChanges = () => {
        const currentScrollHeight = body.scrollHeight;
        const currentClientHeight = body.clientHeight;

        // If body dimensions have changed from initial state, restore them
        if (
          Math.abs(
            currentScrollHeight - initialBodyState.current.scrollHeight
          ) > 5 ||
          Math.abs(
            currentClientHeight - initialBodyState.current.clientHeight
          ) > 5
        ) {
          restoreInitialState();
        }

        // Also check for scroll lock attribute (Radix adds this)
        if (body.hasAttribute("data-scroll-locked")) {
          restoreInitialState();
        }

        // Check for any style changes that might cause shifts
        const computedStyle = getComputedStyle(body);
        if (
          computedStyle.overflow !== "hidden" ||
          computedStyle.marginRight !== initialBodyState.current.marginRight
        ) {
          restoreInitialState();
        }
      };

      // Monitor for changes every 16ms (roughly 60fps)
      const monitorInterval = setInterval(preventBodyChanges, 16);

      // Also set up a MutationObserver to catch immediate changes
      const observer = new MutationObserver(() => {
        preventBodyChanges();
      });

      observer.observe(body, {
        attributes: true,
        attributeFilter: ["style", "data-scroll-locked"],
      });

      observer.observe(html, {
        attributes: true,
        attributeFilter: ["style"],
      });

      return () => {
        clearInterval(monitorInterval);
        observer.disconnect();
        // Clean up any forced styles when modal closes
        body.style.removeProperty("height");
        body.style.removeProperty("min-height");
        body.style.removeProperty("max-height");
        body.style.removeProperty("margin-right");
        body.style.removeProperty("padding-right");
        body.style.removeProperty("overflow");
        body.style.removeProperty("position");
        html.style.removeProperty("overflow");
        html.style.removeProperty("height");
      };
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Honeypot check - if filled, it's a bot
    if (honeypot) {
      console.log("Bot detected via honeypot");
      return;
    }

    if (!issueType) {
      toast({
        title: "Please select an issue type",
        variant: "destructive",
      });
      return;
    }

    if (!description.trim()) {
      toast({
        title: "Please describe the issue",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      const metadata =
        reportType === "listing"
          ? {
            listing_id: itemId,
            listing_name: itemName,
            listing_slug: itemSlug,
            issue_type: issueType,
            issue_type_label:
              issueTypes.find((t) => t.value === issueType)?.label ||
              issueType,
          }
          : {
            event_id: itemId,
            event_name: itemName,
            event_slug: itemSlug,
            issue_type: issueType,
            issue_type_label:
              issueTypes.find((t) => t.value === issueType)?.label ||
              issueType,
          };

      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          form_type: formType,
          email: email.trim() || "anonymous@insidekarachi.com",
          message: description.trim(),
          metadata,
          honeypot, // Send honeypot for server-side validation
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit report");
      }

      setSubmitted(true);
      toast({
        title: "Report submitted successfully",
        description: `Thank you for helping us improve our ${itemTypeLabel}s!`,
      });

      setTimeout(() => {
        onClose();
        // Reset after close animation
        setTimeout(() => {
          setSubmitted(false);
          setIssueType("");
          setDescription("");
          setEmail("");
        }, 300);
      }, 2000);
    } catch (error) {
      console.error("Error submitting report:", error);
      toast({
        title: "Failed to submit report",
        description:
          error instanceof Error ? error.message : "Please try again later",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      onClose();
    }
  };

  // Don't render on server or before mounted
  if (!mounted) return null;

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100]"
          />

          {/* Modal */}
          <div className="fixed inset-0 flex items-center justify-center z-[100] p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto pointer-events-auto"
            >
              {!submitted ? (
                <>
                  {/* Header */}
                  <div className="sticky top-0 bg-background border-b border-border p-6 flex items-center justify-between z-10">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
                        <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold">
                          Report an Issue
                        </h2>
                        <p className="text-xs text-muted-foreground">
                          {itemName}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleClose}
                      disabled={submitting}
                      className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Form */}
                  <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="issue-type">
                        What&apos;s wrong with this {itemTypeLabel}?
                        <span className="text-destructive ml-1">*</span>
                      </Label>
                      <Select value={issueType} onValueChange={setIssueType}>
                        <SelectTrigger id="issue-type">
                          <SelectValue placeholder="Select an issue type" />
                        </SelectTrigger>
                        <SelectContent className="z-[110]">
                          {issueTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">
                        Description
                        <span className="text-destructive ml-1">*</span>
                      </Label>
                      <Textarea
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Please provide details about the issue..."
                        rows={4}
                        className="resize-none"
                        disabled={submitting}
                      />
                      <p className="text-xs text-muted-foreground">
                        Be as specific as possible to help us fix the issue
                        quickly.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">
                        Your Email{" "}
                        <span className="text-muted-foreground text-xs">
                          (optional)
                        </span>
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your@email.com"
                        disabled={submitting}
                      />
                      <p className="text-xs text-muted-foreground">
                        We&apos;ll update you when the issue is resolved.
                      </p>
                    </div>

                    {/* Honeypot field - hidden from users, visible to bots */}
                    <input
                      type="text"
                      name="website"
                      value={honeypot}
                      onChange={(e) => setHoneypot(e.target.value)}
                      autoComplete="off"
                      tabIndex={-1}
                      style={{
                        position: "absolute",
                        left: "-9999px",
                        width: "1px",
                        height: "1px",
                        opacity: 0,
                      }}
                      aria-hidden="true"
                    />

                    <div className="flex gap-3 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleClose}
                        disabled={submitting}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={
                          submitting || !issueType || !description.trim()
                        }
                        className="flex-1"
                      >
                        {submitting ? "Submitting..." : "Submit Report"}
                      </Button>
                    </div>
                  </form>
                </>
              ) : (
                /* Success State */
                <div className="p-8 text-center space-y-4">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="mx-auto h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center"
                  >
                    <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
                  </motion.div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">
                      Report Submitted!
                    </h3>
                    <p className="text-muted-foreground">
                      Thank you for helping us improve Inside Karachi.
                      We&apos;ll review your report and take appropriate action.
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
}
