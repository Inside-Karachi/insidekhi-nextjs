import * as Sentry from "@sentry/node";

let initialized = false;

export function initWorkerSentry() {
  if (initialized) return;

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
    release: process.env.SENTRY_RELEASE,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || "0.05"),
    profilesSampleRate: Number(process.env.SENTRY_PROFILES_SAMPLE_RATE || "0"),
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request?.headers) {
        delete event.request.headers.authorization;
        delete event.request.headers.cookie;
        delete event.request.headers["x-worker-secret"];
      }
      return event;
    },
  });

  initialized = true;
}

export function captureWorkerException(
  error: unknown,
  context?: Record<string, unknown>,
) {
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

/**
 * Strip tokens and secrets before stdout / logs (Sentry scrubs headers separately).
 */
export function redactForLog(value: unknown): string {
  let s: string;
  if (value instanceof Error) {
    s = `${value.name}: ${value.message}${value.stack ? `\n${value.stack}` : ""}`;
  } else if (typeof value === "string") {
    s = value;
  } else {
    try {
      s = JSON.stringify(value);
    } catch {
      s = String(value);
    }
  }

  s = s.replace(/\bBearer\s+[\w.-]+\b/gi, "Bearer [redacted]");
  s = s.replace(
    /eyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*/g,
    "[jwt]",
  );
  s = s.replace(
    /(password|token|secret|apikey|api_key|access_token|refresh_token)=([^&\s"']+)/gi,
    "$1=[redacted]",
  );
  s = s.replace(/x-worker-secret:\s*[^\s,;]+/gi, "x-worker-secret: [redacted]");

  return s;
}

export { Sentry };
