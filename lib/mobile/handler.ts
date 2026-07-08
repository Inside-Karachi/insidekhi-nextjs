import { NextResponse, type NextRequest } from "next/server";
import { MobileApiError } from "./errors";

type RouteContext = { params: Promise<Record<string, string>> };

type MobileHandler = (
  request: NextRequest,
  context: RouteContext,
) => Promise<NextResponse>;

/**
 * Wraps a mobile API handler so every thrown {@link MobileApiError} becomes the
 * standard error envelope `{ error: { code, message, field? }, meta? }`, and any
 * unexpected error becomes a generic 500 without leaking internals to the client.
 */
export function mobileRoute(handler: MobileHandler) {
  return async (
    request: NextRequest,
    context: RouteContext,
  ): Promise<NextResponse> => {
    try {
      return await handler(request, context);
    } catch (err) {
      if (err instanceof MobileApiError) {
        const error: { code: string; message: string; field?: string } = {
          code: err.code,
          message: err.message,
        };
        if (err.field) error.field = err.field;

        const body: Record<string, unknown> = { error };
        if (err.meta) body.meta = err.meta;

        const headers: Record<string, string> = {};
        if (err.status === 429 && typeof err.meta?.retryAfter === "number") {
          headers["Retry-After"] = String(err.meta.retryAfter);
        }

        return NextResponse.json(body, { status: err.status, headers });
      }

      console.error("[mobile-api] unhandled error:", err);
      return NextResponse.json(
        { error: { code: "internal_error", message: "Something went wrong." } },
        { status: 500 },
      );
    }
  };
}
