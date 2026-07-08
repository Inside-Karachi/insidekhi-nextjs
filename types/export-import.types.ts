export type ImportResult = {
  success: boolean;
  totalProcessed: number;
  successful: number;
  failed: number;
  skipped: number;
  fieldStats: FieldStats;
  errors: ImportError[];
  preview?: Array<Record<string, unknown>>;
  dryRun?: Array<Record<string, unknown>>;
  importId?: string;
  rollbackAvailable?: boolean;
};
export type FieldStats = {
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
};

export type ImportError = {
  row: number;
  name: string;
  error: string;
  field?: string;
};
