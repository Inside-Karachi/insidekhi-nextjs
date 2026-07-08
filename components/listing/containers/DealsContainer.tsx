
import { createServerSupabase } from "@/lib/supabase/server";
import { Deals } from "@/components/listing/Deals";

interface DealsContainerProps {
    listingId: number;
    businessName: string;
}

export async function DealsContainer({
    listingId,
    businessName,
}: DealsContainerProps) {
    const supabase = await createServerSupabase({ publicAnon: true });

    const { data: deals, error } = await supabase
        .from("deals")
        .select(
            `
      *,
      banks(name, logo_url)
    `
        )
        .eq("listing_id", listingId)
        .eq("is_active", true)
        // Show deals that either have no end date (open-ended) OR expire in the future
        .or(`end_date.is.null,end_date.gte.${new Date().toISOString()}`)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("[DealsContainer] Supabase error:", error);
        return null;
    }

    if (!deals || deals.length === 0) {
        return null;
    }

    // Ensure all deals have properly serializable data
    const serializedDeals = deals.map((deal) => ({
        ...deal,
        // Ensure banks is null instead of undefined for proper serialization
        banks: deal.banks || null,
        // Ensure description is string or null (not undefined)
        description: deal.description || null,
    }));

    return (
        <div id="deals-section">
            <Deals deals={serializedDeals} businessName={businessName} />
        </div>
    );
}
