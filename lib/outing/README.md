/**
 * Activity / outing answer contracts.
 *
 * Spec: hangout / date / bowling / budget prompts must never collapse into a
 * dinner → dessert night-out arc. Golden fixtures in
 * `lib/outing/eval/golden-prompts.ts` (~100 prompts; 7 core merge blockers) +
 * `npm run outing:eval` (CI: `.github/workflows/outing-eval.yml`) enforce this.
 *
 * ## Modes
 *
 * - **places** — ranked matching listings (hangout, date, bowling, food-first)
 * - **arc** — optional 2–3 stop itinerary only for broad “plan my night out”
 *
 * ## Data backfill (ops)
 *
 * Budget filters only bite when `listings.min_price_per_person` /
 * `max_price_per_person` and guest capacity columns are filled. Prioritize
 * admin capacity entry for:
 * 1. fine-dining-buffets + romantic cafes (date night)
 * 2. entertainment-recreation + gaming-lounges-arcades (hangout / bowling)
 *
 * The Admin → Listing capacity page has shortcuts for those incomplete rows.
 * Until coverage improves, the planner soft-prefers priced in-budget rows and
 * surfaces `budgetNote` when most results lack prices.
 */

export { extractOutingIntent } from "@/lib/outing/intent";
export { GOLDEN_PROMPTS, coreGoldenPrompts } from "@/lib/outing/eval/golden-prompts";
