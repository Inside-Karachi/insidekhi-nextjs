export interface ImportHistory {
  id?: number;
  user_id: string;
  filename: string;
  total_records: number;
  successful_imports: number;
  failed_imports: number;
  status: "completed" | "failed" | "rolled_back";
  import_type: "listings";
  started_at: string;
  completed_at?: string;
  error_details?: string;
  rollback_available: boolean;
  imported_listing_ids?: number[];
}

export interface ImportOptions {
  skipDuplicates: boolean;
  updateExisting: boolean;
  preview: boolean;
  dryRun: boolean;
  importId?: string;
}

export interface ImportResult {
  success: boolean;
  totalProcessed: number;
  successful: number;
  failed: number;
  skipped: number;
  fieldStats: FieldStats;
  errors: Array<{
    row: number;
    name: string;
    error: string;
    field?: string;
  }>;
  preview?: ImportPreviewRow[];
  previewWarnings?: ImportPreviewWarning[];
  dryRun?: ImportDryRunRow[];
  importId?: number;
  rollbackAvailable?: boolean;
  status?: "completed" | "failed" | "rolled_back";
}
export interface ImportPreviewRow {
  row: number;
  name: string;
  // Add more known fields as needed
  extraFields?: Record<string, string | number>;
}

export interface ImportPreviewWarning {
  row: number;
  field: string;
  message: string;
  severity: "warning";
}

export interface ImportDryRunRow {
  row: number;
  name: string;
  action: "create" | "skip_duplicate" | "error";
  error?: string;
  duplicateCheck?: {
    found: boolean;
    id?: number;
    name?: string;
  };
  extraFields?: Record<string, string | number>;
}
export interface DatabaseClient {
  from: (table: string) => {
    select: (columns?: string) => unknown;
    insert: (data: Record<string, unknown>) => unknown;
    update: (data: Record<string, unknown>) => unknown;
    delete: () => unknown;
  };
  rpc?: (fn: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
  // Add other methods as needed for type safety
}

export interface SimulatedImportResult {
  row: number;
  name: string;
  action: string;
  duplicateCheck?: { found: boolean; existingId: number | null };
  listingData?: Record<string, unknown>;
  error?: string;
  extraFields?: Record<string, string | number>;
}

export interface TransactionalImportResult {
  successful: number;
  failed: number;
  skipped: number;
  updated: number;
  fieldStats: FieldStats;
  errors: Array<{ row: number; name: string; error: string; field?: string }>;
  importedIds: number[];
  updatedIds: number[];
}

export interface FieldStats {
  processed: number;
  skipped: number;
  errors: number;
  details: {
    socialLinks: { processed: number; skipped: number };
    coordinates: {
      processed: number;
      skipped: number;
      precisionIssues: number;
    };
    openingHours: { processed: number; skipped: number; parseErrors: number };
    categories: { processed: number; skipped: number; notFound: number };
    phoneNumbers: { processed: number; skipped: number; invalid: number };
    emails: { processed: number; skipped: number; invalid: number };
    urls: { processed: number; skipped: number; invalid: number };
  };
}
