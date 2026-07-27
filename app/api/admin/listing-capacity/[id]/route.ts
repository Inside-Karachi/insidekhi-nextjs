import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import {
  getAdminAuthErrorStatus,
  requireListingCapacityAccess,
} from "@/lib/auth/admin";
import type { ListingCapacityFields } from "@/types/listing.types";

type CapacityFieldKey = keyof ListingCapacityFields;

const ALLOWED_FIELDS: Array<CapacityFieldKey | "category_id"> = [
  "min_price_per_person",
  "max_price_per_person",
  "min_guest_capacity",
  "max_guest_capacity",
  "category_id",
];

function parseNullableNumber(
  value: unknown,
  field: string,
  opts: { integer?: boolean; min?: number } = {},
): number | null | { error: string } {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) {
    return { error: `${field} must be a valid number` };
  }
  if (opts.integer && !Number.isInteger(num)) {
    return { error: `${field} must be a whole number` };
  }
  if (opts.min !== undefined && num < opts.min) {
    return { error: `${field} must be at least ${opts.min}` };
  }
  return num;
}

function validateCapacityPayload(body: Record<string, unknown>):
  | { ok: true; updates: Partial<ListingCapacityFields & { category_id: number | null; category_ids?: number[] }> }
  | { ok: false; error: string } {
  const updates: Partial<ListingCapacityFields & { category_id: number | null; category_ids?: number[] }> = {};

  if ("category_ids" in body && Array.isArray(body.category_ids)) {
    const ids = body.category_ids
      .map((x) => Number(x))
      .filter((num) => Number.isInteger(num) && num > 0);
    const uniqueIds = Array.from(new Set(ids));
    updates.category_ids = uniqueIds;
    updates.category_id = uniqueIds.length > 0 ? uniqueIds[0] : null;
  }

  for (const field of ALLOWED_FIELDS) {
    if (!(field in body)) continue;

    if (field === "category_id") {
      if (!("category_ids" in body)) {
        const val = body[field];
        if (val === null || val === undefined || val === "") {
          updates.category_id = null;
          updates.category_ids = [];
        } else {
          const num = Number(val);
          if (!Number.isFinite(num) || !Number.isInteger(num) || num < 1) {
            return { ok: false, error: "category_id must be a positive integer" };
          }
          updates.category_id = num;
          updates.category_ids = [num];
        }
      }
      continue;
    }

    const isPrice = field.includes("price");
    const parsed = parseNullableNumber(body[field], field, {
      integer: !isPrice,
      min: isPrice ? 0 : 1,
    });

    if (parsed && typeof parsed === "object" && "error" in parsed) {
      return { ok: false, error: parsed.error };
    }

    updates[field] = parsed as number | null;
  }

  if (Object.keys(updates).length === 0) {
    return {
      ok: false,
      error: "Provide at least one field to update",
    };
  }

  return { ok: true, updates };
}

function validateMinMaxOrder(
  current: ListingCapacityFields,
  updates: Partial<ListingCapacityFields>,
): string | null {
  const minPrice =
    updates.min_price_per_person !== undefined
      ? updates.min_price_per_person
      : current.min_price_per_person;
  const maxPrice =
    updates.max_price_per_person !== undefined
      ? updates.max_price_per_person
      : current.max_price_per_person;
  const minCapacity =
    updates.min_guest_capacity !== undefined
      ? updates.min_guest_capacity
      : current.min_guest_capacity;
  const maxCapacity =
    updates.max_guest_capacity !== undefined
      ? updates.max_guest_capacity
      : current.max_guest_capacity;

  if (
    minPrice !== null &&
    maxPrice !== null &&
    minPrice > maxPrice
  ) {
    return "Minimum price per person cannot exceed maximum price per person";
  }

  if (
    minCapacity !== null &&
    maxCapacity !== null &&
    minCapacity > maxCapacity
  ) {
    return "Minimum guest capacity cannot exceed maximum guest capacity";
  }

  return null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireListingCapacityAccess(request);

    const { id: idParam } = await params;
    const listingId = parseInt(idParam, 10);
    if (Number.isNaN(listingId)) {
      return NextResponse.json({ error: "Invalid listing id" }, { status: 400 });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const validated = validateCapacityPayload(body);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const { rows: existingRows } = await query(
      `SELECT
         id,
         min_price_per_person,
         max_price_per_person,
         min_guest_capacity,
         max_guest_capacity
       FROM listings
       WHERE id = $1
       LIMIT 1`,
      [listingId],
    );

    if (existingRows.length === 0) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    const current = existingRows[0] as ListingCapacityFields & { id: number };
    const orderError = validateMinMaxOrder(current, validated.updates);
    if (orderError) {
      return NextResponse.json({ error: orderError }, { status: 400 });
    }

    const { category_ids, ...capacityAndCategoryUpdates } = validated.updates;

    const setClauses: string[] = [];
    const values: unknown[] = [];
    for (const [key, value] of Object.entries(capacityAndCategoryUpdates)) {
      values.push(value);
      setClauses.push(`${key} = $${values.length}`);
    }

    let updatedListing: Record<string, unknown> = current as unknown as Record<string, unknown>;

    if (setClauses.length > 0) {
      values.push(listingId);
      const { rows } = await query(
        `UPDATE listings
         SET ${setClauses.join(", ")}, updated_at = NOW()
         WHERE id = $${values.length}
         RETURNING
           id,
           name,
           slug,
           status,
           category_id,
           address,
           min_price_per_person,
           max_price_per_person,
           min_guest_capacity,
           max_guest_capacity`,
        values,
      );
      updatedListing = rows[0];
    }

    // Sync listing_categories join table if category_ids provided
    let finalCategoryIds: number[] = [];
    if (category_ids !== undefined) {
      await query(`DELETE FROM listing_categories WHERE listing_id = $1`, [listingId]);
      for (let i = 0; i < category_ids.length; i++) {
        const catId = category_ids[i];
        const isPrimary = i === 0;
        await query(
          `INSERT INTO listing_categories (listing_id, category_id, is_primary)
           VALUES ($1, $2, $3)
           ON CONFLICT (listing_id, category_id) DO UPDATE SET is_primary = EXCLUDED.is_primary`,
          [listingId, catId, isPrimary]
        );
      }
      finalCategoryIds = category_ids;
    } else {
      const { rows: lcRows } = await query(
        `SELECT category_id FROM listing_categories WHERE listing_id = $1`,
        [listingId]
      );
      finalCategoryIds = lcRows.map((r) => r.category_id as number);
    }

    let category_name: string | null = null;
    if (updatedListing.category_id != null) {
      const { rows: categoryRows } = await query(
        `SELECT name FROM categories WHERE id = $1 LIMIT 1`,
        [updatedListing.category_id],
      );
      category_name = categoryRows[0]?.name ?? null;
    }

    return NextResponse.json({
      listing: { ...updatedListing, category_ids: finalCategoryIds, category_name },
    });
  } catch (error) {
    const status = getAdminAuthErrorStatus(error);
    if (status) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Unauthorized" },
        { status },
      );
    }

    // Surface CHECK constraint violations as 400s
    const message = error instanceof Error ? error.message : "";
    if (
      message.includes("listings_price_per_person_order") ||
      message.includes("listings_guest_capacity_order") ||
      message.includes("listings_min_price_per_person_nonneg") ||
      message.includes("listings_max_price_per_person_nonneg") ||
      message.includes("listings_min_guest_capacity_positive") ||
      message.includes("listings_max_guest_capacity_positive")
    ) {
      return NextResponse.json(
        { error: "Invalid capacity values for this listing" },
        { status: 400 },
      );
    }

    console.error("Error updating listing capacity:", error);
    return NextResponse.json(
      { error: "Failed to update listing capacity" },
      { status: 500 },
    );
  }
}
