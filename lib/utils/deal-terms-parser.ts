/**
 * Deal Terms Parser Utility
 * Intelligently parses and extracts key information from deal terms & conditions
 * scraped from external sources (e.g., Peekaboo)
 */

export interface ParsedTerms {
  /** Key highlights extracted from T&C (e.g., discount caps, card restrictions) */
  highlights: string[];
  /** Full terms split into logical sections */
  sections: TermsSection[];
  /** Quick summary for preview */
  summary: string;
  /** Discount cap amounts if found */
  discountCaps: DiscountCap[];
  /** Card restrictions if found */
  cardRestrictions: string[];
  /** Usage limits (transactions per day/month) */
  usageLimits: string[];
  /** Important warnings */
  warnings: string[];
}

export interface TermsSection {
  title: string;
  items: string[];
}

export interface DiscountCap {
  cardType: string;
  amount: string;
}

/**
 * Parse deal description/terms into structured, user-friendly format
 * Error-safe: Returns default structure on any parsing failure
 */
export function parseDealTerms(description: string | null): ParsedTerms {
  // Default empty structure
  const emptyResult: ParsedTerms = {
    highlights: [],
    sections: [],
    summary: "Terms apply. Please inquire at the venue for details.",
    discountCaps: [],
    cardRestrictions: [],
    usageLimits: [],
    warnings: [],
  };

  if (!description) {
    return emptyResult;
  }

  // Validate input is actually a string
  if (typeof description !== "string") {
    console.warn("[deal-terms-parser] Invalid input type:", typeof description);
    return emptyResult;
  }

  try {
    // Split by asterisks or bullet points
    const items = description
      .split(/\*+/)
      .map((item) => item.trim())
      .filter((item) => item.length > 5); // Filter out very short items

    const highlights: string[] = [];
    const discountCaps: DiscountCap[] = [];
    const cardRestrictions: string[] = [];
    const usageLimits: string[] = [];
    const warnings: string[] = [];

    // Parse each item and categorize
    items.forEach((item) => {
      const lowerItem = item.toLowerCase();

      // Extract discount caps (PKR amounts)
      if (lowerItem.includes("discount cap") && lowerItem.includes("pkr")) {
        const match = item.match(
          /(.*?)\s*discount cap\s*pkr\s*([\d,]+)\s*on\s*(.*)/i,
        );
        if (match && match[2] && match[3]) {
          discountCaps.push({
            cardType: match[3].trim(),
            amount: `PKR ${match[2]}`,
          });
          highlights.push(`Cap: ${match[2]} on ${match[3].trim()}`);
        }
      }

      // Extract card restrictions (BIN numbers)
      if (lowerItem.includes("valid only on") && lowerItem.includes("bin")) {
        const match = item.match(/valid only on\s*(.*?)\s*on\s*(\d+)\s*bin/i);
        if (match && match[1]) {
          cardRestrictions.push(match[1].trim());
        }
      }

      // Extract usage limits
      if (
        lowerItem.includes("transaction") &&
        (lowerItem.includes("per day") ||
          lowerItem.includes("per month") ||
          lowerItem.includes("calendar month"))
      ) {
        usageLimits.push(item);
        const match = item.match(/(\d+).*?transaction.*?(per day|per month)/i);
        if (match && match[1] && match[2]) {
          highlights.push(`Limit: ${match[1]} ${match[2]}`);
        }
      }

      // Extract important warnings
      if (
        lowerItem.includes("not valid") ||
        lowerItem.includes("cannot be combined") ||
        lowerItem.includes("not applicable") ||
        lowerItem.includes("exclude")
      ) {
        warnings.push(item);
      }
    });

    // Build structured sections
    const sections: TermsSection[] = [];

    if (discountCaps.length > 0) {
      sections.push({
        title: "Discount Limits",
        items: discountCaps.map(
          (cap) => `${cap.cardType}: Maximum ${cap.amount}`,
        ),
      });
    }

    if (usageLimits.length > 0) {
      sections.push({
        title: "Usage Restrictions",
        items: usageLimits,
      });
    }

    if (cardRestrictions.length > 0) {
      sections.push({
        title: "Valid Cards",
        items: cardRestrictions.slice(0, 5), // Show first 5 only
      });
    }

    if (warnings.length > 0) {
      sections.push({
        title: "Important Notes",
        items: warnings.slice(0, 3), // Show top 3 warnings
      });
    }

    // Add remaining items as "General Terms"
    const otherItems = items.filter((item) => {
      const lowerItem = item.toLowerCase();
      return (
        !lowerItem.includes("discount cap") &&
        !lowerItem.includes("valid only on") &&
        !lowerItem.includes("transaction") &&
        !discountCaps.some((cap) => item.includes(cap.amount)) &&
        !usageLimits.includes(item) &&
        !warnings.includes(item) &&
        !cardRestrictions.includes(item)
      );
    });

    if (otherItems.length > 0) {
      sections.push({
        title: "General Terms",
        items: otherItems.slice(0, 5), // Limit to 5 general terms
      });
    }

    // Build summary (1-2 sentence preview)
    let summary = "";
    if (discountCaps.length > 0) {
      const topCap = discountCaps[0];
      summary = `Discount cap up to ${topCap.amount}`;
    }
    if (usageLimits.length > 0) {
      const limitMatch = usageLimits[0].match(/(\d+).*?transaction/i);
      if (limitMatch && limitMatch[1]) {
        summary += summary
          ? `. ${limitMatch[1]} transactions allowed`
          : `${limitMatch[1]} transactions allowed`;
      }
    }
    if (!summary) {
      summary =
        "Cannot be combined with other offers. Terms & conditions apply.";
    } else {
      summary += ". Terms apply.";
    }

    return {
      highlights: highlights.slice(0, 3), // Top 3 highlights
      sections,
      summary,
      discountCaps,
      cardRestrictions,
      usageLimits,
      warnings,
    };
  } catch (error) {
    // Log error but don't crash - return safe default
    console.error("[deal-terms-parser] Parsing error:", error);
    return emptyResult;
  }
}

/**
 * Generate a user-friendly short preview (for card display)
 * Max 120 characters
 */
export function getTermsPreview(description: string | null): string {
  if (!description) {
    return "Cannot be combined with other offers • Terms apply";
  }

  const parsed = parseDealTerms(description);

  // Prioritize: Caps > Limits > Generic
  const parts: string[] = [];

  if (parsed.discountCaps.length > 0) {
    parts.push(`Cap: ${parsed.discountCaps[0].amount}`);
  }

  if (parsed.usageLimits.length > 0) {
    const match = parsed.usageLimits[0].match(/(\d+).*?transaction/i);
    if (match) {
      parts.push(`${match[1]} uses/month`);
    }
  }

  parts.push("Terms apply");

  const preview = parts.join(" • ");

  return preview.length > 120 ? preview.substring(0, 117) + "..." : preview;
}

/**
 * Check if description has substantial terms (needs expansion)
 */
export function hasSubstantialTerms(description: string | null): boolean {
  if (!description) return false;
  return description.length > 200; // Arbitrary threshold
}
