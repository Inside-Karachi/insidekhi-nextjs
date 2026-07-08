import { useState, useEffect } from "react";
import { DropdownOption } from "@/types/filter.types";

interface UseCardVariantsResult {
  cards: DropdownOption[];
  loading: boolean;
  error: string | null;
}

export function useCardVariants(bankId: string | null): UseCardVariantsResult {
  const [cards, setCards] = useState<DropdownOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bankId) {
      setCards([]);
      setLoading(false);
      setError(null);
      return;
    }

    const fetchCards = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/cards?bankId=${bankId}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to fetch cards");
        }

        if (data.success) {
          setCards(data.cards || []);
        } else {
          throw new Error("API returned unsuccessful response");
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error occurred";
        console.error("useCardVariants: Error fetching cards:", errorMessage);
        setError(errorMessage);
        setCards([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCards();
  }, [bankId]);

  return { cards, loading, error };
}
