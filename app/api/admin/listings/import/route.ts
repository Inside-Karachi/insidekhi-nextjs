import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { parse } from "csv-parse/sync";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  validateCsvData,
  generateSlug,
  sanitizeText,
  isValidListingRow,
  sanitizeListingField,
} from "@/lib/utils/export-import-utils";

import type {
  SimulatedImportResult,
  TransactionalImportResult,
  FieldStats,
} from "@/types/import.types";
import type { Database } from "@/types/supabase";
import type {
  ImportHistory,
  ImportOptions,
  ImportResult,
  ImportPreviewWarning,
} from "@/types/import.types";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RecordEntry = {
  record: string[];
  rowNumber: number;
};

type ListingRecordMeta = {
  dealsFlag?: string | boolean | null;
  dealsNotes?: string | null;
  bankPromotions?: string | null;
  dealsJson?: string | null;
  branchesJson?: string | null;
  branchOpeningHoursJson?: string | null;
  sourceFormat: "client" | "export";
};

interface ListingTransformResult {
  listing: Database["public"]["Tables"]["listings"]["Row"];
  meta: ListingRecordMeta;
}

type PreparedListingEntry = RecordEntry & ListingTransformResult;

const SENTINEL_VALUES = new Set([
  "n/a",
  "na",
  "none",
  "no data",
  "null",
  "nil",
  "tbd",
  "pending",
  "-",
  "--",
  "n\\a",
  "not applicable",
  "[]",
  "{}",
]);

function normalizeOptionalText(value?: string | null): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) return null;

  const lowered = trimmed.toLowerCase();
  if (SENTINEL_VALUES.has(lowered)) {
    return null;
  }

  return trimmed;
}

function normalizeOptionalFlag(value?: string | null): string | null {
  const normalized = normalizeOptionalText(value);
  if (!normalized) return null;

  const lowered = normalized.toLowerCase();
  if (["true", "false", "yes", "no", "1", "0"].includes(lowered)) {
    return normalized;
  }

  return normalized;
}

function safeJsonParse(value?: string | null): unknown {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function parsePreviewJsonField(
  row: number,
  field: string,
  value: string | undefined,
  expectedShape: "array" | "object",
): ImportPreviewWarning[] {
  const normalized = normalizeOptionalText(value);
  if (!normalized) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(normalized);
  } catch {
    return [
      {
        row,
        field,
        severity: "warning",
        message: `${field} contains invalid JSON and will be ignored during import.`,
      },
    ];
  }

  const isObject = parsed !== null && typeof parsed === "object" && !Array.isArray(parsed);
  const isArray = Array.isArray(parsed);
  const shapeMatches =
    (expectedShape === "object" && isObject) ||
    (expectedShape === "array" && isArray);

  if (!shapeMatches) {
    return [
      {
        row,
        field,
        severity: "warning",
        message: `${field} JSON has unexpected shape and may be ignored (expected ${expectedShape}).`,
      },
    ];
  }

  return [];
}

function getPreviewJsonWarningsForRecord(
  record: string[],
  rowNumber: number,
): ImportPreviewWarning[] {
  const isClientFormat =
    record[0]?.includes("ChIJ") || record[0] === "DHA PHASE 2";

  if (isClientFormat) {
    return [];
  }

  const warnings: ImportPreviewWarning[] = [];
  const parkingAmenities = record[31];
  const customAttributes = record[32];
  const dealsJson = record[33];
  const branches = record[34];
  const branchOpeningHours = record[35];

  warnings.push(
    ...parsePreviewJsonField(
      rowNumber,
      "Parking Amenities",
      parkingAmenities,
      "array",
    ),
    ...parsePreviewJsonField(
      rowNumber,
      "Custom Attributes",
      customAttributes,
      "object",
    ),
    ...parsePreviewJsonField(rowNumber, "Deals JSON", dealsJson, "array"),
    ...parsePreviewJsonField(rowNumber, "Branches", branches, "array"),
    ...parsePreviewJsonField(
      rowNumber,
      "Branch Opening Hours",
      branchOpeningHours,
      "array",
    ),
  );

  return warnings;
}

function parseJsonObject(value?: string | null): Record<string, unknown> | null {
  const parsed = safeJsonParse(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }
  return parsed as Record<string, unknown>;
}

function parseStringArray(value?: string | null): string[] | null {
  const parsed = safeJsonParse(value);
  if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
    return parsed;
  }
  return null;
}

type ParsedGeneralDeal = {
  title: string;
  discountValue: string | null;
  description?: string | null;
};

type ParsedBankDeal = ParsedGeneralDeal & {
  bankName: string | null;
  bankId?: number | null;
};

type ParsedDealJsonRecord = {
  title: string;
  description: string | null;
  dealType: Database["public"]["Enums"]["deal_type"];
  bankId: number | null;
  discountValue: string | null;
  isActive: boolean;
  startDate: string | null;
  endDate: string | null;
  validCardVariants: number[] | null;
  metadata: Record<string, unknown> | null;
};

type ParsedBranchRecord = {
  name: string;
  address: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  phone_number: string | null;
  timings: string | null;
  is_open_now: boolean;
  is_primary: boolean;
  is_verified: boolean;
  distance_from_center: string | null;
  custom_attributes: Record<string, unknown>;
  peekaboo_branch_id: number | null;
};

type ParsedBranchHoursRecord = {
  branch_name: string | null;
  peekaboo_branch_id: number | null;
  hours: Array<{
    day_of_week: number;
    open_time: string | null;
    close_time: string | null;
    is_closed: boolean;
  }>;
};

type BankLookupEntry = {
  id: number;
  name: string;
  code?: string | null;
  key: string;
};

interface BankLookupContext {
  loaded: boolean;
  entries: BankLookupEntry[];
  lookup: Map<string, BankLookupEntry>;
}

interface CategoryLookupContext {
  cache: Map<string, number | null>;
}

function createCategoryLookupContext(): CategoryLookupContext {
  return {
    cache: new Map<string, number | null>(),
  };
}

type ExistingListingSummary = {
  id: number;
  name: string | null;
  slug: string | null;
  place_id: string | null;
  updated_at: string | null;
};

interface DuplicateLookupContext {
  byName: Map<string, ExistingListingSummary>;
  bySlug: Map<string, ExistingListingSummary>;
  byPlaceId: Map<string, ExistingListingSummary>;
  seenNames: Map<string, number>;
  seenSlugs: Map<string, number>;
  seenPlaceIds: Map<string, number>;
}

function createDuplicateLookupContext(): DuplicateLookupContext {
  return {
    byName: new Map(),
    bySlug: new Map(),
    byPlaceId: new Map(),
    seenNames: new Map(),
    seenSlugs: new Map(),
    seenPlaceIds: new Map(),
  };
}

function normalizeLookupKey(value?: string | null): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized ? normalized : null;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function storeExistingListing(
  map: Map<string, ExistingListingSummary>,
  value: string | null,
  listing: ExistingListingSummary,
): void {
  const key = normalizeLookupKey(value);
  if (!key || map.has(key)) {
    return;
  }
  map.set(key, listing);
}

function setExistingListing(
  map: Map<string, ExistingListingSummary>,
  value: string | null,
  listing: ExistingListingSummary,
): void {
  const key = normalizeLookupKey(value);
  if (!key) return;
  map.set(key, listing);
}

async function resolveCategoryId(
  supabase: SupabaseClient<Database>,
  categoryName: string,
  context?: CategoryLookupContext,
): Promise<number | null> {
  const sanitized = sanitizeText(categoryName ?? "");
  if (!sanitized) {
    return null;
  }

  const cacheKey = sanitized.toLowerCase();
  if (context) {
    const cached = context.cache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }
  }

  const { data: category } = await supabase
    .from("categories")
    .select("id")
    .ilike("name", sanitized)
    .limit(1)
    .single();

  const categoryId = category?.id ?? null;

  if (context) {
    context.cache.set(cacheKey, categoryId);
  }

  return categoryId;
}

function deriveRecordName(record: string[]): string {
  const candidates = [record[1], record[2], record[0]];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return "Unknown";
}

async function populateDuplicateLookupContext(
  supabase: SupabaseClient<Database>,
  entries: PreparedListingEntry[],
  context: DuplicateLookupContext,
): Promise<void> {
  const nameValues = new Set<string>();
  const slugValues = new Set<string>();
  const placeIdValues = new Set<string>();

  for (const entry of entries) {
    if (entry.listing.name) {
      nameValues.add(entry.listing.name);
    }
    if (entry.listing.slug) {
      slugValues.add(entry.listing.slug);
    }
    if (entry.listing.place_id) {
      placeIdValues.add(entry.listing.place_id);
    }
  }

  const selection = "id, name, slug, place_id, updated_at";
  const chunkSize = 100;

  const fetchByValues = async (
    field: "name" | "slug" | "place_id",
    values: Set<string>,
    targetMap: Map<string, ExistingListingSummary>,
  ) => {
    if (values.size === 0) return;
    const valueArray = Array.from(values);
    for (const chunk of chunkArray(valueArray, chunkSize)) {
      const { data, error } = await supabase
        .from("listings")
        .select(selection)
        .in(field, chunk);

      if (error) {
        console.error(
          `Failed to preload duplicate lookup for field ${field}:`,
          error,
        );
        continue;
      }

      (data || []).forEach((row) => {
        const typedRow = row as Pick<
          Database["public"]["Tables"]["listings"]["Row"],
          "id" | "name" | "slug" | "place_id" | "updated_at"
        >;

        const summary: ExistingListingSummary = {
          id: typedRow.id,
          name: typedRow.name ?? null,
          slug: typedRow.slug ?? null,
          place_id: typedRow.place_id ?? null,
          updated_at: typedRow.updated_at ?? null,
        };

        const directValue =
          field === "name"
            ? summary.name
            : field === "slug"
              ? summary.slug
              : summary.place_id;

        storeExistingListing(targetMap, directValue, summary);
        storeExistingListing(context.byName, summary.name, summary);
        storeExistingListing(context.bySlug, summary.slug, summary);
        storeExistingListing(context.byPlaceId, summary.place_id, summary);
      });
    }
  };

  await Promise.all([
    fetchByValues("place_id", placeIdValues, context.byPlaceId),
    fetchByValues("slug", slugValues, context.bySlug),
    fetchByValues("name", nameValues, context.byName),
  ]);
}

type DuplicateMatchType = "place_id" | "slug" | "name";

function findExistingListingMatch(
  context: DuplicateLookupContext,
  listing: Database["public"]["Tables"]["listings"]["Row"],
): { match: ExistingListingSummary; reason: DuplicateMatchType } | null {
  const placeIdMatch = storeLookupMatch(context.byPlaceId, listing.place_id);
  if (placeIdMatch) {
    return { match: placeIdMatch, reason: "place_id" };
  }

  const slugMatch = storeLookupMatch(context.bySlug, listing.slug);
  if (slugMatch) {
    return { match: slugMatch, reason: "slug" };
  }

  const nameMatch = storeLookupMatch(context.byName, listing.name);
  if (nameMatch) {
    return { match: nameMatch, reason: "name" };
  }

  return null;
}

function storeLookupMatch(
  map: Map<string, ExistingListingSummary>,
  value: string | null,
): ExistingListingSummary | null {
  const key = normalizeLookupKey(value);
  if (!key) return null;
  return map.get(key) ?? null;
}

function findLocalDuplicate(
  context: DuplicateLookupContext,
  listing: Database["public"]["Tables"]["listings"]["Row"],
): { reason: DuplicateMatchType; row: number } | null {
  const placeIdKey = normalizeLookupKey(listing.place_id);
  if (placeIdKey) {
    const seenRow = context.seenPlaceIds.get(placeIdKey);
    if (typeof seenRow === "number") {
      return { reason: "place_id", row: seenRow };
    }
  }

  const slugKey = normalizeLookupKey(listing.slug);
  if (slugKey) {
    const seenRow = context.seenSlugs.get(slugKey);
    if (typeof seenRow === "number") {
      return { reason: "slug", row: seenRow };
    }
  }

  const nameKey = normalizeLookupKey(listing.name);
  if (nameKey) {
    const seenRow = context.seenNames.get(nameKey);
    if (typeof seenRow === "number") {
      return { reason: "name", row: seenRow };
    }
  }

  return null;
}

function registerLocalOccurrence(
  context: DuplicateLookupContext,
  listing: Database["public"]["Tables"]["listings"]["Row"],
  rowNumber: number,
): void {
  const placeIdKey = normalizeLookupKey(listing.place_id);
  if (placeIdKey && !context.seenPlaceIds.has(placeIdKey)) {
    context.seenPlaceIds.set(placeIdKey, rowNumber);
  }

  const slugKey = normalizeLookupKey(listing.slug);
  if (slugKey && !context.seenSlugs.has(slugKey)) {
    context.seenSlugs.set(slugKey, rowNumber);
  }

  const nameKey = normalizeLookupKey(listing.name);
  if (nameKey && !context.seenNames.has(nameKey)) {
    context.seenNames.set(nameKey, rowNumber);
  }
}

function registerPersistedListing(
  context: DuplicateLookupContext,
  listing: Database["public"]["Tables"]["listings"]["Row"],
  listingId: number,
): void {
  const summary: ExistingListingSummary = {
    id: listingId,
    name: listing.name ?? null,
    slug: listing.slug ?? null,
    place_id: listing.place_id ?? null,
    updated_at: listing.updated_at ?? null,
  };

  setExistingListing(context.byName, summary.name, summary);
  setExistingListing(context.bySlug, summary.slug, summary);
  setExistingListing(context.byPlaceId, summary.place_id, summary);
}

export async function POST(request: NextRequest) {
  let importHistory: ImportHistory | null = null;

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
        { status: 403 },
      );
    }

    const adminSupabase = await createServerSupabase({
      useServiceRole: true,
    });

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const options: ImportOptions = JSON.parse(
      (formData.get("options") as string) || "{}",
    );

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    if (!file.name.endsWith(".csv")) {
      return NextResponse.json(
        { error: "Only CSV files are supported" },
        { status: 400 },
      );
    }

    // Read and parse CSV
    const csvText = await file.text();
    const allRecords = parse(csvText, {
      skip_empty_lines: true,
      trim: true,
    });

    // Validate CSV structure
    const validation = validateCsvData(allRecords);
    if (!validation.isValid) {
      return NextResponse.json(
        { error: "Invalid CSV format", details: validation.errors },
        { status: 400 },
      );
    }

    const headers = allRecords[0];
    const records = allRecords.slice(1);

    const result: ImportResult = {
      success: true,
      totalProcessed: records.length,
      successful: 0,
      failed: 0,
      skipped: 0,
      fieldStats: {
        processed: 0,
        skipped: 0,
        errors: 0,
        details: {
          socialLinks: { processed: 0, skipped: 0 },
          coordinates: { processed: 0, skipped: 0, precisionIssues: 0 },
          openingHours: { processed: 0, skipped: 0, parseErrors: 0 },
          categories: { processed: 0, skipped: 0, notFound: 0 },
          phoneNumbers: { processed: 0, skipped: 0, invalid: 0 },
          emails: { processed: 0, skipped: 0, invalid: 0 },
          urls: { processed: 0, skipped: 0, invalid: 0 },
        },
      },
      errors: [],
    };

    // Preview mode - just return first 5 records
    if (options.preview) {
      const previewWarnings = records
        .flatMap((record: string[], index: number) =>
          getPreviewJsonWarningsForRecord(record, index + 2),
        )
        .slice(0, 100);

      result.preview = records
        .slice(0, 5)
        .map((record: string[], index: number) => {
          const obj: Record<string, string> = {};
          headers.forEach((header: string, i: number) => {
            obj[header] = record[i] || "";
          });
          return {
            row: index + 2,
            name: obj["name"] || "",
            ...obj,
          };
        });

      if (previewWarnings.length > 0) {
        result.previewWarnings = previewWarnings;
      }

      return NextResponse.json(result);
    }

    // Dry run mode - simulate the import without actually saving
    if (options.dryRun) {
      const simulated = await simulateImport(
        supabase,
        records,
        headers,
        options,
      );
      result.dryRun = simulated.map((row) => ({
        row: row.row,
        name: row.name || "",
        action:
          row.action === "create" ||
          row.action === "skip_duplicate" ||
          row.action === "error"
            ? row.action
            : "error",
        error: row.error,
        duplicateCheck: row.duplicateCheck,
        extraFields: row.listingData as
          | Record<string, string | number>
          | undefined,
      }));
      return NextResponse.json(result);
    }

    // Create import history record for actual imports only
    importHistory = await createImportHistory(supabase, {
      user_id: user.id,
      filename: file.name,
      total_records: records.length,
      successful_imports: 0,
      failed_imports: 0,
      status: "completed",
      import_type: "listings",
      started_at: new Date().toISOString(),
      rollback_available: true,
    });

    // Execute actual import with transaction
    const importResult = await executeTransactionalImport(
      supabase,
      adminSupabase,
      records,
      headers,
      options,
      importHistory,
      user.id,
    );

    // Update result
    result.successful = importResult.successful;
    result.failed = importResult.failed;
    result.skipped = importResult.skipped;
    result.fieldStats = importResult.fieldStats;
    result.errors = importResult.errors;
    const importHadErrors = importResult.failed > 0;
    result.success = !importHadErrors;
    result.status = importHadErrors ? "failed" : "completed";
    if (importHistory?.id) {
      result.importId = importHistory.id;
      result.rollbackAvailable = importHistory.rollback_available;
    }

    // Update import history
    await updateImportHistory(supabase, importHistory.id!, {
      successful_imports: result.successful,
      failed_imports: result.failed,
      completed_at: new Date().toISOString(),
      status: importHadErrors ? "failed" : "completed",
      imported_listing_ids: importResult.importedIds,
    });

    return NextResponse.json(result);
  } catch (error) {
    // Update import history on error
    if (importHistory?.id) {
      const supabase = await createServerSupabase();
      await updateImportHistory(supabase, importHistory.id, {
        status: "failed",
        error_details: error instanceof Error ? error.message : "Unknown error",
        completed_at: new Date().toISOString(),
      });
    }

    console.error("Import error:", error);
    return NextResponse.json(
      {
        error: "Import failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

async function transformRecordToListing(
  record: string[],
  supabase: SupabaseClient<Database>,
  fieldStats?: FieldStats,
  categoryContext?: CategoryLookupContext,
): Promise<ListingTransformResult> {
  // Detect CSV format based on first column
  // const isExportFormat =
  //   record[0] !== "DHA PHASE 2" && !record[0]?.includes("ChIJ"); // Export format starts with membership or actual data
  const isClientFormat =
    record[0]?.includes("ChIJ") || record[0] === "DHA PHASE 2"; // Client format starts with Place ID or header

  let mapping: Record<string, string | null | undefined> = {};

  if (isClientFormat) {
    // Client CSV format with Place ID first
    // Columns: Place ID, Membership, Name, Address, Phone, Email, Latitude/Longitude, Google map Link, Description, Website, Timings, Categories, Features, Keywords, Menu, Menu PDF, Deal & Discounts, D&D Notes, Bank Promotions, Brand Logo, Gallery link, Facebook, Whatsapp, Instagram, Youtube, , POC Name, Designation, Contact No., , Last Update
    const [
      placeId,
      membership,
      name,
      address,
      phone,
      email,
      latLng,
      googleMapLink,
      description,
      website,
      timings,
      categories,
      features,
      keywords,
      menu,
      menuPdf,
      deals,
      dealsNotes,
      bankPromotions,
      brandLogo,
      galleryLink,
      facebook,
      whatsapp,
      instagram,
      youtube,
      /* empty1, */
      pocName,
      designation,
      contactNo,
      /* empty2, */
      lastUpdate,
    ] = record;

    mapping = {
      placeId,
      membership,
      name,
      address,
      phone,
      email,
      latLng,
      googleMapLink,
      description,
      website,
      timings,
      categories,
      features,
      keywords,
      menu,
      menuPdf,
      deals,
      dealsNotes,
      bankPromotions,
      brandLogo,
      galleryLink,
      facebook,
      whatsapp,
      instagram,
      youtube,
      pocName,
      designation,
      contactNo,
      lastUpdate,
      // Default values for export format fields
      status: "draft",
      featured: "false",
      createdDate:
        typeof lastUpdate === "string" ? lastUpdate : new Date().toISOString(),
      displayOrder: "0",
      ownerId: null,
      galleryImages: typeof galleryLink === "string" ? galleryLink : null,
      menuSections: typeof menu === "string" ? menu : null,
    };
  } else {
    // Export CSV format (from our system)
    // Legacy columns are preserved; new columns are appended after Last Update.
    // Base columns:
    // Membership, Name, Address, Phone, Email, Latitude/Longitude, Google map Link,
    // Description, Website, Timings, Categories, Features, Status, Featured,
    // Created Date, Display Order, Owner ID, Place ID, Gallery Images, Menu Sections,
    // Menu PDF, Deal & Discounts, D&D Notes, Bank Promotions, Facebook, Whatsapp,
    // Instagram, Youtube, Last Update
    const membership = record[0];
    const name = record[1];
    const address = record[2];
    const phone = record[3];
    const email = record[4];
    const latLng = record[5];
    const googleMapLink = record[6];
    const description = record[7];
    const website = record[8];
    const timings = record[9];
    const categories = record[10];
    const features = record[11];
    const status = record[12];
    const featured = record[13];
    const createdDate = record[14];
    const displayOrder = record[15];
    const ownerId = record[16];
    const placeId = record[17];
    const galleryImages = record[18];
    const menuSections = record[19];
    const menuPdf = record[20];
    const deals = record[21];
    const dealsNotes = record[22];
    const bankPromotions = record[23];
    const facebook = record[24];
    const whatsapp = record[25];
    const instagram = record[26];
    const youtube = record[27];
    const lastUpdate = record[28];

    // Appended v2 columns (optional for backward compatibility)
    const peekabooId = record[29];
    const parkingInformation = record[30];
    const parkingAmenities = record[31];
    const customAttributes = record[32];
    const dealsJson = record[33];
    const branches = record[34];
    const branchOpeningHours = record[35];

    mapping = {
      placeId,
      membership,
      name,
      address,
      phone,
      email,
      latLng,
      googleMapLink,
      description,
      website,
      timings,
      categories,
      features,
      status,
      featured,
      createdDate,
      displayOrder,
      ownerId,
      galleryImages,
      menuSections,
      menuPdf,
      deals,
      dealsNotes,
      bankPromotions,
      dealsJson,
      branches,
      branchOpeningHours,
      peekabooId,
      parkingInformation,
      parkingAmenities,
      customAttributes,
      facebook,
      whatsapp,
      instagram,
      youtube,
      lastUpdate,
      // Default values for client format fields
      keywords: "",
      menu: menuSections,
      brandLogo: "",
      galleryLink: galleryImages,
      pocName: "",
      designation: "",
      contactNo: "",
    };
  }

  // Extract variables from mapping
  const placeId = mapping.placeId as string | undefined;
  const membership = mapping.membership as string | undefined;
  const name = mapping.name as string | undefined;
  const address = mapping.address as string | undefined;
  const phone = mapping.phone as string | undefined;
  const email = mapping.email as string | undefined;
  const latLng = mapping.latLng as string | undefined;
  const googleMapLink = mapping.googleMapLink as string | undefined;
  const description = mapping.description as string | undefined;
  const website = mapping.website as string | undefined;
  const categories = mapping.categories as string | undefined;
  const status = mapping.status as string | undefined;
  const featured = mapping.featured as string | boolean | undefined;
  const createdDate = mapping.createdDate as string | undefined;
  const displayOrder = mapping.displayOrder as string | number | undefined;
  const ownerId = mapping.ownerId as string | undefined;
  const menuPdf = mapping.menuPdf as string | undefined;
  const peekabooId = mapping.peekabooId as string | undefined;
  const parkingInformation = mapping.parkingInformation as string | undefined;
  const parkingAmenities = mapping.parkingAmenities as string | undefined;
  const customAttributes = mapping.customAttributes as string | undefined;
  const dealsJson = mapping.dealsJson as string | undefined;
  const branches = mapping.branches as string | undefined;
  const branchOpeningHours = mapping.branchOpeningHours as string | undefined;
  const facebook = mapping.facebook as string | undefined;
  const whatsapp = mapping.whatsapp as string | undefined;
  const instagram = mapping.instagram as string | undefined;
  const youtube = mapping.youtube as string | undefined;

  // Parse latitude/longitude with proper precision
  const coords = latLng ? latLng.split(",") : [null, null];
  const latitude = coords[0] ? parseFloat(coords[0].trim()) : null;
  const longitude = coords[1] ? parseFloat(coords[1].trim()) : null;

  // Track coordinate processing
  if (fieldStats) {
    if (latitude && longitude) {
      fieldStats.details.coordinates.processed++;
      // Check for precision issues (should be at least 6 decimal places for good accuracy)
      const latPrecision = latitude.toString().split(".")[1]?.length || 0;
      const lngPrecision = longitude.toString().split(".")[1]?.length || 0;
      if (latPrecision < 6 || lngPrecision < 6) {
        fieldStats.details.coordinates.precisionIssues++;
      }
    } else {
      fieldStats.details.coordinates.skipped++;
    }
  }

  // Handle multiple categories properly with caching
  let categoryId = null;
  if (categories && categories.trim()) {
    const categoryNames = categories
      .split(",")
      .map((c: string) => c.trim())
      .filter(Boolean);

    let attemptedLookup = false;

    for (const categoryName of categoryNames) {
      if (!categoryName) continue;
      if (categoryName.toLowerCase() === "n/a") continue;

      attemptedLookup = true;
      const resolvedId = await resolveCategoryId(
        supabase,
        categoryName,
        categoryContext,
      );

      if (resolvedId) {
        categoryId = resolvedId;
        if (fieldStats) {
          fieldStats.details.categories.processed++;
        }
        break;
      }

      if (fieldStats) {
        fieldStats.details.categories.notFound++;
      }
    }

    if (fieldStats && (!attemptedLookup || !categoryId)) {
      fieldStats.details.categories.skipped++;
    }
  } else {
    if (fieldStats) fieldStats.details.categories.skipped++;
  }

  // Generate slug
  const slug = generateSlug(
    sanitizeText(name ?? "") || `listing-${Date.now()}`,
  );

  // Process social links and track statistics
  const facebookUrl = sanitizeListingField(facebook, "url");
  const instagramUrl = sanitizeListingField(instagram, "url");
  const whatsappNumber = sanitizeListingField(whatsapp, "phone");
  const youtubeUrl = sanitizeListingField(youtube, "url");

  if (fieldStats) {
    if (facebookUrl) fieldStats.details.socialLinks.processed++;
    else if (facebook && facebook.trim())
      fieldStats.details.socialLinks.skipped++;

    if (instagramUrl) fieldStats.details.socialLinks.processed++;
    else if (instagram && instagram.trim())
      fieldStats.details.socialLinks.skipped++;

    if (whatsappNumber) fieldStats.details.socialLinks.processed++;
    else if (whatsapp && whatsapp.trim())
      fieldStats.details.socialLinks.skipped++;

    if (youtubeUrl) fieldStats.details.socialLinks.processed++;
    else if (youtube && youtube.trim())
      fieldStats.details.socialLinks.skipped++;
  }

  // Process phone and email with validation tracking
  const processedPhone = sanitizeListingField(phone, "phone");
  const processedEmail = sanitizeListingField(email, "email");

  if (fieldStats) {
    if (processedPhone) fieldStats.details.phoneNumbers.processed++;
    else if (phone && phone.trim()) fieldStats.details.phoneNumbers.invalid++;
    else fieldStats.details.phoneNumbers.skipped++;

    if (processedEmail) fieldStats.details.emails.processed++;
    else if (
      email &&
      email.trim() &&
      !["n/a", "na", "none", "null", ""].includes(email.toLowerCase().trim())
    )
      fieldStats.details.emails.invalid++;
    else fieldStats.details.emails.skipped++;
  }

  // Process URLs with validation tracking
  const processedWebsite = sanitizeListingField(website, "url");
  const processedGoogleMap = sanitizeListingField(googleMapLink, "url");
  const processedMenuPdf = sanitizeListingField(menuPdf, "url");

  if (fieldStats) {
    if (processedWebsite) fieldStats.details.urls.processed++;
    else if (website && website.trim()) fieldStats.details.urls.invalid++;
    else fieldStats.details.urls.skipped++;

    if (processedGoogleMap) fieldStats.details.urls.processed++;
    else if (googleMapLink && googleMapLink.trim())
      fieldStats.details.urls.invalid++;
    else fieldStats.details.urls.skipped++;

    if (processedMenuPdf) fieldStats.details.urls.processed++;
    else if (menuPdf && menuPdf.trim()) fieldStats.details.urls.invalid++;
    else fieldStats.details.urls.skipped++;
  }

  const sanitizedOwnerId =
    typeof ownerId === "string" ? sanitizeText(ownerId) : "";
  const normalizedOwnerId =
    sanitizedOwnerId && UUID_REGEX.test(sanitizedOwnerId)
      ? sanitizedOwnerId
      : null;

  const parsedCustomAttributes = parseJsonObject(customAttributes);
  const parsedParkingAmenities = parseStringArray(parkingAmenities);
  const normalizedPeekabooId =
    typeof peekabooId === "string" && peekabooId.trim()
      ? Number.parseInt(peekabooId, 10)
      : null;

  const listingRow: Database["public"]["Tables"]["listings"]["Row"] = {
    address:
      typeof address === "string"
        ? String(sanitizeListingField(address, "text") ?? address)
        : null,
    category_id: typeof categoryId === "number" ? categoryId : null,
    created_at: createdDate
      ? new Date(createdDate).toISOString()
      : new Date().toISOString(),
    created_by: null,
    custom_attributes:
      (parsedCustomAttributes as Database["public"]["Tables"]["listings"]["Row"]["custom_attributes"]) ||
      null,
    description:
      typeof description === "string"
        ? String(sanitizeListingField(description, "text") ?? description)
        : null,
    display_order:
      typeof displayOrder === "number"
        ? displayOrder
        : typeof displayOrder === "string"
          ? Number(sanitizeListingField(displayOrder, "number")) || 0
          : null,
    email: typeof processedEmail === "string" ? processedEmail : null,
    facebook_url: typeof facebookUrl === "string" ? facebookUrl : null,
    google_maps_url:
      typeof processedGoogleMap === "string" ? processedGoogleMap : null,
    id: 0, // Placeholder, will be set by DB
    instagram_url: typeof instagramUrl === "string" ? instagramUrl : null,
    is_featured:
      typeof featured === "boolean"
        ? featured
        : typeof featured === "string"
          ? Boolean(sanitizeListingField(featured, "boolean"))
          : false,
    latitude:
      latitude && !isNaN(latitude) ? parseFloat(latitude.toFixed(8)) : null,
    longitude:
      longitude && !isNaN(longitude) ? parseFloat(longitude.toFixed(8)) : null,
    menu_pdf_url:
      typeof processedMenuPdf === "string" ? processedMenuPdf : null,
    name:
      typeof name === "string"
        ? String(sanitizeListingField(name, "text") ?? name)
        : "",
    owner_id: normalizedOwnerId,
    phone_number: typeof processedPhone === "string" ? processedPhone : null,
    place_id: typeof placeId === "string" ? sanitizeText(placeId) : null,
    review_notes: null,
    reviewed_at: null,
    reviewed_by: null,
    submitted_at: null,
    show_member_badge: (() => {
      // membership may be a string like "Member" / "Non-Member", or boolean
      if (typeof membership === "boolean") return membership;
      const normalized = normalizeOptionalText(
        typeof membership === "string" ? membership : undefined,
      );
      if (!normalized) return false;
      const v = normalized.trim().toLowerCase();

      // Explicit positive and negative tokens to avoid substring mistakes
      const memberPositive = new Set([
        "member",
        "member-only",
        "member only",
        "yes",
        "true",
        "1",
      ]);
      const memberNegative = new Set([
        "non-member",
        "non member",
        "non",
        "no",
        "false",
        "0",
      ]);

      if (memberPositive.has(v)) return true;
      if (memberNegative.has(v)) return false;

      // Defensive rule: if value has a 'non' prefix, treat as non-member
      if (v.startsWith("non")) return false;

      // Conservative default: treat as non-member
      return false;
    })(),
    slug: typeof slug === "string" ? slug : String(slug),
    status:
      typeof status === "string" &&
      ["draft", "published", "archived"].includes(sanitizeText(status))
        ? (sanitizeText(
            status,
          ) as Database["public"]["Enums"]["listing_status"])
        : "draft",
    updated_at: createdDate
      ? new Date(createdDate).toISOString()
      : new Date().toISOString(),
    website: typeof processedWebsite === "string" ? processedWebsite : null,
    whatsapp_number: typeof whatsappNumber === "string" ? whatsappNumber : null,
    youtube_url: typeof youtubeUrl === "string" ? youtubeUrl : null,
    parking_information:
      typeof parkingInformation === "string"
        ? (sanitizeListingField(parkingInformation, "text") as string | null)
        : null,
    parking_amenities:
      (parsedParkingAmenities as Database["public"]["Tables"]["listings"]["Row"]["parking_amenities"]) ||
      null,
    peekaboo_id:
      normalizedPeekabooId !== null && !Number.isNaN(normalizedPeekabooId)
        ? normalizedPeekabooId
        : null,
    location: null, // Will be auto-populated by trigger from lat/lng
  };

  return {
    listing: listingRow,
    meta: {
      dealsFlag:
        typeof mapping.deals === "boolean"
          ? mapping.deals
          : typeof mapping.deals === "string"
            ? normalizeOptionalFlag(mapping.deals)
            : null,
      dealsNotes:
        typeof mapping.dealsNotes === "string"
          ? normalizeOptionalText(mapping.dealsNotes)
          : null,
      bankPromotions:
        typeof mapping.bankPromotions === "string"
          ? normalizeOptionalText(mapping.bankPromotions)
          : null,
      dealsJson: typeof dealsJson === "string" ? normalizeOptionalText(dealsJson) : null,
      branchesJson:
        typeof branches === "string" ? normalizeOptionalText(branches) : null,
      branchOpeningHoursJson:
        typeof branchOpeningHours === "string"
          ? normalizeOptionalText(branchOpeningHours)
          : null,
      sourceFormat: isClientFormat ? "client" : "export",
    },
  };
}

// Helper functions for import history management
async function createImportHistory(
  supabase: SupabaseClient<Database>,
  history: Omit<ImportHistory, "id">,
): Promise<ImportHistory> {
  // Ensure status is one of allowed values
  const allowedStatus = ["completed", "failed", "rolled_back"];
  const safeHistory = {
    ...history,
    status: allowedStatus.includes(history.status as string)
      ? history.status
      : "completed",
  };
  const { data, error } = await supabase
    .from("import_history")
    .insert(safeHistory)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create import history: ${error.message}`);
  }

  // Cast status to allowed union type
  if (data) {
    (data as Database["public"]["Tables"]["import_history"]["Row"]).status =
      data.status as "completed" | "failed" | "rolled_back";
  }
  return data as ImportHistory;
}

async function updateImportHistory(
  supabase: SupabaseClient<Database>,
  id: number,
  updates: Partial<ImportHistory>,
): Promise<void> {
  // Remove id from updates if present
  const safeUpdates = { ...updates };
  delete safeUpdates.id;
  const { error } = await supabase
    .from("import_history")
    .update(safeUpdates as Omit<ImportHistory, "id">)
    .eq("id", id);

  if (error) {
    console.error("Failed to update import history:", error);
  }
}

// Simulate import for dry run
async function simulateImport(
  supabase: SupabaseClient<Database>,
  records: string[][],
  headers: string[],
  options: ImportOptions,
): Promise<SimulatedImportResult[]> {
  const rowResults = new Map<number, SimulatedImportResult>();
  const validEntries: Array<{
    record: string[];
    rowNumber: number;
    listing: Database["public"]["Tables"]["listings"]["Row"];
  }> = [];

  const categoryContext = createCategoryLookupContext();

  for (let index = 0; index < records.length; index++) {
    const record = records[index];
    const rowNumber = index + 2;

    if (!isValidListingRow(record)) {
      rowResults.set(rowNumber, {
        row: rowNumber,
        name: record[2] || "Unknown",
        action: "skip_invalid",
        error: "Invalid or metadata row - missing required fields",
      });
      continue;
    }

    try {
      const { listing } = await transformRecordToListing(
        record,
        supabase,
        undefined,
        categoryContext,
      );

      validEntries.push({ record, rowNumber, listing });
    } catch (error) {
      rowResults.set(rowNumber, {
        row: rowNumber,
        name: record[2] || "Unknown",
        action: "error",
        duplicateCheck: undefined,
        listingData: undefined,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  const uniqueNames = Array.from(
    new Set(
      validEntries
        .map((entry) =>
          typeof entry.listing.name === "string" && entry.listing.name
            ? entry.listing.name
            : "",
        )
        .filter(Boolean),
    ),
  );

  let existingNamesMap = new Map<string, boolean>();
  if (options.skipDuplicates && uniqueNames.length > 0) {
    const { data: existingListings } = await supabase
      .from("listings")
      .select("name")
      .in("name", uniqueNames);

    if (existingListings) {
      existingNamesMap = new Map(
        existingListings.map((item: { name: string }) => [item.name, true]),
      );
    }
  }

  for (const entry of validEntries) {
    const { listing, rowNumber } = entry;
    const listingName =
      typeof listing.name === "string" && listing.name
        ? listing.name
        : "Unknown";

    let duplicateCheck: { found: boolean; existingId: null } | null = null;
    if (options.skipDuplicates && listing.name) {
      duplicateCheck = existingNamesMap.has(listing.name)
        ? { found: true, existingId: null }
        : null;
    }

    rowResults.set(rowNumber, {
      row: rowNumber,
      name: listingName,
      action: duplicateCheck ? "skip_duplicate" : "create",
      duplicateCheck: duplicateCheck ?? undefined,
      listingData: {
        ...listing,
        owner_id: listing.owner_id ? "[SET]" : null,
      },
      error: undefined,
    });
  }

  return Array.from(rowResults.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, value]) => value);
}

// Execute transactional import
async function executeTransactionalImport(
  supabase: SupabaseClient<Database>,
  adminSupabase: SupabaseClient<Database>,
  records: string[][],
  _headers: string[],
  options: ImportOptions,
  importHistory: ImportHistory,
  userId: string,
): Promise<TransactionalImportResult> {
  const result = {
    successful: 0,
    failed: 0,
    skipped: 0,
    updated: 0,
    fieldStats: {
      processed: 0,
      skipped: 0,
      errors: 0,
      details: {
        socialLinks: { processed: 0, skipped: 0 },
        coordinates: { processed: 0, skipped: 0, precisionIssues: 0 },
        openingHours: { processed: 0, skipped: 0, parseErrors: 0 },
        categories: { processed: 0, skipped: 0, notFound: 0 },
        phoneNumbers: { processed: 0, skipped: 0, invalid: 0 },
        emails: { processed: 0, skipped: 0, invalid: 0 },
        urls: { processed: 0, skipped: 0, invalid: 0 },
      },
    },
    errors: [] as Array<{
      row: number;
      name: string;
      error: string;
      field?: string;
    }>,
    importedIds: [] as number[],
    updatedIds: [] as number[],
  };

  const bankContext = createBankLookupContext();
  const categoryContext = createCategoryLookupContext();
  const duplicateContext = createDuplicateLookupContext();

  const preparedEntries: PreparedListingEntry[] = [];

  for (let index = 0; index < records.length; index++) {
    const record = records[index];
    const rowNumber = index + 2;

    if (!isValidListingRow(record)) {
      result.failed += 1;
      result.fieldStats.errors += 1;
      result.errors.push({
        row: rowNumber,
        name: deriveRecordName(record),
        error: "Invalid or metadata row - missing required fields",
      });
      continue;
    }

    try {
      const transformed = await transformRecordToListing(
        record,
        supabase,
        result.fieldStats,
        categoryContext,
      );
      preparedEntries.push({
        record,
        rowNumber,
        listing: transformed.listing,
        meta: transformed.meta,
      });
    } catch (error) {
      result.failed += 1;
      result.fieldStats.errors += 1;
      const errorMessage =
        error instanceof Error ? error.message : "Failed to transform record";
      result.errors.push({
        row: rowNumber,
        name: deriveRecordName(record),
        error: errorMessage,
      });
    }
  }

  if (preparedEntries.length > 0) {
    await populateDuplicateLookupContext(
      supabase,
      preparedEntries,
      duplicateContext,
    );
  }

  // Process records in optimized batches for better transaction control
  const batchSize = 20;
  const batches: PreparedListingEntry[][] = [];

  for (let i = 0; i < preparedEntries.length; i += batchSize) {
    batches.push(preparedEntries.slice(i, i + batchSize));
  }

  for (const batch of batches) {
    try {
      // Use RPC function for transactional batch processing
      const batchResult = await processBatchTransactionally(
        supabase,
        adminSupabase,
        batch,
        options,
        importHistory.id!,
        result.fieldStats,
        userId,
        duplicateContext,
        bankContext,
      );

      result.successful += batchResult.successful;
      result.failed += batchResult.failed;
      result.skipped += batchResult.skipped || 0;
      result.updated += batchResult.updated || 0;
      result.errors.push(...batchResult.errors);
      result.importedIds.push(...batchResult.importedIds);
      if (batchResult.updatedIds) {
        result.updatedIds.push(...batchResult.updatedIds);
      }
    } catch (batchError) {
      console.error("Batch processing error:", batchError);
      result.failed += batch.length;
      const errorMessage =
        batchError instanceof Error
          ? batchError.message
          : "Unknown batch error";
      for (const entry of batch) {
        result.errors.push({
          row: entry.rowNumber,
          name: deriveRecordName(entry.record),
          error: errorMessage,
        });
      }
      result.fieldStats.errors += batch.length;
    }
  }

  return result;
}

// Process batch with transaction
async function processBatchTransactionally(
  supabase: SupabaseClient<Database>,
  adminSupabase: SupabaseClient<Database>,
  batch: PreparedListingEntry[],
  options: ImportOptions,
  importId: number,
  fieldStats: FieldStats,
  userId: string,
  duplicateContext: DuplicateLookupContext,
  bankContext: BankLookupContext,
): Promise<TransactionalImportResult> {
  const result = {
    successful: 0,
    failed: 0,
    skipped: 0,
    updated: 0,
    errors: [] as Array<{
      row: number;
      name: string;
      error: string;
      field?: string;
    }>,
    importedIds: [] as number[],
    updatedIds: [] as number[],
  };

  for (const entry of batch) {
    const { record, rowNumber, listing: listingData, meta } = entry;
    const listingName =
      typeof listingData.name === "string" && listingData.name
        ? listingData.name
        : deriveRecordName(record);

    try {
      const localDuplicate = findLocalDuplicate(duplicateContext, listingData);

      if (localDuplicate) {
        result.skipped++;
        if (fieldStats) {
          fieldStats.skipped++;
        }
        result.errors.push({
          row: rowNumber,
          name: listingName,
          error: `Duplicate within import (matched by ${localDuplicate.reason}) – first seen at row ${localDuplicate.row}`,
        });
        continue;
      }

      let existingListing: ExistingListingSummary | null = null;
      let existingMatchReason: DuplicateMatchType | null = null;
      if (options.skipDuplicates || options.updateExisting) {
        const existingMatch = findExistingListingMatch(
          duplicateContext,
          listingData,
        );
        if (existingMatch) {
          existingListing = existingMatch.match;
          existingMatchReason = existingMatch.reason;
        }
      }

      if (
        existingListing &&
        options.skipDuplicates &&
        !options.updateExisting
      ) {
        result.skipped++;
        if (fieldStats) {
          fieldStats.skipped++;
        }
        result.errors.push({
          row: rowNumber,
          name: listingName,
          error: `Duplicate listing found in database (matched by ${
            existingMatchReason ?? "an identifier"
          })`,
        });
        continue;
      }

      registerLocalOccurrence(duplicateContext, listingData, rowNumber);

      const existingListingId =
        existingListing && options.updateExisting ? existingListing.id : null;
      const isUpdate = existingListingId !== null;

      // Insert or update listing with transaction
      const { data, error } = await adminSupabase.rpc(
        "import_listing_transactionally",
        {
          listing_data: {
            ...listingData,
            import_id: importId,
            user_id: userId,
            existing_listing_id: existingListingId,
            is_update: isUpdate,
          } as unknown as Database["public"]["Functions"]["import_listing_transactionally"]["Args"]["listing_data"],
          record_data: record,
        },
      );

      if (error) {
        throw error;
      }

      // Cast RPC response to expected type
      const rpcResult = data as
        | {
            status: "success" | "skipped" | "error";
            listing_id?: number;
            opening_hours_processed?: number;
            reason?: string;
            error?: string;
          }
        | undefined;

      if (rpcResult && rpcResult.status === "success" && rpcResult.listing_id) {
        if (fieldStats) {
          fieldStats.processed++;
        }
        if (isUpdate) {
          result.updated = (result.updated || 0) + 1;
          result.updatedIds = result.updatedIds || [];
          result.updatedIds.push(rpcResult.listing_id);
        } else {
          result.successful++;
          result.importedIds.push(rpcResult.listing_id);
        }

        registerPersistedListing(
          duplicateContext,
          listingData,
          rpcResult.listing_id,
        );

        // Update opening hours count from RPC response
        if (
          rpcResult.opening_hours_processed &&
          rpcResult.opening_hours_processed > 0
        ) {
          if (fieldStats) {
            fieldStats.details.openingHours.processed +=
              rpcResult.opening_hours_processed;
          }
        }

        if (shouldProcessDeals(meta)) {
          const dealSyncResult = await syncDealsForListing(
            supabase,
            rpcResult.listing_id,
            meta,
            bankContext,
          );

          if (!dealSyncResult.success) {
            throw new Error(dealSyncResult.error || "Failed to sync deals");
          }
        }

        if (shouldProcessBranches(meta)) {
          const branchSyncResult = await syncBranchesForListing(
            supabase,
            rpcResult.listing_id,
            meta,
          );

          if (!branchSyncResult.success) {
            throw new Error(
              branchSyncResult.error || "Failed to sync listing branches",
            );
          }
        }
      } else if (rpcResult && rpcResult.status === "skipped") {
        result.skipped++;
        if (fieldStats) {
          fieldStats.skipped++;
        }
        // Log skipped reason for debugging
        console.log(
          `Row ${rowNumber} skipped: ${rpcResult.reason || "Unknown reason"}`,
        );
      } else if (rpcResult && rpcResult.status === "error") {
        throw new Error(`RPC Error: ${rpcResult.error || "Unknown RPC error"}`);
      } else {
        // Handle unexpected response format
        console.error(`Unexpected RPC response for row ${rowNumber}:`, data);
        throw new Error("Unexpected response from import transaction");
      }
    } catch (error) {
      result.failed++;
      if (fieldStats) {
        fieldStats.errors++;
      }
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(`Error processing row ${rowNumber}:`, error);

      result.errors.push({
        row: rowNumber,
        name: listingName,
        error: errorMessage,
      });
    }
  }

  return {
    ...result,
    fieldStats,
  };
}

function createBankLookupContext(): BankLookupContext {
  return {
    loaded: false,
    entries: [],
    lookup: new Map<string, BankLookupEntry>(),
  };
}

function normalizeBoolean(
  value: ListingRecordMeta["dealsFlag"],
): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return null;

    if (["true", "yes", "1"].includes(normalized)) {
      return true;
    }

    if (["false", "no", "0"].includes(normalized)) {
      return false;
    }
  }

  return null;
}

function shouldProcessDeals(meta: ListingRecordMeta): boolean {
  const normalizedFlag = normalizeBoolean(meta.dealsFlag ?? null);
  const notes =
    typeof meta.dealsNotes === "string" ? meta.dealsNotes.trim() : "";
  const bankPromos =
    typeof meta.bankPromotions === "string" ? meta.bankPromotions.trim() : "";
  const dealsJson =
    typeof meta.dealsJson === "string" ? meta.dealsJson.trim() : "";

  return (
    normalizedFlag !== null ||
    Boolean(notes) ||
    Boolean(bankPromos) ||
    Boolean(dealsJson)
  );
}

function shouldProcessBranches(meta: ListingRecordMeta): boolean {
  const branchesJson =
    typeof meta.branchesJson === "string" ? meta.branchesJson.trim() : "";
  const branchHoursJson =
    typeof meta.branchOpeningHoursJson === "string"
      ? meta.branchOpeningHoursJson.trim()
      : "";

  return Boolean(branchesJson) || Boolean(branchHoursJson);
}

function parseGeneralDeals(rawValue?: string | null): ParsedGeneralDeal[] {
  if (!rawValue) return [];
  const trimmed = rawValue.trim();
  if (!trimmed) return [];

  const results: ParsedGeneralDeal[] = [];

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (!item) continue;

          const isActive =
            item.is_active === undefined ? true : Boolean(item.is_active);
          if (!isActive) continue;

          const title = typeof item.title === "string" ? item.title.trim() : "";
          if (!title) continue;

          const discountCandidate =
            typeof item.discount === "string"
              ? item.discount
              : typeof item.discount_value === "string"
                ? item.discount_value
                : null;

          const description =
            typeof item.description === "string"
              ? item.description.trim()
              : null;

          results.push({
            title,
            discountValue: discountCandidate?.trim() || null,
            description,
          });
        }
      }
    } catch (error) {
      console.warn("Unable to parse general deals JSON:", error);
    }

    if (results.length > 0) {
      return results;
    }
  }

  const entries = trimmed
    .split(/\s*\|\s*|\s*;\s*/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  for (const entry of entries) {
    const [titlePart, ...detailParts] = entry.split(":");
    const title = (titlePart || "").trim();
    if (!title) continue;

    const detail = detailParts.join(":").trim();

    results.push({
      title,
      discountValue: detail ? detail : null,
    });
  }

  return results;
}

function parseBankPromotions(rawValue?: string | null): ParsedBankDeal[] {
  if (!rawValue) return [];
  const trimmed = rawValue.trim();
  if (!trimmed) return [];

  const results: ParsedBankDeal[] = [];

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (!item) continue;

          const isActive =
            item.is_active === undefined ? true : Boolean(item.is_active);
          if (!isActive) continue;

          const bankNameCandidate =
            typeof item.bank === "string"
              ? item.bank
              : typeof item.bank_name === "string"
                ? item.bank_name
                : null;

          const title = typeof item.title === "string" ? item.title.trim() : "";
          const discountCandidate =
            typeof item.discount === "string"
              ? item.discount
              : typeof item.discount_value === "string"
                ? item.discount_value
                : null;
          const description =
            typeof item.description === "string"
              ? item.description.trim()
              : null;

          if (!title && !discountCandidate && !bankNameCandidate) {
            continue;
          }

          results.push({
            title: title || (bankNameCandidate || "").trim(),
            discountValue: discountCandidate?.trim() || null,
            description,
            bankName: bankNameCandidate ? bankNameCandidate.trim() : null,
          });
        }
      }
    } catch (error) {
      console.warn("Unable to parse bank promotions JSON:", error);
    }

    if (results.length > 0) {
      return results;
    }
  }

  return results;
}

function parseDealsJson(rawValue?: string | null): ParsedDealJsonRecord[] {
  if (!rawValue) return [];
  const parsed = safeJsonParse(rawValue);
  if (!Array.isArray(parsed)) return [];

  const records: ParsedDealJsonRecord[] = [];

  for (const entry of parsed) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      continue;
    }

    const item = entry as Record<string, unknown>;
    const title =
      typeof item.title === "string" ? item.title.trim() : "";
    if (!title) continue;

    const dealType =
      item.deal_type === "bank_discount" ? "bank_discount" : "general";

    const bankId =
      typeof item.bank_id === "number"
        ? item.bank_id
        : typeof item.bank_id === "string" && item.bank_id.trim()
          ? Number.parseInt(item.bank_id, 10)
          : null;

    const validCardVariants = Array.isArray(item.valid_card_variants)
      ? item.valid_card_variants
          .map((v) => (typeof v === "number" ? v : Number.parseInt(String(v), 10)))
          .filter((v) => !Number.isNaN(v))
      : null;

    records.push({
      title,
      description:
        typeof item.description === "string" ? item.description.trim() || null : null,
      dealType,
      bankId: bankId !== null && !Number.isNaN(bankId) ? bankId : null,
      discountValue:
        typeof item.discount_value === "string"
          ? item.discount_value.trim() || null
          : null,
      isActive: item.is_active === undefined ? true : Boolean(item.is_active),
      startDate:
        typeof item.start_date === "string" ? item.start_date.trim() || null : null,
      endDate:
        typeof item.end_date === "string" ? item.end_date.trim() || null : null,
      validCardVariants:
        validCardVariants && validCardVariants.length > 0 ? validCardVariants : null,
      metadata: parseJsonObject(
        typeof item.metadata === "string"
          ? item.metadata
          : item.metadata
            ? JSON.stringify(item.metadata)
            : null
      ),
    });
  }

  return records;
}

function normalizeBankKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function ensureBankLookupLoaded(
  supabase: SupabaseClient<Database>,
  bankContext: BankLookupContext,
): Promise<void> {
  if (bankContext.loaded) {
    return;
  }

  const { data: banks, error } = await supabase
    .from("banks")
    .select("id, name, code");

  if (error) {
    console.error("Failed to load banks for deals import:", error);
    bankContext.loaded = true;
    return;
  }

  const entries: BankLookupEntry[] = (banks || []).map((bank) => {
    const key = normalizeBankKey(bank.name || String(bank.id));
    const entry: BankLookupEntry = {
      id: bank.id,
      name: bank.name,
      code: bank.code,
      key,
    };

    bankContext.lookup.set(key, entry);
    if (bank.code) {
      bankContext.lookup.set(normalizeBankKey(bank.code), entry);
    }

    return entry;
  });

  bankContext.entries = entries;
  bankContext.loaded = true;
}

function findBankIdForName(
  bankContext: BankLookupContext,
  bankName: string | null,
): number | null {
  if (!bankName) return null;
  const normalized = normalizeBankKey(bankName);
  if (!normalized) return null;

  const direct = bankContext.lookup.get(normalized);
  if (direct) {
    return direct.id;
  }

  for (const entry of bankContext.entries) {
    if (entry.key.includes(normalized) || normalized.includes(entry.key)) {
      return entry.id;
    }

    if (
      entry.name &&
      entry.name.toLowerCase().includes(bankName.trim().toLowerCase())
    ) {
      return entry.id;
    }
  }

  return null;
}

async function syncDealsForListing(
  supabase: SupabaseClient<Database>,
  listingId: number,
  meta: ListingRecordMeta,
  bankContext: BankLookupContext,
): Promise<{ success: boolean; error?: string }> {
  const normalizedFlag = normalizeBoolean(meta.dealsFlag ?? null);
  const dealsFromJson = parseDealsJson(meta.dealsJson);
  const generalDeals = parseGeneralDeals(meta.dealsNotes);
  const bankDeals = parseBankPromotions(meta.bankPromotions);

  if (bankDeals.length > 0) {
    await ensureBankLookupLoaded(supabase, bankContext);
    for (const deal of bankDeals) {
      deal.bankId = findBankIdForName(bankContext, deal.bankName ?? null);
    }
  }

  const hasExplicitFlag = normalizedFlag !== null;
  const hasDealsData =
    dealsFromJson.length > 0 || generalDeals.length > 0 || bankDeals.length > 0;

  if (!hasExplicitFlag && !hasDealsData) {
    return { success: true };
  }

  const payload: Database["public"]["Tables"]["deals"]["Insert"][] = [];

  if (dealsFromJson.length > 0) {
    dealsFromJson.forEach((deal) => {
      payload.push({
        listing_id: listingId,
        title: deal.title,
        description: deal.description,
        deal_type: deal.dealType,
        discount_value: deal.discountValue,
        bank_id: deal.bankId,
        is_active: deal.isActive,
        start_date: deal.startDate,
        end_date: deal.endDate,
        valid_card_variants: deal.validCardVariants,
        metadata:
          (deal.metadata as Database["public"]["Tables"]["deals"]["Insert"]["metadata"]) ||
          null,
      });
    });
  }

  if (dealsFromJson.length === 0) {
    generalDeals.forEach((deal) => {
      payload.push({
        listing_id: listingId,
        title: deal.title,
        description: deal.description ?? null,
        deal_type: "general",
        discount_value: deal.discountValue,
        bank_id: null,
        is_active: true,
        start_date: null,
        end_date: null,
        valid_card_variants: null,
      });
    });

    bankDeals.forEach((deal, index) => {
      const resolvedBankId =
        typeof deal.bankId === "number" ? deal.bankId : null;
      const hasBank = resolvedBankId !== null;

      payload.push({
        listing_id: listingId,
        title: deal.title || deal.bankName || `Bank Deal ${index + 1}`,
        description:
          deal.description ??
          (!hasBank && deal.bankName ? `Bank: ${deal.bankName}` : null),
        deal_type: hasBank ? "bank_discount" : "general",
        discount_value: deal.discountValue,
        bank_id: resolvedBankId,
        is_active: true,
        start_date: null,
        end_date: null,
        valid_card_variants: null,
      });
    });
  }

  const { error: deleteError } = await supabase
    .from("deals")
    .delete()
    .eq("listing_id", listingId);

  if (deleteError) {
    return {
      success: false,
      error: `Failed to reset deals for listing ${listingId}: ${deleteError.message}`,
    };
  }

  if (payload.length === 0) {
    return { success: true };
  }

  const { error: insertError } = await supabase.from("deals").insert(payload);

  if (insertError) {
    return {
      success: false,
      error: `Failed to insert deals for listing ${listingId}: ${insertError.message}`,
    };
  }

  return { success: true };
}

function normalizeBranchKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function parseBranchesJson(rawValue?: string | null): ParsedBranchRecord[] {
  const parsed = safeJsonParse(rawValue);
  if (!Array.isArray(parsed)) return [];

  const rows: ParsedBranchRecord[] = [];

  for (const entry of parsed) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      continue;
    }

    const item = entry as Record<string, unknown>;

    const name = typeof item.name === "string" ? item.name.trim() : "";
    const address =
      typeof item.address === "string" ? item.address.trim() : "";
    const city =
      typeof item.city === "string" && item.city.trim()
        ? item.city.trim()
        : "Karachi";
    const country =
      typeof item.country === "string" && item.country.trim()
        ? item.country.trim()
        : "Pakistan";
    const latitude =
      typeof item.latitude === "number"
        ? item.latitude
        : Number.parseFloat(String(item.latitude ?? ""));
    const longitude =
      typeof item.longitude === "number"
        ? item.longitude
        : Number.parseFloat(String(item.longitude ?? ""));

    if (!name || !address || Number.isNaN(latitude) || Number.isNaN(longitude)) {
      continue;
    }

    rows.push({
      name,
      address,
      city,
      country,
      latitude,
      longitude,
      phone_number:
        typeof item.phone_number === "string"
          ? item.phone_number.trim() || null
          : null,
      timings:
        typeof item.timings === "string" ? item.timings.trim() || null : null,
      is_open_now: Boolean(item.is_open_now),
      is_primary: Boolean(item.is_primary),
      is_verified: Boolean(item.is_verified),
      distance_from_center:
        typeof item.distance_from_center === "string"
          ? item.distance_from_center.trim() || null
          : null,
      custom_attributes:
        parseJsonObject(
          typeof item.custom_attributes === "string"
            ? item.custom_attributes
            : item.custom_attributes
              ? JSON.stringify(item.custom_attributes)
              : null,
        ) || {},
      peekaboo_branch_id:
        typeof item.peekaboo_branch_id === "number"
          ? item.peekaboo_branch_id
          : typeof item.peekaboo_branch_id === "string" &&
              item.peekaboo_branch_id.trim()
            ? Number.parseInt(item.peekaboo_branch_id, 10)
            : null,
    });
  }

  return rows;
}

function parseBranchOpeningHoursJson(
  rawValue?: string | null,
): ParsedBranchHoursRecord[] {
  const parsed = safeJsonParse(rawValue);
  if (!Array.isArray(parsed)) return [];

  const rows: ParsedBranchHoursRecord[] = [];

  for (const entry of parsed) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      continue;
    }

    const item = entry as Record<string, unknown>;
    const hoursRaw = Array.isArray(item.hours) ? item.hours : [];
    const hours = hoursRaw
      .filter((hour) => hour && typeof hour === "object" && !Array.isArray(hour))
      .map((hour) => {
        const h = hour as Record<string, unknown>;
        const day =
          typeof h.day_of_week === "number"
            ? h.day_of_week
            : Number.parseInt(String(h.day_of_week ?? ""), 10);
        return {
          day_of_week: day,
          open_time:
            typeof h.open_time === "string" ? h.open_time.trim() || null : null,
          close_time:
            typeof h.close_time === "string"
              ? h.close_time.trim() || null
              : null,
          is_closed: Boolean(h.is_closed),
        };
      })
      .filter((hour) => hour.day_of_week >= 0 && hour.day_of_week <= 6);

    if (hours.length === 0) {
      continue;
    }

    rows.push({
      branch_name:
        typeof item.branch_name === "string" ? item.branch_name.trim() : null,
      peekaboo_branch_id:
        typeof item.peekaboo_branch_id === "number"
          ? item.peekaboo_branch_id
          : typeof item.peekaboo_branch_id === "string" &&
              item.peekaboo_branch_id.trim()
            ? Number.parseInt(item.peekaboo_branch_id, 10)
            : null,
      hours,
    });
  }

  return rows;
}

async function syncBranchesForListing(
  supabase: SupabaseClient<Database>,
  listingId: number,
  meta: ListingRecordMeta,
): Promise<{ success: boolean; error?: string }> {
  const parsedBranches = parseBranchesJson(meta.branchesJson);
  const parsedBranchHours = parseBranchOpeningHoursJson(meta.branchOpeningHoursJson);

  if (parsedBranches.length === 0 && parsedBranchHours.length === 0) {
    return { success: true };
  }

  const { error: clearHoursError } = await supabase
    .from("opening_hours")
    .delete()
    .eq("listing_id", listingId)
    .not("branch_id", "is", null);

  if (clearHoursError) {
    return {
      success: false,
      error: `Failed to reset branch opening hours for listing ${listingId}: ${clearHoursError.message}`,
    };
  }

  const { error: clearBranchesError } = await supabase
    .from("listing_branches")
    .delete()
    .eq("listing_id", listingId);

  if (clearBranchesError) {
    return {
      success: false,
      error: `Failed to reset branches for listing ${listingId}: ${clearBranchesError.message}`,
    };
  }

  if (parsedBranches.length === 0) {
    return { success: true };
  }

  const idByName = new Map<string, number>();
  const idByPeekaboo = new Map<number, number>();
  let primaryAssigned = false;

  for (const branch of parsedBranches) {
    const isPrimary = branch.is_primary && !primaryAssigned;
    if (isPrimary) {
      primaryAssigned = true;
    }

    const payload: Database["public"]["Tables"]["listing_branches"]["Insert"] = {
      listing_id: listingId,
      name: branch.name,
      address: branch.address,
      city: branch.city,
      country: branch.country,
      latitude: branch.latitude,
      longitude: branch.longitude,
      phone_number: branch.phone_number,
      timings: branch.timings,
      is_open_now: branch.is_open_now,
      is_primary: isPrimary,
      is_verified: branch.is_verified,
      distance_from_center: branch.distance_from_center,
      custom_attributes:
        (branch.custom_attributes as Database["public"]["Tables"]["listing_branches"]["Insert"]["custom_attributes"]) ||
        {},
      peekaboo_branch_id: branch.peekaboo_branch_id,
    };

    const { data: insertedBranch, error: branchInsertError } = await supabase
      .from("listing_branches")
      .insert(payload)
      .select("id, name, peekaboo_branch_id")
      .single();

    if (branchInsertError || !insertedBranch) {
      return {
        success: false,
        error: `Failed to insert branch for listing ${listingId}: ${branchInsertError?.message || "unknown error"}`,
      };
    }

    idByName.set(normalizeBranchKey(insertedBranch.name), insertedBranch.id);
    if (typeof insertedBranch.peekaboo_branch_id === "number") {
      idByPeekaboo.set(insertedBranch.peekaboo_branch_id, insertedBranch.id);
    }
  }

  if (parsedBranchHours.length === 0) {
    return { success: true };
  }

  const openingHoursPayload: Database["public"]["Tables"]["opening_hours"]["Insert"][] = [];

  for (const branchHours of parsedBranchHours) {
    const resolvedBranchId =
      (typeof branchHours.peekaboo_branch_id === "number"
        ? idByPeekaboo.get(branchHours.peekaboo_branch_id)
        : undefined) ||
      (branchHours.branch_name
        ? idByName.get(normalizeBranchKey(branchHours.branch_name))
        : undefined);

    if (!resolvedBranchId) {
      continue;
    }

    for (const hour of branchHours.hours) {
      openingHoursPayload.push({
        listing_id: listingId,
        branch_id: resolvedBranchId,
        day_of_week: hour.day_of_week,
        open_time: hour.is_closed ? null : hour.open_time,
        close_time: hour.is_closed ? null : hour.close_time,
        is_closed: hour.is_closed,
      });
    }
  }

  if (openingHoursPayload.length === 0) {
    return { success: true };
  }

  const { error: insertHoursError } = await supabase
    .from("opening_hours")
    .insert(openingHoursPayload);

  if (insertHoursError) {
    return {
      success: false,
      error: `Failed to insert branch hours for listing ${listingId}: ${insertHoursError.message}`,
    };
  }

  return { success: true };
}
