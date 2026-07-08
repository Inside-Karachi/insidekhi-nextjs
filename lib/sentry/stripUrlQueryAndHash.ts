/** Strip query strings and hash fragments before sending URLs to Sentry. */
export function stripUrlQueryAndHash(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return url;
  }
}

/** Auth flows may carry tokens in the URL; do not record Session Replay there. */
export function isSensitiveAuthPath(pathname: string): boolean {
  return /^\/(login|signup|reset-password|verify-email)(\/|$)/.test(pathname);
}
