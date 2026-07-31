"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, FolderOpen, Loader2 } from "lucide-react";

interface Category {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  is_enabled: boolean;
  display_order: number;
}

export function BlogCategoriesPage() {
  const { toast } = useToast();
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [formOpen, setFormOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const [deleteTarget, setDeleteTarget] = React.useState<Category | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const fetchCategories = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/blog-categories");
      const result = await response.json();
      if (result.success) {
        setCategories(result.data);
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to load categories",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleCreate = async () => {
    if (!name || name.length < 2) {
      toast({
        title: "Name required",
        description: "Enter a category name (2+ characters)",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/admin/blog-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: description || null }),
      });
      const result = await response.json();

      if (!result.success) {
        toast({
          title: "Error",
          description: result.error || "Failed to create category",
          variant: "destructive",
        });
        return;
      }

      toast({ title: "Category created" });
      setFormOpen(false);
      setName("");
      setDescription("");
      fetchCategories();
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEnabled = async (category: Category) => {
    const response = await fetch(`/api/admin/blog-categories/${category.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_enabled: !category.is_enabled }),
    });
    const result = await response.json();

    if (!result.success) {
      toast({
        title: "Error",
        description: result.error || "Failed to update category",
        variant: "destructive",
      });
      return;
    }

    setCategories((prev) =>
      prev.map((c) => (c.id === category.id ? { ...c, is_enabled: !c.is_enabled } : c)),
    );
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/admin/blog-categories/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const result = await response.json();

      if (!result.success) {
        toast({
          title: "Error",
          description: result.error || "Failed to delete category",
          variant: "destructive",
        });
        return;
      }

      toast({ title: "Category deleted" });
      setDeleteTarget(null);
      fetchCategories();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Blog Categories</h1>
          <p className="text-muted-foreground">
            Manage the categories writers can tag their guides with.
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Category
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4 h-16" />
            </Card>
          ))}
        </div>
      ) : categories.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No categories yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {categories.map((category) => (
            <motion.div key={category.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card>
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium">{category.name}</p>
                    {category.description && (
                      <p className="text-sm text-muted-foreground">
                        {category.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={category.is_enabled}
                        onCheckedChange={() => handleToggleEnabled(category)}
                      />
                      <span className="text-sm text-muted-foreground">
                        {category.is_enabled ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteTarget(category)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="category-name">Name</Label>
              <Input
                id="category-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Food & Dining"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category-description">Description (optional)</Label>
              <Textarea
                id="category-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete category?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{deleteTarget?.name}&quot;. Categories
              that still have posts assigned to them can&apos;t be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
