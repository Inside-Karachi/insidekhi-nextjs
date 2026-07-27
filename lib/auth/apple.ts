import { createRemoteJWKSet, importPKCS8, jwtVerify, SignJWT } from "jose";

const APPLE_AUTH_ENDPOINT = "https://appleid.apple.com/auth/authorize";
const APPLE_TOKEN_ENDPOINT = "https://appleid.apple.com/auth/token";
const APPLE_JWKS_URI = "https://appleid.apple.com/auth/keys";
const APPLE_ISSUER = "https://appleid.apple.com";

// Cached across invocations so we don't refetch Apple's signing keys per request.
const appleJwks = createRemoteJWKSet(new URL(APPLE_JWKS_URI));

export interface AppleIdTokenPayload {
  sub: string;
  email: string;
  email_verified: boolean;
}

function getAppleClientId(): string {
  const clientId = process.env.APPLE_CLIENT_ID;
  if (!clientId) {
    throw new Error("APPLE_CLIENT_ID environment variable is not configured");
  }
  return clientId;
}

function getAppleTeamId(): string {
  const teamId = process.env.APPLE_TEAM_ID;
  if (!teamId) {
    throw new Error("APPLE_TEAM_ID environment variable is not configured");
  }
  return teamId;
}

function getAppleKeyId(): string {
  const keyId = process.env.APPLE_KEY_ID;
  if (!keyId) {
    throw new Error("APPLE_KEY_ID environment variable is not configured");
  }
  return keyId;
}

function getApplePrivateKeyPem(): string {
  const rawKey = process.env.APPLE_PRIVATE_KEY;
  if (!rawKey) {
    throw new Error("APPLE_PRIVATE_KEY environment variable is not configured");
  }
  // Allow the PEM to be stored with literal "\n" sequences in env files.
  return rawKey.includes("\\n") ? rawKey.replace(/\\n/g, "\n") : rawKey;
}

/**
 * Apple requires a signed JWT (not a static secret) as the OAuth client_secret.
 * It's generated fresh per request since signing is local and cheap.
 */
async function generateAppleClientSecret(): Promise<string> {
  const privateKey = await importPKCS8(getApplePrivateKeyPem(), "ES256");
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: getAppleKeyId() })
    .setIssuer(getAppleTeamId())
    .setIssuedAt()
    .setExpirationTime("5m")
    .setAudience(APPLE_ISSUER)
    .setSubject(getAppleClientId())
    .sign(privateKey);
}

/**
 * Builds the URL that starts the Sign in with Apple flow. Apple requires
 * response_mode=form_post whenever scopes (name/email) are requested, so the
 * callback route must accept a POST request rather than a GET redirect.
 */
export function buildAppleAuthUrl(params: {
  redirectUri: string;
  state: string;
}): string {
  const url = new URL(APPLE_AUTH_ENDPOINT);
  url.searchParams.set("client_id", getAppleClientId());
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "name email");
  url.searchParams.set("response_mode", "form_post");
  url.searchParams.set("state", params.state);
  return url.toString();
}

/**
 * Exchanges an authorization code for tokens and returns the verified ID token payload.
 */
export async function exchangeAppleCode(
  code: string,
  redirectUri: string
): Promise<AppleIdTokenPayload> {
  const clientSecret = await generateAppleClientSecret();

  const response = await fetch(APPLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: getAppleClientId(),
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Apple token exchange failed: ${response.status} ${body}`);
  }

  const { id_token: idToken } = (await response.json()) as {
    id_token?: string;
  };

  if (!idToken) {
    throw new Error("Apple token response did not include an id_token");
  }

  const { payload } = await jwtVerify(idToken, appleJwks, {
    issuer: APPLE_ISSUER,
    audience: getAppleClientId(),
  });

  if (!payload.sub || typeof payload.email !== "string") {
    throw new Error("Apple ID token is missing required claims");
  }

  return {
    sub: payload.sub,
    email: payload.email,
    email_verified:
      payload.email_verified === true || payload.email_verified === "true",
  };
}
