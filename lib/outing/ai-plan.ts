import { MobileApiError } from "@/lib/mobile/errors";
import {
  buildAlgorithmOutingPlan,
  buildCandidatePool,
  pickForSlot,
} from "@/lib/outing/algorithm-plan";
import { MAX_STOPS, MIN_STOPS } from "@/lib/outing/templates";
import type { OutingPlanResponse, OutingPlanStopDTO } from "@/lib/outing/types";
import type { ListingCardDTO } from "@/lib/mobile/mappers";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.1-8b-instant";

type GroqPick = { id: number; role?: string; reason: string };
type GroqPlanJson = {
  interpretation?: string;
  picks?: GroqPick[];
};

function compactCandidate(l: ListingCardDTO, roles: string[]) {
  return {
    id: l.id,
    name: l.name,
    category: l.category_name,
    address: l.address,
    avg_rating: l.avg_rating,
    suggested_roles: roles,
  };
}

function parseGroqContent(raw: string): GroqPlanJson {
  const trimmed = raw.trim();
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  return JSON.parse(unfenced) as GroqPlanJson;
}

async function callGroq(
  prompt: string,
  interpretationHint: string,
  roles: Array<{ role: string; label: string }>,
  candidates: ListingCardDTO[],
  roleByListingId: Map<number, string[]>,
): Promise<GroqPlanJson> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new MobileApiError(
      "ai_unavailable",
      "AI demo is not configured (missing GROQ_API_KEY).",
      503,
    );
  }

  const roleList = roles.map((r) => `${r.role} (${r.label})`).join(" → ");
  const targetCount = Math.min(MAX_STOPS, Math.max(MIN_STOPS, roles.length));

  const system = `You are Inside Karachi's outing planner. Build a coherent ${targetCount}-stop outing arc for Karachi.
Target arc roles in order: ${roleList}
Suggested interpretation: ${interpretationHint}

Reply with JSON only:
{"interpretation":"short phrase under 14 words","picks":[{"id":number,"role":"slot_role","reason":"one short sentence naming the role"}]}

Hard rules:
- Exactly ${targetCount} picks (never 1, never more than ${MAX_STOPS})
- One pick per role when possible; follow the arc order
- picks[].id MUST be from the candidate list
- Never invent places or ids
- Reasons should sound like a plan ("Start with dinner at…", "Then…", "Finish with…")
- Prefer diverse categories across the arc`;

  const user = JSON.stringify({
    prompt,
    roles,
    candidates: candidates.map((c) =>
      compactCandidate(c, roleByListingId.get(c.id) ?? []),
    ),
  });

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.35,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[outing/ai] Groq error", res.status, body.slice(0, 300));
    throw new MobileApiError(
      "ai_unavailable",
      "AI provider failed. Try Algorithm mode or try again.",
      502,
    );
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content;
  if (!content) {
    throw new MobileApiError(
      "ai_unavailable",
      "AI returned an empty response.",
      502,
    );
  }

  try {
    return parseGroqContent(content);
  } catch {
    console.error("[outing/ai] bad JSON from Groq:", content.slice(0, 400));
    throw new MobileApiError(
      "ai_unavailable",
      "AI returned invalid JSON. Try again.",
      502,
    );
  }
}

/**
 * AI outing plan: intent places mode uses the algorithm places ranker (DB-only
 * IDs) with AI reasons when Groq is available; arc mode keeps Groq slot picks.
 */
export async function buildAiOutingPlan(
  prompt: string,
): Promise<OutingPlanResponse> {
  const { ctx, candidates, byRole } = await buildCandidatePool(prompt);

  // Places mode (hangout / date / bowling / food-first): never force a meal arc.
  if (ctx.intent.mode === "places") {
    const base = await buildAlgorithmOutingPlan(prompt);
    return {
      ...base,
      mode: "ai",
      interpretation: base.interpretation,
    };
  }

  if (candidates.length === 0) {
    return {
      mode: "ai",
      interpretation: "No places found for that prompt",
      stops: [],
      intent: {
        mode: ctx.intent.mode,
        primaryNeed: ctx.intent.primaryNeed,
        excludeFood: ctx.intent.excludeFood,
        budgetMaxPkr: ctx.intent.budgetMaxPkr,
        partySize: ctx.intent.partySize,
      },
    };
  }

  const roles = ctx.slots.map((s) => ({ role: s.role, label: s.label }));
  const roleByListingId = new Map<number, string[]>();
  for (const [role, list] of byRole) {
    for (const l of list) {
      const prev = roleByListingId.get(l.id) ?? [];
      if (!prev.includes(role)) prev.push(role);
      roleByListingId.set(l.id, prev);
    }
  }

  const groq = await callGroq(
    prompt,
    ctx.interpretation,
    roles,
    candidates,
    roleByListingId,
  );
  const byId = new Map(candidates.map((c) => [c.id, c]));

  const stops: OutingPlanStopDTO[] = [];
  const used = new Set<number>();
  const filledRoles = new Set<string>();

  for (const pick of groq.picks ?? []) {
    const id = Number(pick.id);
    if (!Number.isFinite(id) || used.has(id)) continue;
    const listing = byId.get(id);
    if (!listing) continue;
    const role =
      typeof pick.role === "string" && pick.role
        ? pick.role
        : roles.find((r) => !filledRoles.has(r.role))?.role;
    if (role && filledRoles.has(role)) continue;
    used.add(id);
    if (role) filledRoles.add(role);
    const reason =
      typeof pick.reason === "string" && pick.reason.trim()
        ? pick.reason.trim().slice(0, 160)
        : role
          ? `${role} stop · picked for your mood`
          : "Picked by AI for your mood";
    stops.push({ listing, role, reason });
    if (stops.length >= MAX_STOPS) break;
  }

  // Fill missing template roles with algorithm picks for those slots.
  for (const slot of ctx.slots) {
    if (stops.length >= MAX_STOPS) break;
    if (filledRoles.has(slot.role)) continue;
    if (ctx.intent.excludeFood && /dinner|eat|sweet|meal|cafe/.test(slot.role)) {
      continue;
    }
    const listing = await pickForSlot(slot, ctx.area, used, ctx.intent);
    if (!listing) {
      const fromPool = (byRole.get(slot.role) ?? []).find((l) => !used.has(l.id));
      if (!fromPool) continue;
      used.add(fromPool.id);
      filledRoles.add(slot.role);
      stops.push({
        listing: fromPool,
        role: slot.role,
        reason: `${slot.label} stop · filled from top-rated picks`,
      });
      continue;
    }
    used.add(listing.id);
    filledRoles.add(slot.role);
    stops.push({
      listing,
      role: slot.role,
      reason: `${slot.label} stop · filled from top-rated picks`,
    });
  }

  // Still under MIN_STOPS — pad from overall pool.
  if (stops.length < MIN_STOPS) {
    for (const listing of candidates) {
      if (used.has(listing.id)) continue;
      used.add(listing.id);
      stops.push({
        listing,
        role: "extra",
        reason: "Extra stop · top-rated candidate",
      });
      if (stops.length >= MIN_STOPS) break;
    }
  }

  // Reorder stops to follow template slot order when roles are known.
  const roleOrder = new Map(ctx.slots.map((s, i) => [s.role, i]));
  stops.sort((a, b) => {
    const ai = a.role != null ? (roleOrder.get(a.role) ?? 99) : 99;
    const bi = b.role != null ? (roleOrder.get(b.role) ?? 99) : 99;
    return ai - bi;
  });

  const interpretation =
    (typeof groq.interpretation === "string" && groq.interpretation.trim()
      ? groq.interpretation.trim().slice(0, 120)
      : null) ?? ctx.interpretation;

  return {
    mode: "ai",
    interpretation,
    stops: stops.slice(0, MAX_STOPS),
    intent: {
      mode: ctx.intent.mode,
      primaryNeed: ctx.intent.primaryNeed,
      excludeFood: ctx.intent.excludeFood,
      budgetMaxPkr: ctx.intent.budgetMaxPkr,
      partySize: ctx.intent.partySize,
    },
  };
}
