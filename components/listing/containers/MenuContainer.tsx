import { query } from "@/lib/db";
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
  const { rows: sections } = await query(
    `SELECT * FROM menu_sections WHERE listing_id = $1 ORDER BY display_order ASC`,
    [listingId],
  );

  if (!sections || sections.length === 0) {
    return null;
  }

  const sectionIds = sections.map((s) => s.id);
  const { rows: items } = await query(
    `SELECT * FROM menu_items WHERE section_id = ANY($1)`,
    [sectionIds],
  );

  const menuSections = sections.map((section) => ({
    ...section,
    menu_items: items.filter((item) => item.section_id === section.id),
  }));

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
