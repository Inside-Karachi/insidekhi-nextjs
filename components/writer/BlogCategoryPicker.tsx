"use client";

import * as React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { BlogCategory } from "@/types/blogs.types";

interface BlogCategoryPickerProps {
  selectedIds: number[];
  primaryId: number | null;
  onChange: (selectedIds: number[], primaryId: number | null) => void;
  disabled?: boolean;
}

export function BlogCategoryPicker({
  selectedIds,
  primaryId,
  onChange,
  disabled,
}: BlogCategoryPickerProps) {
  const [categories, setCategories] = React.useState<BlogCategory[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch("/api/blog-categories")
      .then((res) => res.json())
      .then((result) => {
        if (result.success) setCategories(result.data);
      })
      .finally(() => setLoading(false));
  }, []);

  const toggle = (id: number) => {
    if (disabled) return;
    if (selectedIds.includes(id)) {
      const next = selectedIds.filter((c) => c !== id);
      onChange(next, primaryId === id ? next[0] ?? null : primaryId);
    } else {
      const next = [...selectedIds, id];
      onChange(next, primaryId ?? id);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading categories...</p>;
  }

  if (categories.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No categories available yet. Ask an admin to add some.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {categories.map((category) => (
          <label
            key={category.id}
            className="flex items-center gap-2 p-2 rounded-lg border border-border/50 cursor-pointer hover:bg-accent/50"
          >
            <Checkbox
              checked={selectedIds.includes(category.id)}
              onCheckedChange={() => toggle(category.id)}
              disabled={disabled}
            />
            <span className="text-sm">{category.name}</span>
          </label>
        ))}
      </div>

      {selectedIds.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            Primary category (shown first):
          </p>
          <div className="flex flex-wrap gap-2">
            {selectedIds.map((id) => {
              const category = categories.find((c) => c.id === id);
              if (!category) return null;
              return (
                <Button
                  key={id}
                  type="button"
                  size="sm"
                  variant={primaryId === id ? "default" : "outline"}
                  disabled={disabled}
                  onClick={() => onChange(selectedIds, id)}
                >
                  {primaryId === id && <Badge className="mr-1 h-4 px-1">★</Badge>}
                  {category.name}
                </Button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
