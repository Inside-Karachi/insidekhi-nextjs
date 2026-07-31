"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  PenSquare,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  FileEdit,
} from "lucide-react";
import { useWriterBlogs } from "@/hooks/useWriterBlogs";
import { getPostStatusLabel } from "@/lib/blogs/status-display";
import type { PostStatus } from "@/types/blogs.types";

const statusIcon: Record<PostStatus, typeof Clock> = {
  draft: FileEdit,
  pending_approval: Clock,
  published: CheckCircle2,
  rejected: XCircle,
};

const statusVariant: Record<
  PostStatus,
  "default" | "secondary" | "destructive"
> = {
  draft: "secondary",
  pending_approval: "default",
  published: "default",
  rejected: "destructive",
};

export function WriterBlogsPage() {
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [page, setPage] = React.useState(1);

  const { blogs, pagination, loading } = useWriterBlogs({
    status: statusFilter,
    page,
    limit: 20,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Posts</h1>
          <p className="text-muted-foreground">
            Manage your drafts and submissions.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/writer/blogs/new">
            <PenSquare className="h-4 w-4 mr-2" />
            New Post
          </Link>
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <Select
          value={statusFilter}
          onValueChange={(value) => {
            setStatusFilter(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="pending_approval">Under Review</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="rejected">Needs Changes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-5 bg-muted rounded w-1/2 mb-2" />
                <div className="h-4 bg-muted rounded w-1/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : blogs.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <PenSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No posts yet</h3>
            <p className="text-muted-foreground mb-4">
              Start writing your first guide.
            </p>
            <Button asChild variant="outline">
              <Link href="/dashboard/writer/blogs/new">New Post</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {blogs.map((post) => {
            const Icon = statusIcon[post.status] ?? FileEdit;
            return (
              <motion.div key={post.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Link href={`/dashboard/writer/blogs/${post.id}`}>
                  <Card className="hover:shadow-lg transition-all duration-300 hover:border-primary/50">
                    <CardContent className="p-6 flex items-center justify-between">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-lg">{post.title}</h3>
                          <Badge variant={statusVariant[post.status]} className="gap-1">
                            <Icon className="h-3 w-3" />
                            {getPostStatusLabel(post.status)}
                          </Badge>
                        </div>
                        {post.excerpt && (
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {post.excerpt}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Created {new Date(post.created_at).toLocaleDateString()}
                        </p>
                        {post.status === "rejected" && post.review_notes && (
                          <p className="text-xs text-destructive mt-1">
                            {post.review_notes}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}

      {pagination && pagination.total_pages > 1 && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p - 1)}
            disabled={!pagination.has_prev}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.total_pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={!pagination.has_next}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      )}
    </div>
  );
}
