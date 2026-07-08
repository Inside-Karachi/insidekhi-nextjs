import { MobileApiError } from "./errors";

/**
 * Parses a positive-integer path parameter. Strict: rejects non-integers,
 * negatives, zero, and trailing garbage ("12abc", "-5", "12.9") with a 400.
 */
export function parsePathId(value: string | undefined, field: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) {
    throw new MobileApiError(
      "validation_error",
      `Invalid ${field}.`,
      400,
      field,
    );
  }
  return id;
}
