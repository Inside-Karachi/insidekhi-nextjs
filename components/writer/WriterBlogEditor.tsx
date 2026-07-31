"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff, Send } from "lucide-react";
import { FeaturedImageUpload } from "@/components/writer/FeaturedImageUpload";
import { BlogCategoryPicker } from "@/components/writer/BlogCategoryPicker";
import { renderMarkdown } from "@/lib/blogs/markdown";
import { getPostStatusLabel } from "@/lib/blogs/status-display";
import type { WriterBlogDetail } from "@/types/blogs.types";

interface WriterBlogEditorProps {
  mode: "create" | "edit";
  postId?: number;
  initialData?: WriterBlogDetail;
}

export function WriterBlogEditor({ mode, postId, initialData }: WriterBlogEditorProps) {
  const router = useRouter();
  const { toast } = useToast();

  const isReadOnly =
    mode === "edit" &&
    initialData != null &&
    !["draft", "rejected"].includes(initialData.status);

  const [title, setTitle] = React.useState(initialData?.title ?? "");
  const [excerpt, setExcerpt] = React.useState(initialData?.excerpt ?? "");
  const [content, setContent] = React.useState(initialData?.content ?? "");
  const [featuredImageUrl, setFeaturedImageUrl] = React.useState<string | null>(
    initialData?.featured_image_url ?? null,
  );
  const [tempFileName, setTempFileName] = React.useState<string | null>(null);
  const [categoryIds, setCategoryIds] = React.useState<number[]>(
    initialData?.category_ids ?? [],
  );
  const [primaryCategoryId, setPrimaryCategoryId] = React.useState<number | null>(
    initialData?.category_ids?.[0] ?? null,
  );
  const [showPreview, setShowPreview] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!title || title.length < 5) {
      newErrors.title = "Title must be at least 5 characters";
    }
    if (!content || content.length < 50) {
      newErrors.content = "Content must be at least 50 characters";
    }
    if (categoryIds.length === 0) {
      newErrors.category_ids = "Select at least one category";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /** Creates or updates the post. Returns the post id on success, null on failure (already toasted). */
  const saveDraft = async (): Promise<number | null> => {
    const payload = {
      title,
      excerpt: excerpt || null,
      content,
      temp_file_name: tempFileName,
      category_ids: categoryIds,
      primary_category_id: primaryCategoryId,
    };

    const endpoint =
      mode === "create" ? "/api/writer/blogs" : `/api/writer/blogs/${postId}`;
    const method = mode === "create" ? "POST" : "PUT";

    const response = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();

    if (!result.success) {
      toast({
        title: "Error",
        description: result.error || "Failed to save post",
        variant: "destructive",
      });
      return null;
    }

    return mode === "create" ? result.data.id : postId ?? null;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const savedId = await saveDraft();
      if (savedId == null) return;

      toast({ title: "Saved", description: "Your post has been saved." });

      if (mode === "create") {
        router.push(`/dashboard/writer/blogs/${savedId}`);
      } else {
        setTempFileName(null);
        router.refresh();
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to save post",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const submitForReview = async (id: number) => {
    const response = await fetch(`/api/writer/blogs/${id}/submit`, {
      method: "POST",
    });
    return response.json();
  };

  const handleSubmitForReview = async () => {
    if (!postId) return;
    setSubmitting(true);
    try {
      const result = await submitForReview(postId);

      if (!result.success) {
        toast({
          title: "Error",
          description: result.error || "Failed to submit post",
          variant: "destructive",
        });
        return;
      }

      toast({ title: "Submitted", description: result.message });
      router.push("/dashboard/writer/blogs");
    } catch {
      toast({
        title: "Error",
        description: "Failed to submit post",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveAndSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const savedId = await saveDraft();
      if (savedId == null) return;

      const result = await submitForReview(savedId);

      if (!result.success) {
        toast({
          title: "Saved as draft",
          description: `Couldn't submit automatically: ${result.error || "unknown error"}. You can submit it from the post's page.`,
          variant: "destructive",
        });
        router.push(`/dashboard/writer/blogs/${savedId}`);
        return;
      }

      toast({ title: "Submitted", description: result.message });
      router.push("/dashboard/writer/blogs");
    } catch {
      toast({
        title: "Error",
        description: "Failed to save and submit post",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (isReadOnly && initialData) {
    return (
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">{initialData.title}</h1>
          <Badge>{getPostStatusLabel(initialData.status)}</Badge>
        </div>
        {initialData.status === "pending_approval" && (
          <p className="text-muted-foreground">
            This post is awaiting admin review and can&apos;t be edited right now.
          </p>
        )}
        {initialData.status === "published" && (
          <div className="space-y-2">
            <p className="text-muted-foreground">This post is live.</p>
            <Button asChild variant="outline">
              <Link href={`/guides/${initialData.slug}`} target="_blank">
                View Live
              </Link>
            </Button>
          </div>
        )}
        <Card>
          <CardContent className="p-6 prose dark:prose-invert max-w-none">
            <div dangerouslySetInnerHTML={{ __html: renderMarkdown(initialData.content) }} />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">
          {mode === "create" ? "New Post" : "Edit Post"}
        </h1>
        {initialData?.status === "rejected" && initialData.review_notes && (
          <Badge variant="destructive">Needs Changes</Badge>
        )}
      </div>

      {initialData?.status === "rejected" && initialData.review_notes && (
        <Card className="border-destructive/50">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-destructive mb-1">
              Admin feedback
            </p>
            <p className="text-sm">{initialData.review_notes}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Post Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="A catchy, descriptive title"
            />
            {errors.title && <p className="text-sm text-destructive">{errors.title}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="excerpt">Excerpt (optional)</Label>
            <Textarea
              id="excerpt"
              value={excerpt ?? ""}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder="A short summary shown in listings"
              rows={2}
              maxLength={300}
            />
          </div>

          <div className="space-y-2">
            <Label>Featured Image (optional)</Label>
            <FeaturedImageUpload
              imageUrl={featuredImageUrl}
              onUploaded={(temp, url) => {
                setTempFileName(temp);
                setFeaturedImageUrl(url);
              }}
              onRemove={() => {
                setTempFileName(null);
                setFeaturedImageUrl(null);
              }}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="content">Content (Markdown)</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowPreview((v) => !v)}
              >
                {showPreview ? (
                  <>
                    <EyeOff className="h-4 w-4 mr-1.5" /> Edit
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4 mr-1.5" /> Preview
                  </>
                )}
              </Button>
            </div>
            {showPreview ? (
              <Card>
                <CardContent className="p-4 prose dark:prose-invert max-w-none min-h-[200px]">
                  <div dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }} />
                </CardContent>
              </Card>
            ) : (
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your guide using Markdown - headings, **bold**, [links](url), etc."
                rows={16}
                className="font-mono text-sm"
              />
            )}
            {errors.content && (
              <p className="text-sm text-destructive">{errors.content}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Categories</Label>
            <BlogCategoryPicker
              selectedIds={categoryIds}
              primaryId={primaryCategoryId}
              onChange={(ids, primary) => {
                setCategoryIds(ids);
                setPrimaryCategoryId(primary);
              }}
            />
            {errors.category_ids && (
              <p className="text-sm text-destructive">{errors.category_ids}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button
          onClick={handleSave}
          disabled={saving || submitting}
          className="bg-black text-white hover:bg-black/80 dark:bg-white dark:text-black dark:hover:bg-white/80"
        >
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {mode === "create" ? "Save Draft" : "Save Changes"}
        </Button>
        <Button
          variant="destructive"
          onClick={mode === "create" ? handleSaveAndSubmit : handleSubmitForReview}
          disabled={submitting || saving}
        >
          {submitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          {mode === "create" ? "Save & Submit for Review" : "Submit for Review"}
        </Button>
      </div>
    </div>
  );
}
