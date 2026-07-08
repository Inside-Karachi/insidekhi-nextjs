import * as Sentry from "@sentry/nextjs";

/**
 * Captures a caught API route error to Sentry with route-level context.
 * Use in every API route catch block that returns a 500 response.
 */
export function captureRouteError(
  error: unknown,
  context: {
    route: string;
    method?: string;
    extra?: Record<string, unknown>;
  },
): void {
  Sentry.withScope((scope) => {
    scope.setTag("route", context.route);
    if (context.method) scope.setTag("http.method", context.method);
    if (context.extra) scope.setContext("route_context", context.extra);
    Sentry.captureException(error);
  });
}
