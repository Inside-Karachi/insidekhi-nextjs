/**
 * CATEGORY MAPPER
 * Maps Peekaboo tags to Inside Karachi category IDs
 */

import { query } from "@/lib/db";
import type { CategoryMapperResult } from "@/types/peekaboo-scraper.types";

interface Category {
  id: number;
  name: string;
  slug: string;
}

export class CategoryMapper {
  private categories: Category[] = [];
  private tagToCategoryMap = new Map<string, number>();

  /**
   * Load all categories from database
   */
  async loadCategories(): Promise<void> {
    try {
      const { rows } = await query(
        `SELECT id, name, slug FROM categories WHERE is_enabled = true`,
      );
      this.categories = (rows || []) as Category[];
      console.log(`[CATEGORY] Loaded ${this.categories.length} categories`);
    } catch (error) {
      console.error("[CATEGORY] Failed to load categories:", error);
      return;
    }
  }

  /**
   * Find category by exact name match
   */
  private findByExactMatch(tag: string): number | null {
    if (typeof tag !== "string") return null;
    const normalized = tag.toLowerCase().trim();

    const match = this.categories.find(
      (cat) => cat.name.toLowerCase() === normalized || cat.slug === normalized
    );

    return match?.id || null;
  }

  /**
   * Find category by partial match
   */
  private findByPartialMatch(tag: string): number | null {
    if (typeof tag !== "string") return null;
    const normalized = tag.toLowerCase().trim();

    const match = this.categories.find(
      (cat) =>
        cat.name.toLowerCase().includes(normalized) ||
        normalized.includes(cat.name.toLowerCase())
    );

    return match?.id || null;
  }

  /**
   * Map Peekaboo tags to Inside Karachi category
   * Returns first matching category with confidence level
   */
  mapTags(tags: string[]): CategoryMapperResult {
    if (!tags || tags.length === 0) {
      return {
        categoryId: null,
        mappedTags: [],
        unmappedTags: [],
        confidence: "none",
      };
    }

    const mappedTags: string[] = [];
    const unmappedTags: string[] = [];
    let categoryId: number | null = null;
    let confidence: "high" | "medium" | "low" | "none" = "none";

    // Try exact match first (high confidence)
    for (const tag of tags) {
      const exactMatch = this.findByExactMatch(tag);

      if (exactMatch) {
        categoryId = exactMatch;
        mappedTags.push(tag);
        confidence = "high";
        break; // Use first exact match
      }
    }

    // If no exact match, try partial match (medium confidence)
    if (!categoryId) {
      for (const tag of tags) {
        const partialMatch = this.findByPartialMatch(tag);

        if (partialMatch) {
          categoryId = partialMatch;
          mappedTags.push(tag);
          confidence = "medium";
          break;
        }
      }
    }

    // Categorize remaining tags as unmapped
    for (const tag of tags) {
      if (!mappedTags.includes(tag)) {
        unmappedTags.push(tag);
      }
    }

    if (unmappedTags.length > 0 && !categoryId) {
      confidence = "low";
    }

    return {
      categoryId,
      mappedTags,
      unmappedTags,
      confidence,
    };
  }

  /**
   * Get fallback/default category ID (e.g., "Uncategorized")
   */
  async getDefaultCategory(): Promise<number | null> {
    const { rows } = await query(
      `SELECT id FROM categories WHERE slug = $1 AND is_enabled = true LIMIT 1`,
      ["uncategorized"],
    );

    return (rows[0]?.id as number) || null;
  }

  /**
   * Get categories list for reference
   */
  getCategories(): Category[] {
    return this.categories;
  }
}

/**
 * Singleton instance
 */
export const categoryMapper = new CategoryMapper();
