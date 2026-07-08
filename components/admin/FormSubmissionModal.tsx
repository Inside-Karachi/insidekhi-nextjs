"use client";

import * as React from "react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ClipboardList,
  Mail,
  Phone,
  Building,
  MapPin,
  Globe,
  Clock,
  FileText,
  Send,
  MessageSquare,
  Loader2,
  RefreshCw,
} from "lucide-react";
import type {
  FormSubmissionWithAssets,
  FormReplyTemplate,
  FormSubmissionReplyWithStaff,
} from "@/types/form.types";
import { RelativeTime } from "@/components/ui/RelativeTime";
import { useToast } from "@/hooks/use-toast";

interface FormSubmissionModalProps {
  submission: FormSubmissionWithAssets | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReplySuccess?: () => void;
}

function formatLabel(label: string) {
  return label
    .split(/[\s_-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function FormSubmissionModal({
  submission,
  open,
  onOpenChange,
  onReplySuccess,
}: FormSubmissionModalProps) {
  const { toast } = useToast();
  const modalRef = React.useRef<HTMLDivElement>(null);

  // Capture initial body state on component mount - BEFORE any modal interactions
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
  }, []);

  React.useEffect(() => {
    if (open && modalRef.current) {
      // Apply CSS containment to prevent layout shifts
      modalRef.current.style.contain = "layout style paint";
      modalRef.current.style.isolation = "isolate";
    }
  }, [open]);

  // Prevent layout shift when Radix Select dropdowns open
  React.useEffect(() => {
    if (open) {
      const body = document.body;
      const removeScrollLock = () => {
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
  }, [open]);

  // Prevent body height/layout shifts when modal opens
  React.useEffect(() => {
    if (open) {
      const body = document.body;

      // Immediately restore initial body state to prevent any shifts
      const restoreInitialState = () => {
        body.style.setProperty(
          "height",
          initialBodyState.current.height,
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
        body.style.setProperty(
          "overflow",
          initialBodyState.current.overflow,
          "important"
        );
      };

      restoreInitialState();

      // Set up MutationObserver to prevent any external changes
      const observer = new MutationObserver(() => {
        restoreInitialState();
      });

      observer.observe(body, {
        attributes: true,
        attributeFilter: ["style"],
      });

      return () => {
        observer.disconnect();
        // Clean up styles when modal closes
        body.style.removeProperty("height");
        body.style.removeProperty("min-height");
        body.style.removeProperty("max-height");
        body.style.removeProperty("margin-right");
        body.style.removeProperty("padding-right");
        body.style.removeProperty("overflow");
      };
    }
  }, [open]);

  // Quick Reply State
  const [showQuickReply, setShowQuickReply] = React.useState(false);
  const [replyText, setReplyText] = React.useState("");
  const [emailSubject, setEmailSubject] = React.useState("");
  const [selectedTemplate, setSelectedTemplate] = React.useState<string>("");
  const [newStatus, setNewStatus] = React.useState<string>("");
  const [isSending, setIsSending] = React.useState(false);
  const [templates, setTemplates] = React.useState<FormReplyTemplate[]>([]);
  const [replies, setReplies] = React.useState<FormSubmissionReplyWithStaff[]>(
    []
  );
  const [isLoadingReplies, setIsLoadingReplies] = React.useState(false);

  // Retry & Delete State
  const [userRole, setUserRole] = React.useState<string | null>(null);
  const [retryingReplyId, setRetryingReplyId] = React.useState<string | null>(
    null
  );
  const [deletingReplyId, setDeletingReplyId] = React.useState<string | null>(
    null
  );
  const [showDeletedReplies, setShowDeletedReplies] = React.useState(false);

  // Status Update State
  const [showStatusUpdate, setShowStatusUpdate] = React.useState(false);
  const [statusToUpdate, setStatusToUpdate] = React.useState<string>("");
  const [isUpdatingStatus, setIsUpdatingStatus] = React.useState(false);

  // Define fetchReplies before useEffect that uses it
  const fetchReplies = React.useCallback(
    async (includeDeleted = false) => {
      if (!submission) return;

      setIsLoadingReplies(true);
      try {
        const params = new URLSearchParams();
        if (includeDeleted) params.set("include_deleted", "true");

        const response = await fetch(
          `/api/admin/forms/${submission.id}/replies?${params.toString()}`
        );
        if (response.ok) {
          const data = await response.json();
          setReplies(data.replies || []);
        }
      } catch (error) {
        console.error("Failed to fetch replies:", error);
      } finally {
        setIsLoadingReplies(false);
      }
    },
    [submission]
  );

  // Fetch templates and replies when modal opens
  React.useEffect(() => {
    if (open && submission) {
      fetchTemplates();
      fetchReplies(showDeletedReplies);
      // Set initial email subject
      setEmailSubject(
        `Re: Your ${formatLabel(submission.form_type)} Submission`
      );
      // Set default new status if current is pending
      if (!submission.status || submission.status === "pending") {
        setNewStatus("in_review");
      }
    } else {
      // Reset state when modal closes
      setShowQuickReply(false);
      setReplyText("");
      setSelectedTemplate("");
      setNewStatus("");
    }
  }, [open, submission, fetchReplies, showDeletedReplies]);

  const fetchTemplates = async () => {
    try {
      const response = await fetch("/api/admin/forms/templates");
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates || []);
      }
    } catch (error) {
      console.error("Failed to fetch templates:", error);
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);

    // If "custom" is selected, don't load any template
    if (!templateId || templateId === "custom") return;

    const template = templates.find((t) => t.id === templateId);
    if (!template || !submission) return;

    // Replace template variables
    let subject = template.subject;
    let body = template.body;

    const replacements: Record<string, string> = {
      "{{name}}": submission.name || submission.company_name || "there",
      "{{formType}}": formatLabel(submission.form_type),
      "{{email}}": submission.email,
      "{{companyName}}": submission.company_name || "",
    };

    Object.entries(replacements).forEach(([key, value]) => {
      subject = subject.replace(new RegExp(key, "g"), value);
      body = body.replace(new RegExp(key, "g"), value);
    });

    setEmailSubject(subject);
    setReplyText(body);
  };

  const handleSendReply = async () => {
    if (!submission || !replyText.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a reply message.",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    try {
      const response = await fetch(`/api/admin/forms/${submission.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          replyText: replyText.trim(),
          emailSubject: emailSubject.trim(),
          newStatus:
            newStatus && newStatus !== "no_change" ? newStatus : undefined,
          previousStatus: submission.status,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to send reply");
      }

      // Check email status
      if (data.emailSent) {
        toast({
          title: "Reply Sent Successfully!",
          description: "Email has been delivered to the recipient.",
        });
      } else {
        // Email failed but reply was saved
        toast({
          title: "Reply Saved (Email Failed)",
          description:
            data.emailError ||
            "Email could not be sent. Please check Brevo configuration and sender email verification.",
          variant: "destructive",
        });
      }

      // Reset form
      setReplyText("");
      setEmailSubject("");
      setSelectedTemplate("");
      setNewStatus("no_change");
      setShowQuickReply(false);

      // Refresh replies
      await fetchReplies();

      // Notify parent to refresh submission data
      onReplySuccess?.();
    } catch (error) {
      console.error("Send reply error:", error);
      toast({
        title: "Send Failed",
        description:
          error instanceof Error ? error.message : "Failed to send reply",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  // Handle status update without reply
  const handleStatusUpdate = async () => {
    if (!submission || !statusToUpdate) {
      toast({
        title: "Validation Error",
        description: "Please select a status.",
        variant: "destructive",
      });
      return;
    }

    setIsUpdatingStatus(true);
    try {
      const response = await fetch(`/api/admin/forms/${submission.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: statusToUpdate,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to update status");
      }

      toast({
        title: "Status Updated!",
        description: `Status changed to "${formatLabel(statusToUpdate)}"`,
      });

      // Reset form
      setStatusToUpdate("");
      setShowStatusUpdate(false);

      // Notify parent to refresh submission data
      onReplySuccess?.();
    } catch (error) {
      console.error("Update status error:", error);
      toast({
        title: "Update Failed",
        description:
          error instanceof Error ? error.message : "Failed to update status",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Fetch user role for button visibility
  React.useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .single();

          setUserRole(profile?.role || null);
        }
      } catch (error) {
        console.error("Failed to fetch user role:", error);
      }
    };

    fetchUserRole();
  }, []);

  // Realtime subscription for new replies
  React.useEffect(() => {
    if (!open || !submission) return;

    const setupRealtime = async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();

      const channel = supabase
        .channel(`submission-${submission.id}-replies`)
        .on(
          "postgres_changes",
          {
            event: "*", // Listen to all events (INSERT, UPDATE, DELETE)
            schema: "public",
            table: "form_submission_replies",
            filter: `submission_id=eq.${submission.id}`,
          },
          () => {
            // Refresh replies when any change occurs
            fetchReplies(showDeletedReplies);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    setupRealtime();
  }, [open, submission, fetchReplies, showDeletedReplies]);

  // Retry failed email
  const handleRetryEmail = async (replyId: string) => {
    setRetryingReplyId(replyId);
    try {
      const response = await fetch(
        `/api/admin/forms/replies/${replyId}/retry`,
        { method: "POST" }
      );
      const data = await response.json();

      if (data.emailSent) {
        toast({
          title: "✅ Email Sent!",
          description: "Email successfully delivered on retry.",
        });
      } else {
        toast({
          title: "⚠️ Retry Failed",
          description:
            data.error ||
            "Email could not be sent. Check Brevo sender verification.",
          variant: "destructive",
        });
      }

      await fetchReplies(); // Refresh list
    } catch (error) {
      console.error("Retry error:", error);
      toast({
        title: "Error",
        description: "Failed to retry email. Please try again.",
        variant: "destructive",
      });
    } finally {
      setRetryingReplyId(null);
    }
  };

  // Delete reply (soft or hard)
  const handleDeleteReply = async (replyId: string, hardDelete = false) => {
    const confirmMessage = hardDelete
      ? "⚠️ PERMANENTLY DELETE this reply? This cannot be undone and will remove it from the database!"
      : "Move this reply to trash? You can restore it later if needed.";

    const confirmed = window.confirm(confirmMessage);
    if (!confirmed) return;

    const reason = hardDelete
      ? window.prompt(
          "Required: Please provide a reason for permanent deletion:"
        )
      : null;

    if (hardDelete && !reason?.trim()) {
      toast({
        title: "Deletion Cancelled",
        description: "Reason is required for permanent deletion.",
        variant: "destructive",
      });
      return;
    }

    setDeletingReplyId(replyId);
    try {
      const params = new URLSearchParams();
      if (hardDelete) params.set("hard", "true");
      if (reason) params.set("reason", reason);

      const response = await fetch(
        `/api/admin/forms/replies/${replyId}/delete?${params.toString()}`,
        { method: "DELETE" }
      );

      const data = await response.json();

      if (data.success) {
        toast({
          title: hardDelete ? "🗑️ Permanently Deleted" : "📦 Moved to Trash",
          description: hardDelete
            ? "Reply has been permanently removed."
            : "Reply has been soft deleted and hidden from view.",
        });
        await fetchReplies(); // Refresh list
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error("Delete error:", error);
      toast({
        title: "Delete Failed",
        description:
          error instanceof Error ? error.message : "Failed to delete reply",
        variant: "destructive",
      });
    } finally {
      setDeletingReplyId(null);
    }
  };

  const additionalData = React.useMemo(() => {
    if (!submission?.additional_data) return [];
    if (
      typeof submission.additional_data !== "object" ||
      Array.isArray(submission.additional_data)
    ) {
      return [];
    }

    return Object.entries(submission.additional_data).filter(
      ([, value]) => value !== null && value !== undefined
    );
  }, [submission?.additional_data]);

  const getBadgeIntent = (status: string | null) => {
    if (!status || status === "pending") {
      return "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800";
    }

    switch (status.toLowerCase()) {
      case "approved":
      case "completed":
      case "resolved":
        return "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
      case "in_review":
      case "processing":
        return "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800";
      case "rejected":
      case "closed":
        return "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800";
      default:
        return "bg-slate-50 dark:bg-slate-950/30 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={modalRef}
        className="max-h-[90vh] max-w-4xl border-border/40 bg-gradient-to-br from-background/95 via-background/90 to-background/95 p-0 shadow-xl"
      >
        {submission ? (
          <div className="flex max-h-[90vh] flex-col">
            <DialogHeader className="shrink-0 px-8 pb-0 pt-8 text-left">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-2">
                  <DialogTitle className="text-2xl font-semibold">
                    {submission.name ||
                      submission.company_name ||
                      "Form submission"}
                  </DialogTitle>
                  <DialogDescription className="text-sm text-muted-foreground">
                    Received via {formatLabel(submission.form_type)}
                  </DialogDescription>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="rounded-full bg-primary/15 text-xs font-semibold uppercase tracking-wider text-primary">
                      <ClipboardList className="mr-1 h-3.5 w-3.5" />
                      {formatLabel(submission.form_type)}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={getBadgeIntent(submission.status)}
                    >
                      {submission.status
                        ? formatLabel(submission.status)
                        : "New"}
                    </Badge>
                    {submission.submitted_at && (
                      <Badge variant="outline" className="rounded-full text-xs">
                        <Clock className="mr-1 h-3 w-3" />
                        <RelativeTime date={submission.submitted_at} />
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>Submission ID: {submission.id}</p>
                  {submission.uploaded_by && (
                    <p>Uploaded by: {submission.uploaded_by}</p>
                  )}
                </div>
              </div>
            </DialogHeader>

            <ScrollArea className="flex-1 px-8 py-6">
              <div className="grid gap-6">
                <section className="rounded-2xl border border-border/40 bg-background/80 p-5 shadow-sm">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Contact details
                  </h3>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-primary" />
                      <span>{submission.email}</span>
                    </div>
                    {submission.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-primary" />
                        <span>{submission.phone}</span>
                      </div>
                    )}
                    {submission.company_name && (
                      <div className="flex items-center gap-2 text-sm">
                        <Building className="h-4 w-4 text-primary" />
                        <span>{submission.company_name}</span>
                      </div>
                    )}
                    {submission.city && (
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-primary" />
                        <span>
                          {submission.city}
                          {submission.state ? `, ${submission.state}` : ""}
                        </span>
                      </div>
                    )}
                    {submission.website && (
                      <div className="flex items-center gap-2 text-sm">
                        <Globe className="h-4 w-4 text-primary" />
                        <a
                          href={
                            submission.website.startsWith("http")
                              ? submission.website
                              : `https://${submission.website}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline-offset-2 hover:underline"
                        >
                          {submission.website}
                        </a>
                      </div>
                    )}
                  </div>
                </section>

                {(submission.business_type ||
                  submission.years_in_business ||
                  submission.operating_hours ||
                  submission.social_media) && (
                  <section className="rounded-2xl border border-border/40 bg-background/80 p-5 shadow-sm">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      Business profile
                    </h3>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {submission.business_type && (
                        <div className="flex items-center gap-2 text-sm">
                          <ClipboardList className="h-4 w-4 text-primary" />
                          <span>{submission.business_type}</span>
                        </div>
                      )}
                      {submission.years_in_business && (
                        <div className="flex items-center gap-2 text-sm">
                          <FileText className="h-4 w-4 text-primary" />
                          <span>
                            {submission.years_in_business} years in business
                          </span>
                        </div>
                      )}
                      {submission.operating_hours && (
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-4 w-4 text-primary" />
                          <span>{submission.operating_hours}</span>
                        </div>
                      )}
                      {submission.social_media && (
                        <div className="flex items-center gap-2 text-sm">
                          <Globe className="h-4 w-4 text-primary" />
                          <span>{submission.social_media}</span>
                        </div>
                      )}
                    </div>
                  </section>
                )}

                {submission.message && (
                  <section className="rounded-2xl border border-border/40 bg-background/80 p-5 shadow-sm">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      Message
                    </h3>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                      {submission.message}
                    </p>
                  </section>
                )}

                {additionalData.length > 0 && (
                  <section className="rounded-2xl border border-border/40 bg-background/80 p-5 shadow-sm">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      Additional details
                    </h3>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {additionalData.map(([key, value]) => (
                        <div
                          key={key}
                          className="rounded-xl bg-muted/20 p-3 text-sm"
                        >
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {formatLabel(key)}
                          </p>
                          <p className="mt-1 break-words text-muted-foreground">
                            {String(value)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {submission.images && submission.images.length > 0 && (
                  <section className="rounded-2xl border border-border/40 bg-background/80 p-5 shadow-sm">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      Attachments (
                      {submission.attachmentsCount ?? submission.images.length})
                    </h3>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      {submission.images
                        .filter((img) => img.variant === "thumb")
                        .map((image) => (
                          <a
                            key={`${image.submission_id}-${image.storage_path}`}
                            href={image.public_url ?? undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group relative block overflow-hidden rounded-xl border border-border/40 bg-muted/20 shadow-sm"
                          >
                            {image.public_url ? (
                              <Image
                                src={image.public_url}
                                alt="Form submission attachment"
                                width={480}
                                height={360}
                                className="h-48 w-full object-cover transition-transform duration-300 group-hover:scale-105"
                              />
                            ) : (
                              <div className="flex h-48 w-full items-center justify-center text-sm text-muted-foreground">
                                Preview not available
                              </div>
                            )}
                          </a>
                        ))}
                    </div>
                  </section>
                )}

                {/* Quick Reply Form - Inside ScrollArea for scrollability */}
                {showQuickReply && (
                  <section className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/5 p-5 shadow-sm animate-in slide-in-from-top-4">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-primary flex items-center gap-2 mb-4">
                      <MessageSquare className="h-4 w-4" />
                      Quick Reply
                    </h3>

                    <div className="space-y-4">
                      {/* Template Selector */}
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 block">
                          Email Template
                        </label>
                        <Select
                          value={selectedTemplate}
                          onValueChange={handleTemplateSelect}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select a template or write custom" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="custom">Custom Reply</SelectItem>
                            {templates.map((template) => (
                              <SelectItem key={template.id} value={template.id}>
                                {template.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Email Subject */}
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 block">
                          Subject
                        </label>
                        <Textarea
                          value={emailSubject}
                          onChange={(e) => setEmailSubject(e.target.value)}
                          placeholder="Email subject..."
                          className="min-h-[40px] max-h-[60px]"
                          rows={1}
                        />
                      </div>

                      {/* Reply Text */}
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 block">
                          Message
                        </label>
                        <Textarea
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Type your reply here..."
                          className="min-h-[120px]"
                          rows={4}
                        />
                      </div>

                      {/* Status Update */}
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 block">
                          Update Status
                        </label>
                        <Select value={newStatus} onValueChange={setNewStatus}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Keep current status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="no_change">No Change</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="in_review">In Review</SelectItem>
                            <SelectItem value="approved">Approved</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Send Button */}
                      <div className="flex gap-3 pt-2">
                        <Button
                          onClick={handleSendReply}
                          disabled={isSending || !replyText.trim()}
                          className="flex-1"
                        >
                          {isSending ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Sending...
                            </>
                          ) : (
                            <>
                              <Send className="h-4 w-4 mr-2" />
                              Send Reply
                              {newStatus &&
                                newStatus !== "no_change" &&
                                " & Update Status"}
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </section>
                )}

                {/* Status Update Form - Compact inline version */}
                {showStatusUpdate && (
                  <section className="rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-blue-500/10 dark:from-blue-500/10 dark:to-blue-500/5 p-5 shadow-sm animate-in slide-in-from-top-4">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400 flex items-center gap-2 mb-4">
                      <RefreshCw className="h-4 w-4" />
                      Update Status
                    </h3>

                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 block">
                          New Status
                        </label>
                        <Select
                          value={statusToUpdate}
                          onValueChange={setStatusToUpdate}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select new status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="in_review">In Review</SelectItem>
                            <SelectItem value="approved">Approved</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="closed">Closed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setShowStatusUpdate(false);
                            setStatusToUpdate("");
                          }}
                          disabled={isUpdatingStatus}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleStatusUpdate}
                          disabled={isUpdatingStatus || !statusToUpdate}
                          className="gap-2"
                        >
                          {isUpdatingStatus ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Updating...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="h-4 w-4" />
                              Update Status
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </section>
                )}

                {/* Reply History */}
                {replies.length > 0 && (
                  <section className="rounded-2xl border border-border/40 bg-background/80 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                        Reply History ({replies.length})
                      </h3>
                      {userRole === "super_admin" && (
                        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                          <input
                            type="checkbox"
                            checked={showDeletedReplies}
                            onChange={(e) => {
                              setShowDeletedReplies(e.target.checked);
                              fetchReplies(e.target.checked);
                            }}
                            className="rounded border-border"
                          />
                          <span>Show deleted</span>
                        </label>
                      )}
                    </div>
                    <div className="space-y-4">
                      {isLoadingReplies ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                      ) : (
                        replies.map((reply) => (
                          <div
                            key={reply.id}
                            className={`rounded-xl p-4 text-sm ${
                              reply.deleted_at
                                ? "bg-destructive/5 border border-destructive/20 opacity-70"
                                : "bg-muted/20"
                            }`}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div>
                                  <p className="font-semibold text-foreground">
                                    {reply.staff_name || "Staff Member"}
                                  </p>
                                  {reply.staff_username && (
                                    <p className="text-xs text-muted-foreground">
                                      @{reply.staff_username}
                                    </p>
                                  )}
                                </div>
                                {reply.deleted_at && (
                                  <Badge
                                    variant="destructive"
                                    className="text-xs"
                                  >
                                    🗑️ Deleted
                                  </Badge>
                                )}
                              </div>
                              <div className="text-right">
                                <Badge
                                  variant={
                                    reply.reply_type === "email_failed"
                                      ? "destructive"
                                      : "outline"
                                  }
                                  className="text-xs mb-1"
                                >
                                  {reply.reply_type === "email_failed"
                                    ? "❌ Failed"
                                    : reply.reply_type === "email_sent"
                                    ? "✅ Sent"
                                    : formatLabel(reply.reply_type)}
                                </Badge>
                                <p className="text-xs text-muted-foreground">
                                  <RelativeTime date={reply.created_at} />
                                </p>
                              </div>
                            </div>

                            {reply.email_subject && (
                              <p className="font-medium text-foreground mb-1">
                                {reply.email_subject}
                              </p>
                            )}

                            {reply.reply_text && (
                              <p className="whitespace-pre-wrap text-muted-foreground mt-2">
                                {reply.reply_text}
                              </p>
                            )}

                            {reply.new_status && reply.previous_status && (
                              <div className="mt-3 flex items-center gap-2 text-xs">
                                <Badge variant="outline">
                                  {formatLabel(reply.previous_status)}
                                </Badge>
                                <span className="text-muted-foreground">→</span>
                                <Badge variant="outline">
                                  {formatLabel(reply.new_status)}
                                </Badge>
                              </div>
                            )}

                            {/* Show retry count if > 0 */}
                            {(reply.retry_count || 0) > 0 && (
                              <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                                <span>🔄</span>
                                <span>Retried {reply.retry_count} time(s)</span>
                              </div>
                            )}

                            {/* Action Buttons */}
                            {(reply.reply_type === "email_failed" ||
                              userRole === "admin" ||
                              userRole === "super_admin") && (
                              <div className="flex gap-2 mt-4 pt-3 border-t border-border/40">
                                {reply.reply_type === "email_failed" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleRetryEmail(reply.id)}
                                    disabled={retryingReplyId === reply.id}
                                    className="gap-1"
                                  >
                                    {retryingReplyId === reply.id ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <span>🔄</span>
                                    )}
                                    Retry Email
                                  </Button>
                                )}

                                {(userRole === "admin" ||
                                  userRole === "super_admin") && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() =>
                                      handleDeleteReply(reply.id, false)
                                    }
                                    disabled={deletingReplyId === reply.id}
                                    className="gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  >
                                    {deletingReplyId === reply.id ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <span>🗑️</span>
                                    )}
                                    Delete
                                  </Button>
                                )}

                                {userRole === "super_admin" && (
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() =>
                                      handleDeleteReply(reply.id, true)
                                    }
                                    disabled={deletingReplyId === reply.id}
                                    className="gap-1"
                                  >
                                    {deletingReplyId === reply.id ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <span>⚠️</span>
                                    )}
                                    Permanent Delete
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </section>
                )}
              </div>
            </ScrollArea>

            <div className="shrink-0 flex justify-between items-center gap-3 border-t border-border/40 bg-background/80 px-8 py-4">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowQuickReply(!showQuickReply);
                    if (showStatusUpdate) setShowStatusUpdate(false);
                  }}
                  className="gap-2"
                >
                  <MessageSquare className="h-4 w-4" />
                  {showQuickReply ? "Hide" : "Quick"} Reply
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowStatusUpdate(!showStatusUpdate);
                    if (showQuickReply) setShowQuickReply(false);
                  }}
                  className="gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  {showStatusUpdate ? "Hide" : "Update"} Status
                </Button>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-muted-foreground">
            Unable to load submission details.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
