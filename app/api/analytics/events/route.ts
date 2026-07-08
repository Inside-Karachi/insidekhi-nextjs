import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { createServerSupabase } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";
import {
  analyticsEventRequestSchema,
  type AnalyticsEventInput,
  type AnalyticsUserRole,
} from "@/types/analytics";

const CONTEXT_BYTES_LIMIT = 8_192; // 8 KB per event context to avoid oversized payloads
const textEncoder = new TextEncoder();

type AnalyticsEventInsert =
  Database["public"]["Tables"]["analytics_events"]["Insert"];

type ParsedRequest =
  | ({ events: AnalyticsEventInput[] } & { isBatch: true })
  | ({ events: [AnalyticsEventInput] } & { isBatch: false });

const parseRequest = (payload: unknown): ParsedRequest => {
  const result = analyticsEventRequestSchema.parse(payload);

  if ("events" in result) {
    return { events: result.events, isBatch: true };
  }

  return { events: [result], isBatch: false };
};

const ensureActorRole = async (
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  actorId: string | null
): Promise<AnalyticsUserRole | null> => {
  if (!actorId) {
    return null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", actorId)
    .maybeSingle();

  if (error) {
    console.warn("Failed to resolve actor role", error);
    return null;
  }

  return (data?.role as AnalyticsUserRole) ?? null;
};

const sanitizeContext = (
  value: AnalyticsEventInput["context"]
): AnalyticsEventInput["context"] => {
  try {
    return JSON.parse(JSON.stringify(value ?? {}));
  } catch (error) {
    console.warn("Invalid context payload provided", error);
    return {};
  }
};

const normalizeEvents = async (
  request: NextRequest,
  events: AnalyticsEventInput[],
  authenticatedActorId: string | null,
  authenticatedRole: AnalyticsUserRole | null
): Promise<AnalyticsEventInsert[] | { error: NextResponse }> => {
  const ipAddress = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  const userAgent = request.headers.get("user-agent") ?? undefined;

  const normalizedEvents: AnalyticsEventInsert[] = [];

  for (const event of events) {
    const occurredAt = event.occurredAt ?? new Date();
    const eventActorId = event.actorId ?? authenticatedActorId;
    const eventActorRole = event.actorRole ?? authenticatedRole;
    const context = sanitizeContext(event.context);
    const contextSizeBytes = textEncoder.encode(
      JSON.stringify(context)
    ).byteLength;

    if (contextSizeBytes > CONTEXT_BYTES_LIMIT) {
      return {
        error: NextResponse.json(
          {
            error: "Context payload too large",
            limitBytes: CONTEXT_BYTES_LIMIT,
            actualBytes: contextSizeBytes,
          },
          { status: 413 }
        ),
      };
    }

    const mergedContext = (() => {
      if (
        !ipAddress &&
        !userAgent &&
        (typeof context !== "object" ||
          context === null ||
          Array.isArray(context))
      ) {
        return context;
      }

      const baseContext =
        typeof context === "object" &&
        context !== null &&
        !Array.isArray(context)
          ? { ...context }
          : {};

      const requestMeta: Record<string, string> = {};

      if (ipAddress) {
        requestMeta.ipAddress = ipAddress;
      }

      if (userAgent) {
        requestMeta.userAgent = userAgent;
      }

      if (Object.keys(requestMeta).length === 0) {
        return baseContext;
      }

      const existingRequestMeta =
        typeof baseContext.request === "object" &&
        baseContext.request !== null &&
        !Array.isArray(baseContext.request)
          ? (baseContext.request as Record<string, string>)
          : undefined;

      return {
        ...baseContext,
        request: {
          ...existingRequestMeta,
          ...requestMeta,
        },
      };
    })();

    const ingestedAt = new Date().toISOString();

    normalizedEvents.push({
      event_type: event.eventType,
      source: event.source,
      occurred_at: occurredAt.toISOString(),
      ingested_at: ingestedAt,
      entity_type: event.entityType ?? null,
      entity_id: event.entityId ?? null,
      session_id: event.sessionId ?? null,
      actor_id: eventActorId ?? null,
      actor_role: eventActorRole ?? null,
      context: mergedContext,
    });
  }

  return normalizedEvents;
};

export async function POST(request: NextRequest) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch (_error) {
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400 }
    );
  }

  let parsed: ParsedRequest;

  try {
    parsed = parseRequest(payload);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Invalid analytics event payload",
          details: error.flatten(),
        },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      return NextResponse.json(
        {
          error: "Invalid analytics event payload",
          details: error.message,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Invalid analytics event payload" },
      { status: 400 }
    );
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const authenticatedActorId = user?.id ?? null;
  const authenticatedRole = await ensureActorRole(
    supabase,
    authenticatedActorId
  );

  const normalized = await normalizeEvents(
    request,
    parsed.events,
    authenticatedActorId,
    authenticatedRole
  );

  if (!Array.isArray(normalized)) {
    return normalized.error;
  }

  try {
    const adminSupabase = await createServerSupabase({ useServiceRole: true });
    const { error } = await adminSupabase
      .from("analytics_events")
      .insert(normalized);

    if (error) {
      console.error("Failed to insert analytics event(s)", error);
      return NextResponse.json(
        { error: "Failed to record analytics event" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        inserted: normalized.length,
        batch: parsed.isBatch,
      },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Unexpected analytics ingestion error", error);
    return NextResponse.json(
      { error: "Failed to record analytics event" },
      { status: 500 }
    );
  }
}
