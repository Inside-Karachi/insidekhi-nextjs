// Wrapper module for database-related types.
//
// Historically the repo used `types/supabase.ts` for generated Supabase types.
// We now centralize access through `types/database.ts` so the rest of the codebase
// no longer imports the Supabase-specific filename directly.
export type {
  Json,
  Database,
  Tables,
  TablesInsert,
  TablesUpdate,
  Enums,
} from "./supabase";

