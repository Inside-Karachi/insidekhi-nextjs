-- Classification confidence for listing ↔ category links (from Ollama CSV scores).

ALTER TABLE public.listing_categories
  ADD COLUMN IF NOT EXISTS relevance_score numeric(4, 2) DEFAULT 1.00;

COMMENT ON COLUMN public.listing_categories.relevance_score IS
  'Similarity/confidence for this listing–category link (0–1). Primary from primary_relevance_score; secondaries from all_pair_scores_json.';
