"use client";

import { CommentWithAuthor } from "@/types/comment.types";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  COMMENT_STATUS_COLORS,
  COMMENT_STATUS_LABELS,
} from "@/types/comment.types";
import { formatDistanceToNow, format } from "date-fns";
import {
  User,
  Calendar,
  MessageSquare,
  Eye,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Shield,
  Edit3,
} from "lucide-react";

interface CommentModalProps {
  comment: CommentWithAuthor;
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: (comment: CommentWithAuthor) => void;
}

export function CommentModal({
  comment,
  isOpen,
  onClose,
  onUpdate: _onUpdate,
}: CommentModalProps) {
  const getInitials = (name: string | null) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <CheckCircle className="h-4 w-4" />;
      case "rejected":
        return <XCircle className="h-4 w-4" />;
      case "flagged":
        return <AlertTriangle className="h-4 w-4" />;
      case "pending":
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-background border border-border">
        <DialogHeader className="pb-6">
          <DialogTitle className="flex items-center gap-3 text-xl font-bold text-foreground">
            <div className="p-2 bg-primary/10 rounded-lg">
              <MessageSquare className="h-6 w-6 text-primary" />
            </div>
            Comment Details
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-6">
          {/* Author Card */}
          <Card className="bg-card border border-border">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="relative">
                  <Avatar className="h-16 w-16 ring-2 ring-primary/20 ring-offset-2 ring-offset-background">
                    <AvatarImage src={comment.author_avatar || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">
                      {getInitials(comment.author_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-card border-2 border-background">
                    {getStatusIcon(comment.status)}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-bold text-lg text-foreground truncate">
                      {comment.author_name || "Anonymous User"}
                    </h3>
                    <Badge
                      variant="secondary"
                      className={`${
                        COMMENT_STATUS_COLORS[
                          comment.status as keyof typeof COMMENT_STATUS_COLORS
                        ]
                      } font-medium px-3 py-1 border shadow-sm`}
                    >
                      <span className="flex items-center gap-1.5">
                        {getStatusIcon(comment.status)}
                        {
                          COMMENT_STATUS_LABELS[
                            comment.status as keyof typeof COMMENT_STATUS_LABELS
                          ]
                        }
                      </span>
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <User className="h-4 w-4 text-primary" />
                      <span className="font-mono text-xs">
                        {comment.user_id.slice(0, 12)}...
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4 text-primary" />
                      <span>
                        {format(
                          new Date(comment.created_at),
                          "MMM dd, yyyy 'at' h:mm a"
                        )}
                      </span>
                    </div>
                    {comment.reply_count && comment.reply_count > 0 && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MessageSquare className="h-4 w-4 text-primary" />
                        <span>
                          {comment.reply_count} repl
                          {comment.reply_count === 1 ? "y" : "ies"}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Content Card */}
          <Card className="bg-card border border-border">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Edit3 className="h-5 w-5 text-primary" />
                </div>
                <h4 className="font-bold text-foreground uppercase tracking-wide text-sm">
                  Comment Content
                </h4>
              </div>
              <div className="bg-muted/30 rounded-lg p-4 border border-border/30">
                <p className="text-foreground leading-relaxed whitespace-pre-wrap text-sm">
                  {comment.content}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Metadata Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Review Information Card */}
            <Card className="bg-card border border-border">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Eye className="h-5 w-5 text-primary" />
                  </div>
                  <h4 className="font-bold text-foreground uppercase tracking-wide text-sm">
                    Review Information
                  </h4>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-border/30">
                    <span className="text-muted-foreground font-medium">
                      Review ID
                    </span>
                    <span className="font-mono text-foreground text-sm">
                      #{comment.review_id}
                    </span>
                  </div>
                  {comment.parent_id && (
                    <div className="flex justify-between items-center py-2 border-b border-border/30">
                      <span className="text-muted-foreground font-medium">
                        Parent Comment
                      </span>
                      <span className="font-mono text-foreground text-sm">
                        #{comment.parent_id}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center py-2">
                    <span className="text-muted-foreground font-medium">
                      Created
                    </span>
                    <span className="text-foreground text-sm">
                      {formatDistanceToNow(new Date(comment.created_at), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Moderation Information Card */}
            <Card className="bg-card border border-border">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  <h4 className="font-bold text-foreground uppercase tracking-wide text-sm">
                    Moderation Info
                  </h4>
                </div>
                <div className="space-y-3">
                  {comment.moderated_by ? (
                    <>
                      <div className="flex justify-between items-center py-2 border-b border-border/30">
                        <span className="text-muted-foreground font-medium">
                          Moderated By
                        </span>
                        <span className="font-mono text-foreground text-sm">
                          {comment.moderated_by.slice(0, 12)}...
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-border/30">
                        <span className="text-muted-foreground font-medium">
                          Moderated
                        </span>
                        <span className="text-foreground text-sm">
                          {formatDistanceToNow(
                            new Date(comment.moderated_at!),
                            { addSuffix: true }
                          )}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-4">
                      <div className="p-3 bg-muted/30 rounded-full w-fit mx-auto mb-2">
                        <Clock className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <p className="text-muted-foreground text-sm">
                        Not yet moderated
                      </p>
                    </div>
                  )}
                  {comment.updated_at !== comment.created_at && (
                    <div className="flex justify-between items-center py-2">
                      <span className="text-muted-foreground font-medium">
                        Last Updated
                      </span>
                      <span className="text-foreground text-sm">
                        {formatDistanceToNow(new Date(comment.updated_at), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Actions */}
          <Card className="bg-card border border-border">
            <CardContent className="p-6">
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="px-6 py-2 border-border hover:bg-accent transition-colors duration-200"
                >
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
