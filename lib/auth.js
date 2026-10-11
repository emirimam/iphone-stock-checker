// Autorizacija: (1) PIN za ljude, (2) GitHub Actions OIDC token za automatsku provjeru (bez dijeljenih tajni).
import { createHash, createPublicKey, verify, timingSafeEqual } from "node:crypto";

export const REPO = "emirimam/iphone-stock-checker";
export const AUDIENCE = "iphone-stock-checker";
const ISSUER = "https://token.actions.githubusercontent.com";

let jwksCache = { at: 0, keys: [] };

const b64url = (s) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");

async function jwks() {
  if (Date.now() - jwksCache.at < 3600e3 && jwksCache.keys.length) return jwksCache.keys;
  const res = await fetch(`${ISSUER}/.well-known/jwks`, { signal: AbortSignal.timeout(10000) });
  const data = await res.json();
  jwksCache = { at: Date.now(), keys: data.keys || [] };
  return jwksCache.keys;
}

/** Provjeri da je token izdao GitHub Actions za ovaj repo. */
export async function verifyGithubToken(token) {
  try {
    const [h, p, sig] = String(token).split(".");
    if (!sig) return false;
    const header = JSON.parse(b64url(h).toString());
    const claims = JSON.parse(b64url(p).toString());
    const jwk = (await jwks()).find((k) => k.kid === header.kid);
    if (!jwk || header.alg !== "RS256") return false;
    const ok = verify("RSA-SHA256", Buffer.from(`${h}.${p}`), createPublicKey({ key: jwk, format: "jwk" }), b64url(sig));
    const now = Date.now() / 1000;
    const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    return (
      ok &&
      claims.iss === ISSUER &&
      aud.includes(AUDIENCE) &&
      claims.repository === REPO &&
      claims.exp > now &&
      (claims.nbf || 0) <= now + 60
    );
  } catch {
    return false;
  }
}

export const hashPin = (pin) => createHash("sha256").update(`iphone-stock:${pin}`).digest("hex");

export function samePin(given, stored) {
  const a = Buffer.from(hashPin(String(given || "")));
  const b = Buffer.from(String(stored || ""));
  return a.length === b.length && timingSafeEqual(a, b);
}
