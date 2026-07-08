import * as Sentry from "@sentry/nextjs";
import { stripUrlQueryAndHash } from "@/lib/sentry/stripUrlQueryAndHash";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
  release: process.env.SENTRY_RELEASE,
  tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || "0.05"),
  profilesSampleRate: Number(process.env.SENTRY_PROFILES_SAMPLE_RATE || "0"),
  enableLogs: true,
  sendDefaultPii: false,
  beforeSend(event) {
    if (event.request?.headers) {
      delete event.request.headers.authorization;
      delete event.request.headers.cookie;
      delete event.request.headers["x-worker-secret"];
    }
    if (event.request?.url) {
      event.request.url = stripUrlQueryAndHash(event.request.url);
    }
    return event;
  },
  ignoreErrors: [
    /Unauthorized/i,
    /Forbidden/i,
    /Invalid payload/i,
    /Invalid configuration/i,
  ],
});
