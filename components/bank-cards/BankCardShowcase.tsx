"use client";

import { useEffect, useState } from "react";
import { BankCardImage, BankCardFallback } from "./BankCardImage";
import { createClient } from "@/lib/supabase/client";
import { Database } from "@/types/supabase";

// Use real Supabase types
type CardVariant = Database["public"]["Tables"]["card_variants"]["Row"];

interface BankCardShowcaseProps {
  bankName: string;
  bankId?: number | null;
  dealId?: number;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
  maxCards?: number;
}

export function BankCardShowcase({
  bankName,
  bankId,
  dealId,
  size = "sm",
  className = "",
  maxCards = 4,
}: BankCardShowcaseProps) {
  const [cardVariants, setCardVariants] = useState<CardVariant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCardVariants = async () => {
      try {
        const supabase = createClient();

        // 1. If we have a dealId, we must first fetch the deal's specific requirements
        // We need both the ID list and the metadata for name-based fallback
        let targetCardIds: number[] = [];
        let targetCardNames: string[] = [];

        if (dealId) {
          const { data: dealData } = await supabase
            .from("deals")
            .select("valid_card_variants, metadata")
            .eq("id", dealId)
            .single();

          if (dealData) {
            // Strategy A: IDs
            if (
              dealData.valid_card_variants &&
              dealData.valid_card_variants.length > 0
            ) {
              targetCardIds = dealData.valid_card_variants;
            }

            // Strategy B: Names from Metadata (Fallback for ID mismatch)
            // The metadata often contains 'card_associations' with names that match our DB
            const metadata = dealData.metadata as Record<string, unknown>;
            if (
              metadata &&
              metadata.card_associations &&
              Array.isArray(metadata.card_associations)
            ) {
              targetCardNames = metadata.card_associations.map(
                (c: { name: string }) => c.name,
              );
            }
          }
        }

        // 2. Build the query based on our findings
        let query = supabase
          .from("card_variants")
          .select("*")
          .eq("is_active", true)
          .order("card_tier", { ascending: true })
          .order("card_name", { ascending: true });

        // Apply Bank Filter
        if (bankId) {
          query = query.eq("bank_id", bankId);
        } else {
          // If no bankId provided, try to find it via name
          const { data: bankData } = await supabase
            .from("banks")
            .select("id")
            .eq("name", bankName)
            .single();

          if (bankData) {
            query = query.eq("bank_id", bankData.id);
          }
        }

        // 3. Execute Fetch with Priority: IDs -> Names
        let finalData: CardVariant[] = [];

        // Attempt 1: Fetch by IDs (Most Precise)
        if (targetCardIds.length > 0) {
          const { data: idData } = await query
            .in("id", targetCardIds)
            .limit(maxCards);

          if (idData && idData.length > 0) {
            finalData = idData;
          }
        }

        // Attempt 2: Fetch by Names (If IDs failed or returned nothing)
        if (finalData.length === 0 && targetCardNames.length > 0 && bankId) {
          // We create a new query instance to avoid the previous .in filter
          const nameQuery = supabase
            .from("card_variants")
            .select("*")
            .eq("is_active", true)
            .eq("bank_id", bankId) // Start strict with bank_id
            .in("card_name", targetCardNames);

          const { data: nameData } = await nameQuery.limit(maxCards);

          if (nameData && nameData.length > 0) {
            finalData = nameData;
          }
        }

        // Note: We deliberately removed the "Generic Bank Fallback" here.
        // If we can't match specific cards for the deal, it's better to show nothing
        // or a "See Terms" state than to show misleading random cards.

        setCardVariants(finalData);
      } catch (error) {
        console.error("Error in fetchCardVariants:", error);
        setCardVariants([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCardVariants();
  }, [bankName, bankId, dealId, maxCards]);

  if (loading) {
    return (
      <div className={`flex gap-2 ${className}`}>
        {[...Array(2)].map((_, i) => (
          <div
            key={i}
            className="w-15 h-9 bg-muted/50 rounded-lg animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (cardVariants.length === 0) {
    return <BankCardFallback size={size} className={className} />;
  }

  return (
    <div className={`flex gap-2 flex-wrap ${className}`}>
      {cardVariants.map((variant) => (
        <BankCardImage
          key={variant.id}
          cardVariant={variant}
          bankName={bankName}
          size={size}
          className="transition-transform hover:scale-105"
        />
      ))}
    </div>
  );
}
