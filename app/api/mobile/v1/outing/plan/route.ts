import { type NextRequest } from "next/server";
import { z } from "zod";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { buildAlgorithmOutingPlan } from "@/lib/outing/algorithm-plan";
import { buildAiOutingPlan } from "@/lib/outing/ai-plan";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  prompt: z.string().min(1).max(500),
  mode: z.enum(["algorithm", "ai"]),
});

/**
 * POST /api/mobile/v1/outing/plan
 *
 * Showcase endpoint: free-text prompt → outing stops from the listings DB.
 * - mode=algorithm: keyword rules + category/area fetch + rating rank (no LLM)
 * - mode=ai: same candidate pool → Groq picks places and writes reasons
 *
 * Public (optional auth). AI never invents listing ids.
 */
export const POST = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    throw new MobileApiError(
      "validation_error",
      "Provide a prompt (1–500 chars) and mode (algorithm|ai).",
      400,
    );
  }

  const prompt = parsed.data.prompt.trim();
  if (!prompt) {
    throw new MobileApiError(
      "validation_error",
      "Prompt is required.",
      400,
      "prompt",
    );
  }

  const plan =
    parsed.data.mode === "ai"
      ? await buildAiOutingPlan(prompt)
      : await buildAlgorithmOutingPlan(prompt);

  return ok(plan);
});
