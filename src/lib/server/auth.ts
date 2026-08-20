import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const sessionCookieName = "latch_session";
export const sessionDurationSeconds = 30 * 24 * 60 * 60;

function configuredPassword() {
  return process.env.LATCH_PASSWORD?.trim() ?? "";
}

function sign(payload: string) {
  return createHmac("sha256", configuredPassword()).update(payload).digest("base64url");
}

function hasMatchingSignature(signature: string, expected: string) {
  const actual = Buffer.from(signature);
  const comparison = Buffer.from(expected);
  return actual.length === comparison.length && timingSafeEqual(actual, comparison);
}

export function isAuthConfigured() {
  return Boolean(configuredPassword());
}

export function passwordMatches(password: string) {
  const expected = Buffer.from(configuredPassword());
  const supplied = Buffer.from(password);
  return expected.length > 0 && expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

export function createSession() {
  const expiresAt = Date.now() + sessionDurationSeconds * 1_000;
  const payload = `${expiresAt}.${randomBytes(24).toString("base64url")}`;
  return `${payload}.${sign(payload)}`;
}

export function isValidSession(session: string | undefined) {
  if (!session || !isAuthConfigured()) return false;
  const [expiresAt, nonce, signature, ...extra] = session.split(".");
  if (!expiresAt || !nonce || !signature || extra.length) return false;
  if (!/^\d+$/.test(expiresAt) || Number(expiresAt) <= Date.now()) return false;
  return hasMatchingSignature(signature, sign(`${expiresAt}.${nonce}`));
}

export function sessionFromCookieHeader(cookieHeader: string | null) {
  if (!cookieHeader) return undefined;
  return cookieHeader
    .split(";")
    .map((part) => part.trim().split("="))
    .find(([name]) => name === sessionCookieName)
    ?.slice(1)
    .join("=");
}

export function isAuthenticatedRequest(request: Request) {
  return isValidSession(sessionFromCookieHeader(request.headers.get("cookie")));
}
