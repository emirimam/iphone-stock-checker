// Provjera potpisanih tokena (GitHub Actions OIDC, Google prijava) i PIN hash.
import { createHash, createPublicKey, verify, timingSafeEqual } from "node:crypto";

export const REPO = "emirimam/iphone-stock-checker";
export const AUDIENCE = "iphone-stock-checker";

const jwksCache = new Map();
const b64url = (s) => Buffer.from(String(s).replace(/-/g, "+").replace(/_/g, "/"), "base64");

async function jwks(url) {
  const c = jwksCache.get(url);
  if (c && Date.now() - c.at < 3600e3) return c.keys;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  const keys = (await res.json()).keys || [];
  jwksCache.set(url, { at: Date.now(), keys });
  return keys;
}

/** Provjeri RS256 JWT potpis i vrati claims (ili null). */
export async function verifyJwt(token, jwksUrl) {
  try {
    const [h, p, sig] = String(token).split(".");
    if (!sig) return null;
    const header = JSON.parse(b64url(h).toString());
    if (header.alg !== "RS256") return null;
    let jwk = (await jwks(jwksUrl)).find((k) => k.kid === header.kid);
    if (!jwk) {
      jwksCache.delete(jwksUrl); // kljucevi se rotiraju
      jwk = (await jwks(jwksUrl)).find((k) => k.kid === header.kid);
    }
    if (!jwk) return null;
    const ok = verify("RSA-SHA256", Buffer.from(`${h}.${p}`), createPublicKey({ key: jwk, format: "jwk" }), b64url(sig));
    if (!ok) return null;
    const claims = JSON.parse(b64url(p).toString());
    const now = Date.now() / 1000;
    if (!(claims.exp > now) || (claims.nbf || 0) > now + 60) return null;
    return claims;
  } catch {
    return null;
  }
}

const audOk = (claims, aud) => (Array.isArray(claims.aud) ? claims.aud : [claims.aud]).includes(aud);

/** Token koji izdaje GitHub Actions za ovaj repo. */
export async function verifyGithubToken(token) {
  const c = await verifyJwt(token, "https://token.actions.githubusercontent.com/.well-known/jwks");
  return Boolean(
    c && c.iss === "https://token.actions.githubusercontent.com" && audOk(c, AUDIENCE) && c.repository === REPO
  );
}

/** Google "Sign in with Google" ID token -> { sub, email, name, picture } ili null. */
export async function verifyGoogleToken(token, clientId) {
  if (!clientId) return null;
  const c = await verifyJwt(token, "https://www.googleapis.com/oauth2/v3/certs");
  if (!c) return null;
  if (!["accounts.google.com", "https://accounts.google.com"].includes(c.iss)) return null;
  if (!audOk(c, clientId) || !c.sub || c.email_verified === false) return null;
  return { sub: String(c.sub), email: c.email || "", name: c.name || "", picture: c.picture || "" };
}

export const hashPin = (pin) => createHash("sha256").update(`iphone-stock:${pin}`).digest("hex");

export function samePin(given, stored) {
  const a = Buffer.from(hashPin(String(given || "")));
  const b = Buffer.from(String(stored || ""));
  return a.length === b.length && timingSafeEqual(a, b);
}
