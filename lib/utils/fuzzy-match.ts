/**
 * FUZZY MATCHING UTILITY
 * Matches scraped deals to database records using Fuse.js
 *
 * @module lib/utils/fuzzy-match
 * @created 2025-12-29
 */

import Fuse from "fuse.js";

// ========================================
// TYPES
// ========================================

export interface FuzzyMatchResult {
  id: number;
  name: string;
  confidence: number; // 0-100
  reason: string;
}

export interface ListingRecord {
  id: number;
  name: string;
  slug: string;
  address?: string | null;
}

export interface BankRecord {
  id: number;
  name: string;
  slug: string;
}

export interface CardVariantRecord {
  id: number;
  name: string;
  bank_id: number;
}

// ========================================
// CONFIDENCE THRESHOLDS
// ========================================

export const CONFIDENCE_LEVELS = {
  EXACT: 100,
  HIGH: 80,
  MEDIUM: 50,
  LOW: 0,
} as const;

export function getConfidenceLevel(
  score: number
): "exact" | "high" | "medium" | "low" {
  if (score >= CONFIDENCE_LEVELS.EXACT) return "exact";
  if (score >= CONFIDENCE_LEVELS.HIGH) return "high";
  if (score >= CONFIDENCE_LEVELS.MEDIUM) return "medium";
  return "low";
}

// ========================================
// LISTING FUZZY MATCHING
// ========================================

// Helper to normalize address for comparison
function normalizeAddress(addr: string): string {
  if (!addr) return "";
  return addr
    .toLowerCase()
    .replace(/[^\w\s]/g, "") // Remove punctuation
    .replace(/\s+/g, " ") // Collapse spaces
    .trim();
}

export function matchListing(
  scrapedMerchant: string,
  allListings: ListingRecord[],
  scrapedBranches?: Array<{
    address?: string;
    area?: string | null;
    city?: string;
  }>
): FuzzyMatchResult | null {
  if (!scrapedMerchant || allListings.length === 0) return null;

  // Try exact match first (case-insensitive)
  const exactMatch = allListings.find(
    (l) => l.name.toLowerCase() === scrapedMerchant.toLowerCase()
  );

  if (exactMatch) {
    // If we have branch data, verify address for extra confidence
    if (scrapedBranches && scrapedBranches.length > 0 && exactMatch.address) {
      const addressMatch = scrapedBranches.some((branch) => {
        const branchAddr = normalizeAddress(branch.address || "");
        const listingAddr = normalizeAddress(exactMatch.address || "");

        return (
          branchAddr &&
          listingAddr &&
          (branchAddr.includes(listingAddr) || listingAddr.includes(branchAddr))
        );
      });

      if (addressMatch) {
        return {
          id: exactMatch.id,
          name: exactMatch.name,
          confidence: 100,
          reason: "Exact name + address match",
        };
      }
    }

    return {
      id: exactMatch.id,
      name: exactMatch.name,
      confidence: 100,
      reason: "Exact name match",
    };
  }

  // Try slug match
  const slugMatch = allListings.find(
    (l) =>
      l.slug.toLowerCase() ===
      scrapedMerchant.toLowerCase().replace(/\s+/g, "-")
  );

  if (slugMatch) {
    return {
      id: slugMatch.id,
      name: slugMatch.name,
      confidence: 95,
      reason: "Exact slug match",
    };
  }

  // Fuzzy search
  const fuse = new Fuse(allListings, {
    keys: [
      { name: "name", weight: 0.7 },
      { name: "slug", weight: 0.2 },
      { name: "address", weight: 0.1 },
    ],
    threshold: 0.4, // 0 = perfect match, 1 = match anything
    includeScore: true,
  });

  const results = fuse.search(scrapedMerchant);

  if (results.length === 0) return null;

  const topMatch = results[0];
  let confidence = Math.round((1 - (topMatch.score || 0)) * 100);

  // Boost confidence if branch address matches
  if (scrapedBranches && scrapedBranches.length > 0 && topMatch.item.address) {
    const addressMatch = scrapedBranches.some((branch) => {
      const branchAddr = normalizeAddress(branch.address || "");
      const listingAddr = normalizeAddress(topMatch.item.address || "");

      // Check for partial address match
      return (
        branchAddr &&
        listingAddr &&
        (branchAddr.includes(listingAddr) || listingAddr.includes(branchAddr))
      );
    });

    if (addressMatch) {
      confidence = Math.min(100, confidence + 15); // Boost by 15 points
      return {
        id: topMatch.item.id,
        name: topMatch.item.name,
        confidence,
        reason: `Fuzzy name match + branch address verified (score: ${confidence}%)`,
      };
    }
  }

  // Only return if confidence is above minimum threshold
  if (confidence < CONFIDENCE_LEVELS.MEDIUM) return null;

  return {
    id: topMatch.item.id,
    name: topMatch.item.name,
    confidence,
    reason: `Fuzzy match (score: ${confidence}%)`,
  };
}

// ========================================
// BANK FUZZY MATCHING
// ========================================

export function matchBank(
  scrapedBank: string,
  allBanks: BankRecord[]
): FuzzyMatchResult | null {
  if (!scrapedBank || allBanks.length === 0) return null;

  // Normalize bank names (remove "Limited", "Bank", etc.)
  const normalize = (str: string) =>
    str
      .toLowerCase()
      .replace(/\b(bank|limited|ltd|pvt|pakistan)\b/gi, "")
      .trim()
      .replace(/\s+/g, " ");

  const normalizedScrapped = normalize(scrapedBank);

  // Try exact normalized match
  const exactMatch = allBanks.find(
    (b) => normalize(b.name) === normalizedScrapped
  );

  if (exactMatch) {
    return {
      id: exactMatch.id,
      name: exactMatch.name,
      confidence: 100,
      reason: "Exact normalized name match",
    };
  }

  // Try slug match
  const slugMatch = allBanks.find(
    (b) =>
      b.slug.toLowerCase() === scrapedBank.toLowerCase().replace(/\s+/g, "-")
  );

  if (slugMatch) {
    return {
      id: slugMatch.id,
      name: slugMatch.name,
      confidence: 98,
      reason: "Exact slug match",
    };
  }

  // Fuzzy search
  const fuse = new Fuse(allBanks, {
    keys: ["name", "slug"],
    threshold: 0.3,
    includeScore: true,
  });

  const results = fuse.search(scrapedBank);

  if (results.length === 0) return null;

  const topMatch = results[0];
  const confidence = Math.round((1 - (topMatch.score || 0)) * 100);

  if (confidence < CONFIDENCE_LEVELS.HIGH) return null; // Banks need higher confidence

  return {
    id: topMatch.item.id,
    name: topMatch.item.name,
    confidence,
    reason: `Fuzzy match (score: ${confidence}%)`,
  };
}

// ========================================
// CARD VARIANT FUZZY MATCHING
// ========================================

export function matchCardVariants(
  scrapedCardNames: string[],
  allCardVariants: CardVariantRecord[],
  bankId: number
): FuzzyMatchResult[] {
  if (!scrapedCardNames || scrapedCardNames.length === 0) return [];

  // Filter cards by bank first
  const bankCards = allCardVariants.filter((c) => c.bank_id === bankId);

  if (bankCards.length === 0) return [];

  const matches: FuzzyMatchResult[] = [];

  for (const scrapedCard of scrapedCardNames) {
    // Skip generic "All Cards"
    if (scrapedCard.toLowerCase().includes("all cards")) continue;

    // Try exact match
    const exactMatch = bankCards.find(
      (c) => c.name.toLowerCase() === scrapedCard.toLowerCase()
    );

    if (exactMatch) {
      matches.push({
        id: exactMatch.id,
        name: exactMatch.name,
        confidence: 100,
        reason: "Exact card name match",
      });
      continue;
    }

    // Fuzzy search
    const fuse = new Fuse(bankCards, {
      keys: ["name"],
      threshold: 0.3,
      includeScore: true,
    });

    const results = fuse.search(scrapedCard);

    if (results.length > 0) {
      const topMatch = results[0];
      const confidence = Math.round((1 - (topMatch.score || 0)) * 100);

      if (confidence >= CONFIDENCE_LEVELS.MEDIUM) {
        matches.push({
          id: topMatch.item.id,
          name: topMatch.item.name,
          confidence,
          reason: `Fuzzy match for "${scrapedCard}"`,
        });
      }
    }
  }

  return matches;
}

// ========================================
// BATCH MATCHING
// ========================================

export interface BatchMatchResult {
  listing: FuzzyMatchResult | null;
  bank: FuzzyMatchResult | null;
  cardVariants: FuzzyMatchResult[];
  overallConfidence: number;
  needsManualReview: boolean;
}

export function matchDeal(
  scraped: {
    merchant: string;
    bank: string;
    cards: string[];
    branches?: Array<{ address?: string; area?: string | null; city?: string }>;
  },
  database: {
    listings: ListingRecord[];
    banks: BankRecord[];
    cardVariants: CardVariantRecord[];
  }
): BatchMatchResult {
  const listingMatch = matchListing(
    scraped.merchant,
    database.listings,
    scraped.branches
  );
  const bankMatch = matchBank(scraped.bank, database.banks);

  let cardMatches: FuzzyMatchResult[] = [];

  if (bankMatch) {
    cardMatches = matchCardVariants(
      scraped.cards,
      database.cardVariants,
      bankMatch.id
    );
  }

  // Calculate overall confidence (weighted average)
  const weights = {
    listing: 0.5, // Merchant is most important
    bank: 0.3,
    cards: 0.2,
  };

  let totalConfidence = 0;
  let totalWeight = 0;

  if (listingMatch) {
    totalConfidence += listingMatch.confidence * weights.listing;
    totalWeight += weights.listing;
  }

  if (bankMatch) {
    totalConfidence += bankMatch.confidence * weights.bank;
    totalWeight += weights.bank;
  }

  if (cardMatches.length > 0) {
    const avgCardConfidence =
      cardMatches.reduce((sum, c) => sum + c.confidence, 0) /
      cardMatches.length;
    totalConfidence += avgCardConfidence * weights.cards;
    totalWeight += weights.cards;
  }

  const overallConfidence =
    totalWeight > 0 ? Math.round(totalConfidence / totalWeight) : 0;

  // Needs manual review if:
  // - No listing match found
  // - No bank match found
  // - Overall confidence < 80%
  const needsManualReview =
    !listingMatch || !bankMatch || overallConfidence < CONFIDENCE_LEVELS.HIGH;

  return {
    listing: listingMatch,
    bank: bankMatch,
    cardVariants: cardMatches,
    overallConfidence,
    needsManualReview,
  };
}
