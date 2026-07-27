import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getAdminAuthErrorStatus, requireAdmin } from "@/lib/auth/admin";

type OverrideBody = {
  pinned?: boolean;
  hidden?: boolean;
};

function validateBody(body: unknown): { ok: true; value: OverrideBody } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Invalid JSON body" };
  }
  const { pinned, hidden } = body as Record<string, unknown>;

  if (pinned !== undefined && typeof pinned !== "boolean") {
    return { ok: false, error: "pinned must be a boolean" };
  }
  if (hidden !== undefined && typeof hidden !== "boolean") {
    return { ok: false, error: "hidden must be a boolean" };
  }
  if (pinned === undefined && hidden === undefined) {
    return { ok: false, error: "Provide pinned and/or hidden" };
  }

  return { ok: true, value: { pinned, hidden } };
}

/**
 * PATCH /api/admin/listings/[id]/top-rated-override
 *
 * Admin override for the "Top Rated by Insiders" feed
 * (GET /api/mobile/v1/listings/top-rated). `pinned: true` forces the listing
 * to the top of that feed regardless of its computed insider rating;
 * `hidden: true` forces it out entirely. If both end up true, the read query
 * treats hidden as taking precedence - this endpoint still lets you set both
 * (no mutual-exclusion enforced here), so an admin UI built on top of this
 * should prevent that combination rather than relying on the read-side
 * tiebreak. `top_rated_pinned_at` is stamped to `now()` when `pinned`
 * transitions to `true`, and cleared when it transitions to `false`, so
 * multiple pinned listings order most-recently-pinned-first.
 *
 * These columns are independent of the trending_* override columns, so a
 * listing can be curated separately in the Trending and Top-Rated feeds.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin(request);

    const { id: idParam } = await params;
    const listingId = parseInt(idParam, 10);
    if (Number.isNaN(listingId)) {
      return NextResponse.json({ error: "Invalid listing id" }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const validated = validateBody(body);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }
    const { pinned, hidden } = validated.value;

    const setClauses: string[] = [];
    const values: unknown[] = [];

    if (pinned !== undefined) {
      values.push(pinned);
      setClauses.push(`top_rated_pinned = $${values.length}`);
      values.push(pinned ? new Date().toISOString() : null);
      setClauses.push(`top_rated_pinned_at = $${values.length}`);
    }
    if (hidden !== undefined) {
      values.push(hidden);
      setClauses.push(`top_rated_hidden = $${values.length}`);
    }

    values.push(listingId);

    const { rows } = await query(
      `UPDATE listings
       SET ${setClauses.join(", ")}, updated_at = NOW()
       WHERE id = $${values.length}
       RETURNING id, name, slug, top_rated_pinned, top_rated_hidden, top_rated_pinned_at`,
      values,
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: rows[0] });
  } catch (error) {
    const status = getAdminAuthErrorStatus(error);
    if (status) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Unauthorized" },
        { status },
      );
    }

    console.error("Error updating listing top-rated override:", error);
    return NextResponse.json(
      { error: "Failed to update top-rated override" },
      { status: 500 },
    );
  }
}
