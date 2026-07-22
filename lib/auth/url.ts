const TRUSTED_SITE_URL_ENV_KEYS = [
  "SITE_URL",
  "NEXT_PUBLIC_SITE_URL",
  "VERCEL_URL",
] as const;

function normalizeSiteOrigin(rawUrl: string): string {
  const candidate = rawUrl.includes("://") ? rawUrl : `https://${rawUrl}`;
  const url = new URL(candidate);

  if (process.env.NODE_ENV === "production") {
    if (url.protocol !== "https:") {
      throw new Error("Auth redirect URL must use HTTPS in production");
    }

    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      throw new Error("Auth redirect URL cannot use localhost in production");
    }
  }

  return url.origin;
}

function getConfiguredSiteOrigin(): string | null {
  for (const key of TRUSTED_SITE_URL_ENV_KEYS) {
    const value = process.env[key]?.trim();
    if (value) {
      return normalizeSiteOrigin(value);
    }
  }

  return null;
}

function resolveSiteOrigin(requestUrl?: string): string {
  const configuredOrigin = getConfiguredSiteOrigin();
  const fallbackOrigin =
    process.env.NODE_ENV === "development" && requestUrl
      ? new URL(requestUrl).origin
      : null;
  const origin = configuredOrigin ?? fallbackOrigin;

  if (!origin) {
    throw new Error(
      "SITE_URL, NEXT_PUBLIC_SITE_URL, or VERCEL_URL must be configured for auth redirects"
    );
  }

  return origin;
}

export function getAuthCallbackUrl(requestUrl?: string): string {
  return new URL("/api/auth/callback", resolveSiteOrigin(requestUrl)).toString();
}

export function getGoogleCallbackUrl(requestUrl?: string): string {
  return new URL(
    "/api/auth/google/callback",
    resolveSiteOrigin(requestUrl)
  ).toString();
}
