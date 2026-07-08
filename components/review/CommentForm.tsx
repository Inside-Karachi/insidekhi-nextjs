"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface CommentFormProps {
  onSubmit: (content: string) => Promise<void>;
  placeholder?: string;
  initialValue?: string;
  className?: string;
  isReply?: boolean;
  onCancel?: () => void;
}

export function CommentForm({
  onSubmit,
  placeholder = "Write a comment...",
  initialValue = "",
  className = "",
  isReply = false,
  onCancel,
}: CommentFormProps) {
  const [content, setContent] = useState(initialValue);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!content.trim()) {
      toast({
        title: "Error",
        description: "Comment cannot be empty",
        variant: "destructive",
      });
      return;
    }

    if (content.length > 2000) {
      toast({
        title: "Error",
        description: "Comment must be less than 2000 characters",
        variant: "destructive",
      });
      return;
    }

    try {
      setSubmitting(true);
      await onSubmit(content.trim());
      setContent("");
      if (onCancel) onCancel();
    } catch (_error) {
      // Error is handled by the parent component
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    setContent("");
    if (onCancel) onCancel();
  };

  return (
    <form onSubmit={handleSubmit} className={cn("space-y-3", className)}>
      <div className="relative">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={placeholder}
          className={cn(
            "min-h-[80px] resize-none",
            isReply && "min-h-[60px] text-sm"
          )}
          disabled={submitting}
          maxLength={2000}
        />
        <div className="absolute bottom-2 right-2 text-xs text-muted-foreground">
          {content.length}/2000
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button
            type="submit"
            size={isReply ? "sm" : "default"}
            disabled={submitting || !content.trim()}
            className="min-w-[80px]"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                {isReply ? "Reply" : "Comment"}
              </>
            )}
          </Button>

          {(onCancel || content) && (
            <Button
              type="button"
              variant="ghost"
              size={isReply ? "sm" : "default"}
              onClick={handleCancel}
              disabled={submitting}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
