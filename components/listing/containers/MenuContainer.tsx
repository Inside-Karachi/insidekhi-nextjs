import { createServerSupabase } from "@/lib/supabase/server";
import { ListingMenu } from "@/components/listing/ListingMenu";

interface MenuContainerProps {
  listingId: number;
  menuPdfUrl?: string | null;
  restaurantName: string;
}

export async function MenuContainer({
  listingId,
  menuPdfUrl,
  restaurantName,
}: MenuContainerProps) {
  const supabase = await createServerSupabase({ publicAnon: true });

  const { data: menuSections } = await supabase
    .from("menu_sections")
    .select(
      `
      *,
      menu_items(*)
    `,
    )
    .eq("listing_id", listingId)
    .order("display_order", { ascending: true });

  if (!menuSections || menuSections.length === 0) {
    return null;
  }

  return (
    <div id="menu-section">
      <ListingMenu
        menuSections={menuSections}
        restaurantName={restaurantName}
        menuPdfUrl={menuPdfUrl}
        listingId={listingId}
      />
    </div>
  );
}
