import type { ListingCardDTO } from "@/lib/mobile/mappers";
import type { OutingSlot, OutingTemplate } from "@/lib/outing/templates";

export type OutingPlanMode = "algorithm" | "ai";

export type OutingPlanStopDTO = {
  listing: ListingCardDTO;
  reason: string;
  /** Template role this stop filled (dinner, enjoy, sweet, …). */
  role?: string;
};

export type OutingPlanResponse = {
  mode: OutingPlanMode;
  /** What the engine understood from the prompt (shown in the demo UI). */
  interpretation: string;
  stops: OutingPlanStopDTO[];
};

/** Resolved vibe + slots after template matching. */
export type MatchedPlanContext = {
  normalized: string;
  area: string | null;
  template: OutingTemplate;
  interpretation: string;
  slots: OutingSlot[];
};
