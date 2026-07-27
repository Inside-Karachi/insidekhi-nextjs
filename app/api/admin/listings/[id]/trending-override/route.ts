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
 * PATCH /api/admin/listings/[id]/trending-override
 *
 * Admin override for the "Trending Spots This Week" feed
 * (GET /api/mobile/v1/listings/trending). `pinned: true` forces the listing
 * to the top of that feed regardless of its computed score; `hidden: true`
 * forces it out entirely. If both end up true, the trending query treats
 * hidden as taking precedence - this endpoint still lets you set both (no
 * mutual-exclusion enforced here), so an admin UI built on top of this should
 * prevent that combination rather than relying on the read-side tiebreak.
 * `trending_pinned_at` is stamped to `now()` when `pinned` transitions to
 * `true`, and cleared when it transitions to `false`, so multiple pinned
 * listings order most-recently-pinned-first without extra UI.
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
      setClauses.push(`trending_pinned = $${values.length}`);
      values.push(pinned ? new Date().toISOString() : null);
      setClauses.push(`trending_pinned_at = $${values.length}`);
    }
    if (hidden !== undefined) {
      values.push(hidden);
      setClauses.push(`trending_hidden = $${values.length}`);
    }

    values.push(listingId);

    const { rows } = await query(
      `UPDATE listings
       SET ${setClauses.join(", ")}, updated_at = NOW()
       WHERE id = $${values.length}
       RETURNING id, name, slug, trending_pinned, trending_hidden, trending_pinned_at`,
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

    console.error("Error updating listing trending override:", error);
    return NextResponse.json(
      { error: "Failed to update trending override" },
      { status: 500 },
    );
  }
}
