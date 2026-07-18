
import { query } from "@/lib/db";
import { Deals } from "@/components/listing/Deals";

interface DealsContainerProps {
    listingId: number;
    businessName: string;
}

export async function DealsContainer({
    listingId,
    businessName,
}: DealsContainerProps) {
    let deals;
    try {
        const { rows } = await query(
            `SELECT d.*,
                    b.name AS bank_name,
                    b.logo_url AS bank_logo_url
             FROM deals d
             LEFT JOIN banks b ON b.id = d.bank_id
             WHERE d.listing_id = $1
               AND d.is_active = true
               AND (d.end_date IS NULL OR d.end_date >= $2)
             ORDER BY d.created_at DESC`,
            [listingId, new Date().toISOString()],
        );
        deals = rows;
    } catch (error) {
        console.error("[DealsContainer] query error:", error);
        return null;
    }

    if (!deals || deals.length === 0) {
        return null;
    }

    // Ensure all deals have properly serializable data
    const serializedDeals = deals.map((deal) => ({
        ...deal,
        // Ensure banks is null instead of undefined for proper serialization
        banks: deal.bank_name
            ? { name: deal.bank_name, logo_url: deal.bank_logo_url }
            : null,
        // Ensure description is string or null (not undefined)
        description: deal.description || null,
    }));

    return (
        <div id="deals-section">
            <Deals deals={serializedDeals} businessName={businessName} />
        </div>
    );
}
