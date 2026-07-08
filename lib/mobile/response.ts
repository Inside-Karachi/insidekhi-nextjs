import { NextResponse } from "next/server";

/**
 * Standard success envelope for the mobile API: `{ data, meta? }`.
 * Every `/api/mobile/v1` handler returns through this so the shape is uniform.
 */
export function ok<T>(
  data: T,
  meta?: Record<string, unknown>,
  init?: ResponseInit,
): NextResponse {
  const body = meta !== undefined ? { data, meta } : { data };
  return NextResponse.json(body, init);
}
