/**
 * BotID Client-Side Instrumentation
 *
 * This file is loaded automatically by Next.js 15.3+ and initializes BotID
 * for bot detection and protection.
 *
 * Documentation: https://vercel.com/docs/botid/get-started
 */

import { initBotId } from "botid/client/core";
import * as Sentry from "@sentry/nextjs";
import {
  isSensitiveAuthPath,
  stripUrlQueryAndHash,
} from "@/lib/sentry/stripUrlQueryAndHash";

const isDev = process.env.NODE_ENV === "development";

function onSensitiveAuthPage(): boolean {
  return (
    typeof window !== "undefined" &&
    isSensitiveAuthPath(window.location.pathname)
  );
}

function replaySessionSampleRate(): number {
  const fromEnv = process.env.NEXT_PUBLIC_SENTRY_REPLAY_SESSION_SAMPLE_RATE;
  if (fromEnv !== undefined && fromEnv !== "") {
    return Number(fromEnv);
  }
  return isDev ? 1.0 : 0.1;
}

function replayOnErrorSampleRate(): number {
  const fromEnv = process.env.NEXT_PUBLIC_SENTRY_REPLAY_ON_ERROR_SAMPLE_RATE;
  if (fromEnv !== undefined && fromEnv !== "") {
    return Number(fromEnv);
  }
  return 1.0;
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN,
  environment:
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_SENTRY_RELEASE || process.env.SENTRY_RELEASE,
  tracesSampleRate: Number(
    process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE || "0.05",
  ),
  replaysSessionSampleRate: onSensitiveAuthPage()
    ? 0
    : replaySessionSampleRate(),
  replaysOnErrorSampleRate: onSensitiveAuthPage()
    ? 0
    : replayOnErrorSampleRate(),
  enableLogs: true,
  sendDefaultPii: false,
  tracePropagationTargets: [/^\//, /^https:\/\/.*\.supabase\.co/],
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      maskAllInputs: true,
      blockAllMedia: true,
      networkCaptureBodies: false,
      block: [".sentry-block", "[data-sentry-block]", "[data-checkout]"],
      mask: [
        ".sentry-mask",
        "[data-sentry-mask]",
        'input[type="password"]',
        'input[name*="cnic" i]',
        'input[name*="phone" i]',
      ],
    }),
  ],
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
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

// BotID-protected routes (wildcards supported).
initBotId({
  protect: [
    // Authentication endpoints
    {
      path: "/api/auth/login",
      method: "POST",
    },
    {
      path: "/api/auth/signup",
      method: "POST",
    },
    {
      path: "/api/auth/reset-password",
      method: "POST",
    },

    // Admin sensitive endpoints
    {
      path: "/api/admin/*",
      method: "POST",
    },
    {
      path: "/api/admin/*",
      method: "DELETE",
    },

    // Payment and booking endpoints
    {
      path: "/api/payments/*",
      method: "POST",
    },
    {
      path: "/api/tickets/checkout",
      method: "POST",
    },

    // Form submission endpoints
    {
      path: "/api/contact",
      method: "POST",
    },
    {
      path: "/api/get-listed/submit",
      method: "POST",
    },

    // User interaction endpoints
    {
      path: "/api/favorites",
      method: "POST",
    },
    {
      path: "/api/reviews",
      method: "POST",
    },
    {
      path: "/api/reviews/*/rate",
      method: "POST",
    },
  ],
});
