import { query } from "@/lib/db";
import { deleteFile, listPrefixedFiles, PROFILES_AVATAR_PREFIX } from "@/lib/storage/spaces";

type AnonymizeResult =
  | { success: true }
  | { success: false; error: "not_found" | "already_deleted" };

/**
 * Permanently anonymizes an account: name/avatar/phone/bio are replaced with
 * a placeholder identity, login is disabled, and the email is freed up for
 * reuse. Everything the user created (reviews, listings, bookings, points)
 * is left untouched - those tables only ever join `profiles` live by
 * user_id, so the anonymized identity cascades everywhere automatically.
 *
 * Irreversible. Callers must have already verified the user's identity
 * (password or typed confirmation) before calling this.
 */
export async function anonymizeAndDeleteAccount(
  userId: string,
  opts: { ipAddress?: string } = {},
): Promise<AnonymizeResult> {
  const { rows } = await query(
    `SELECT public.anonymize_and_delete_account($1) AS result`,
    [userId],
  );
  const result = rows[0]?.result as
    | { success: boolean; error?: string }
    | undefined;

  if (!result?.success) {
    return {
      success: false,
      error: (result?.error as "not_found" | "already_deleted") ?? "not_found",
    };
  }

  // Best-effort cleanup - a Spaces hiccup must never block the DB
  // anonymization the user already committed to.
  try {
    const keys = await listPrefixedFiles(PROFILES_AVATAR_PREFIX, userId);
    await Promise.allSettled(keys.map((key) => deleteFile(key)));
  } catch (err) {
    console.error("[delete-account] avatar cleanup failed (non-fatal):", err);
  }

  try {
    const { logAccountDeletion } = await import("@/lib/audit");
    await logAccountDeletion(userId, opts.ipAddress);
  } catch (err) {
    console.error("[delete-account] audit log failed (non-fatal):", err);
  }

  return { success: true };
}
