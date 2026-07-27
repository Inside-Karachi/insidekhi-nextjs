import { NextRequest, NextResponse } from "next/server";
import { getAdminAuthErrorStatus, requireAdmin } from "@/lib/auth/admin";
import { query } from "@/lib/db";

type OverrideBody = { pinned?: boolean; hidden?: boolean };

function validateBody(
  body: unknown,
): { ok: true; value: OverrideBody } | { ok: false; error: string } {
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
 * PATCH /api/admin/listings/[id]/hidden-gem-override
 *
 * `pinned: true` forces a published listing into the Hidden Gems feed;
 * `hidden: true` removes it. Hidden takes precedence on reads if both flags
 * are true. Pin timestamps keep multiple curated items newest-pinned-first.
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

    const setClauses: string[] = [];
    const values: unknown[] = [];
    if (validated.value.pinned !== undefined) {
      values.push(validated.value.pinned);
      setClauses.push(`hidden_gem_pinned = $${values.length}`);
      values.push(
        validated.value.pinned ? new Date().toISOString() : null,
      );
      setClauses.push(`hidden_gem_pinned_at = $${values.length}`);
    }
    if (validated.value.hidden !== undefined) {
      values.push(validated.value.hidden);
      setClauses.push(`hidden_gem_hidden = $${values.length}`);
    }

    values.push(listingId);
    const { rows } = await query(
      `UPDATE listings
       SET ${setClauses.join(", ")}, updated_at = NOW()
       WHERE id = $${values.length}
       RETURNING id, name, slug, hidden_gem_pinned, hidden_gem_hidden,
                 hidden_gem_pinned_at`,
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

    console.error("Error updating listing hidden-gem override:", error);
    return NextResponse.json(
      { error: "Failed to update hidden-gem override" },
      { status: 500 },
    );
  }
}
