import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { Parser } from "json2csv";
import type { Database } from "@/types/supabase";

type ExportListingRow = Database["public"]["Tables"]["listings"]["Row"] & {
  categories?: SupabaseCategory;
  listing_features?: SupabaseFeature[];
  opening_hours?: SupabaseOpeningHour[];
  deals?: SupabaseDeal[];
  menu_sections?: SupabaseMenuSection[];
  listing_images?: SupabaseImage[];
  listing_branches?: SupabaseBranch[];
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();

    // Check if user is admin
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check admin role
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (
      profileError ||
      (profile?.role !== "admin" && profile?.role !== "super_admin")
    ) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      filters = {},
      includeRelated = true,
      includeTechnical = false,
    } = body as {
      filters?: {
        status?: string;
        categoryId?: string;
        isFeatured?: string;
        search?: string;
      };
      includeRelated?: boolean;
      includeTechnical?: boolean;
    };

    const relatedSelect = includeRelated
      ? `
        categories:category_id(name, slug, parent_id, parent:parent_id(name, slug)),
        listing_features(
          feature_id,
          listing_features_master(name, icon_emoji, category)
        ),
        opening_hours(day_of_week, open_time, close_time, is_closed, branch_id),
        deals(
          id,
          title,
          description,
          deal_type,
          discount_value,
          is_active,
          bank_id,
          start_date,
          end_date,
          valid_card_variants,
          metadata,
          banks(id, name, code)
        ),
        menu_sections(
          id,
          name,
          description,
          display_order,
          menu_items(id, name, description, price, is_available, image_url, image_alt, display_order, is_featured)
        ),
        listing_images!fkey_listing_images_listing_id(url, alt_text, display_order, is_primary),
        listing_branches(
          id,
          name,
          address,
          city,
          country,
          latitude,
          longitude,
          phone_number,
          timings,
          is_open_now,
          is_primary,
          is_verified,
          distance_from_center,
          custom_attributes,
          peekaboo_branch_id,
          opening_hours(day_of_week, open_time, close_time, is_closed, branch_id)
        )
      `
      : "";

    const selectClause = includeRelated ? `*,${relatedSelect}` : "*";

    const buildQuery = () => {
      let query = supabase.from("listings").select(selectClause);

      // Apply filters
      if (filters.status && filters.status !== "all") {
        query = query.eq(
          "status",
          filters.status as NonNullable<
            Database["public"]["Tables"]["listings"]["Row"]["status"]
          >,
        );
      }

      if (filters.categoryId && filters.categoryId !== "all") {
        const categoryId = Number(filters.categoryId);
        if (Number.isFinite(categoryId)) {
          query = query.eq("category_id", categoryId);
        }
      }

      if (filters.isFeatured && filters.isFeatured !== "all") {
        query = query.eq("is_featured", filters.isFeatured === "true");
      }

      if (filters.search) {
        query = query.or(
          `name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`
        );
      }

      return query;
    };

    // Fetch all rows in deterministic pages to avoid API limits truncating exports.
    const pageSize = 1000;
    let offset = 0;
    const listings: ExportListingRow[] = [];

    while (true) {
      const { data, error } = await buildQuery()
        .order("id", { ascending: true })
        .range(offset, offset + pageSize - 1);

      if (error) {
        console.error("Error fetching listings for export:", error);
        return NextResponse.json(
          { error: "Failed to fetch listings" },
          { status: 500 }
        );
      }

      if (!data || data.length === 0) {
        break;
      }

      listings.push(...(data as unknown as ExportListingRow[]));

      if (data.length < pageSize) {
        break;
      }

      offset += pageSize;
    }

    // Transform data to CSV format
    const csvData =
      listings?.map((listing) => {
        const baseRow: Record<string, string | number> = {
          Membership: listing.show_member_badge ? "Member" : "Non-Member",
          Name: normalizeExportText(listing.name),
          Address: normalizeExportText(listing.address),
          Phone: normalizeExportText(listing.phone_number),
          Email: normalizeExportText(listing.email),
          "Latitude/Longitude":
            listing.latitude && listing.longitude
              ? `${listing.latitude}, ${listing.longitude}`
              : "",
          "Google map Link": normalizeExportText(listing.google_maps_url),
          Description: normalizeExportText(listing.description),
          Website: normalizeExportText(listing.website),
          Timings: formatOpeningHours(listing.opening_hours || []),
          Categories: formatCategories(listing.categories ?? null),
          Features: formatFeatures(listing.listing_features || []),
          Status: normalizeExportText(listing.status),
          Featured: listing.is_featured ? "TRUE" : "FALSE",
          "Created Date": listing.created_at || "",
          "Display Order": listing.display_order || "",
          "Owner ID": listing.owner_id || "",
          "Place ID": normalizeExportText(listing.place_id),
          "Gallery Images": formatGalleryImages(listing.listing_images || []),
          "Menu Sections": formatMenuSections(listing.menu_sections || []),
          "Menu PDF": normalizeExportText(listing.menu_pdf_url),
          "Deal & Discounts":
            listing.deals && listing.deals.length > 0 ? "TRUE" : "FALSE",
          "D&D Notes": formatDeals(listing.deals || []),
          "Bank Promotions": formatBankPromotions(listing.deals || []),
          Branches: formatBranches(listing.listing_branches || []),
          "Branch Opening Hours": formatBranchOpeningHours(
            listing.listing_branches || []
          ),
          Facebook: normalizeExportText(listing.facebook_url),
          Whatsapp: normalizeExportText(listing.whatsapp_number),
          Instagram: normalizeExportText(listing.instagram_url),
          Youtube: normalizeExportText(listing.youtube_url),
          "Last Update": listing.updated_at || "",
        };

        if (includeTechnical) {
          baseRow["Peekaboo ID"] = listing.peekaboo_id || "";
          baseRow["Parking Information"] = normalizeExportText(
            listing.parking_information,
          );
          baseRow["Parking Amenities"] = formatJsonArray(
            listing.parking_amenities,
          );
          baseRow["Custom Attributes"] = formatJsonValue(
            listing.custom_attributes,
          );
          baseRow["Deals JSON"] = formatDealsJson(listing.deals || []);
        }

        return baseRow;
      }) || [];

    // Convert to CSV
    const fields = [
      "Membership",
      "Name",
      "Address",
      "Phone",
      "Email",
      "Latitude/Longitude",
      "Google map Link",
      "Description",
      "Website",
      "Timings",
      "Categories",
      "Features",
      "Status",
      "Featured",
      "Created Date",
      "Display Order",
      "Owner ID",
      "Place ID",
      "Gallery Images",
      "Menu Sections",
      "Menu PDF",
      "Deal & Discounts",
      "D&D Notes",
      "Bank Promotions",
      "Branches",
      "Branch Opening Hours",
      "Facebook",
      "Whatsapp",
      "Instagram",
      "Youtube",
      "Last Update",
      ...(includeTechnical
        ? [
            "Peekaboo ID",
            "Parking Information",
            "Parking Amenities",
            "Custom Attributes",
            "Deals JSON",
          ]
        : []),
    ];

    const json2csvParser = new Parser({ fields });

    const csv = json2csvParser.parse(csvData);

    // Return CSV file
    const filename = `listings_export_${
      new Date().toISOString().split("T")[0]
    }.csv`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}

// Helper functions
type SupabaseOpeningHour = {
  day_of_week: number;
  open_time?: string | null;
  close_time?: string | null;
  is_closed?: boolean | null;
};
function formatOpeningHours(openingHours: SupabaseOpeningHour[]): string {
  if (!openingHours || openingHours.length === 0) return "";
  const dayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const formatted = openingHours
    .filter((oh) => !oh.is_closed)
    .map((oh) => {
      const dayName = dayNames[oh.day_of_week] || `Day ${oh.day_of_week}`;
      const openTime = oh.open_time ? oh.open_time.slice(0, 5) : "";
      const closeTime = oh.close_time ? oh.close_time.slice(0, 5) : "";
      return `${dayName}: ${openTime}-${closeTime}`;
    })
    .join(" | ");
  return formatted;
}

function normalizeExportText(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type SupabaseFeature = {
  listing_features_master?: { name?: string };
};
function formatFeatures(features: SupabaseFeature[]): string {
  if (!features || features.length === 0) return "";
  return features
    .map((f) => normalizeExportText(f.listing_features_master?.name))
    .filter(Boolean)
    .join(", ");
}

type SupabaseCategory = { name?: string; parent?: { name?: string } } | null;
function formatCategories(category: SupabaseCategory): string {
  if (!category) return "";
  if (category.parent) {
    return `${normalizeExportText(category.parent.name)} > ${normalizeExportText(category.name)}`;
  }
  return normalizeExportText(category.name);
}

type SupabaseImage = { url?: string; display_order?: number | null };
function formatGalleryImages(images: SupabaseImage[]): string {
  if (!images || images.length === 0) return "";
  return images
    .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
    .map((img) => img.url)
    .filter(Boolean)
    .join(" | ");
}

function formatJsonValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  try {
    return JSON.stringify(value);
  } catch (error) {
    console.warn("Failed to serialize JSON value:", error);
    return "";
  }
}

function formatJsonArray(value: unknown): string {
  if (!Array.isArray(value) || value.length === 0) return "";
  try {
    return JSON.stringify(value);
  } catch (error) {
    console.warn("Failed to serialize JSON array:", error);
    return "";
  }
}

type SupabaseMenuItem = {
  name?: string;
  description?: string | null;
  price?: number;
  is_available?: boolean;
  image_url?: string | null;
  display_order?: number | null;
  is_featured?: boolean;
};
type SupabaseMenuSection = {
  name?: string;
  display_order?: number | null;
  menu_items?: SupabaseMenuItem[];
};
function formatMenuSections(sections: SupabaseMenuSection[]): string {
  if (!sections || sections.length === 0) return "";
  return sections
    .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
    .map((section) => {
      const sectionName = section.name || "";
      const items = section.menu_items || [];
      const formattedItems = items
        .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
        .map(
          (item) => {
            const name = normalizeExportText(item.name);
            const price = typeof item.price === "number" ? `Rs ${item.price}` : "";
            return [name, price].filter(Boolean).join(" - ");
          },
        )
        .join("; ");
      return `${normalizeExportText(sectionName)}: ${formattedItems}`;
    })
    .join(" || ");
}

type SupabaseDeal = {
  id?: number;
  title?: string;
  discount_value?: string | null;
  is_active?: boolean;
  deal_type?: Database["public"]["Enums"]["deal_type"];
  description?: string | null;
  bank_id?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  valid_card_variants?: number[] | null;
  metadata?: unknown;
  banks?: { id?: number; name?: string | null; code?: string | null } | null;
};
function formatDeals(deals: SupabaseDeal[]): string {
  if (!deals || deals.length === 0) return "";
  return deals
    .filter((d) => d.is_active)
    .map((d) =>
      `${normalizeExportText(d.title)}: ${normalizeExportText(d.discount_value) || "Special offer"}`,
    )
    .join(" | ");
}

function formatDealsJson(deals: SupabaseDeal[]): string {
  if (!deals || deals.length === 0) return "";
  try {
    return JSON.stringify(
      deals.map((deal) => ({
        id: deal.id || null,
        title: deal.title || null,
        description: deal.description || null,
        deal_type: deal.deal_type || null,
        bank_id: typeof deal.bank_id === "number" ? deal.bank_id : null,
        bank_name: deal.banks?.name || null,
        bank_code: deal.banks?.code || null,
        discount_value: deal.discount_value || null,
        is_active: deal.is_active ?? true,
        start_date: deal.start_date || null,
        end_date: deal.end_date || null,
        valid_card_variants: deal.valid_card_variants || null,
        metadata: deal.metadata || null,
      }))
    );
  } catch (error) {
    console.warn("Failed to serialize deals JSON for export:", error);
    return "";
  }
}

type SupabaseBranchOpeningHour = {
  day_of_week?: number;
  open_time?: string | null;
  close_time?: string | null;
  is_closed?: boolean | null;
  branch_id?: number | null;
};

type SupabaseBranch = {
  id?: number;
  name?: string;
  address?: string;
  city?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  phone_number?: string | null;
  timings?: string | null;
  is_open_now?: boolean;
  is_primary?: boolean;
  is_verified?: boolean;
  distance_from_center?: string | null;
  custom_attributes?: unknown;
  peekaboo_branch_id?: number | null;
  opening_hours?: SupabaseBranchOpeningHour[];
};

function formatBranches(branches: SupabaseBranch[]): string {
  if (!branches || branches.length === 0) return "";
  return branches
    .map((branch) => {
      const name = normalizeExportText(branch.name);
      const address = normalizeExportText(branch.address);
      const city = normalizeExportText(branch.city);
      const phone = normalizeExportText(branch.phone_number ?? undefined);
      const timings = normalizeExportText(branch.timings ?? undefined);
      const location = [address, city].filter(Boolean).join(", ");

      return [
        name,
        location,
        phone ? `Phone: ${phone}` : "",
        timings ? `Timings: ${timings}` : "",
      ]
        .filter(Boolean)
        .join(" | ");
    })
    .filter(Boolean)
    .join(" || ");
}

function formatBranchOpeningHours(branches: SupabaseBranch[]): string {
  if (!branches || branches.length === 0) return "";
  return branches
    .filter((branch) => Array.isArray(branch.opening_hours) && branch.opening_hours.length > 0)
    .map((branch) => {
      const name = normalizeExportText(branch.name);
      const hours = formatOpeningHours(
        (branch.opening_hours || []).map((hour) => ({
          day_of_week: hour.day_of_week ?? 0,
          open_time: hour.open_time ?? null,
          close_time: hour.close_time ?? null,
          is_closed: hour.is_closed ?? false,
        })),
      );
      return `${name}: ${hours}`;
    })
    .filter(Boolean)
    .join(" || ");
}

function formatBankPromotions(deals: SupabaseDeal[]): string {
  if (!deals || deals.length === 0) return "";

  const bankDeals = deals
    .filter((deal) => deal.is_active && deal.deal_type === "bank_discount")
    .map((deal) => ({
      title: deal.title || deal.banks?.name || "Bank Promotion",
      discount_value: deal.discount_value || null,
      bank: deal.banks?.name || null,
      description: deal.description || null,
      is_active: true,
    }));

  if (bankDeals.length === 0) return "";

  return bankDeals
    .map((deal) => {
      const title = normalizeExportText(deal.title);
      const discount = normalizeExportText(deal.discount_value);
      const bank = normalizeExportText(deal.bank);
      return [title, bank ? `(${bank})` : "", discount].filter(Boolean).join(" ");
    })
    .join(" | ");
}
