// Sesija u HttpOnly kolacicu, potpisana HMAC-om (tajna u bazi).
import { createHmac, timingSafeEqual } from "node:crypto";
import { sessionSecret, getUser, ownerSub, hasStorage } from "./db.js";

const COOKIE = "iphs";
const MAX_AGE = 60 * 60 * 24 * 60; // 60 dana

const sign = (secret, data) => createHmac("sha256", secret).update(data).digest("base64url");

export async function createSession(res, sub) {
  const payload = Buffer.from(JSON.stringify({ sub, exp: Math.floor(Date.now() / 1000) + MAX_AGE })).toString("base64url");
  const token = `${payload}.${sign(await sessionSecret(), payload)}`;
  res.setHeader("Set-Cookie", `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE}`);
}

export function clearSession(res) {
  res.setHeader("Set-Cookie", `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}

function readCookie(req) {
  const raw = req.headers.cookie || "";
  const m = raw.split(/;\s*/).find((c) => c.startsWith(`${COOKIE}=`));
  return m ? m.slice(COOKIE.length + 1) : "";
}

/** Prijavljeni korisnik ili null. Vraca { sub, profile, isOwner }. */
export async function currentUser(req) {
  if (!hasStorage()) return null;
  const token = readCookie(req);
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = sign(await sessionSecret(), payload);
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  let data;
  try { data = JSON.parse(Buffer.from(payload, "base64url").toString()); } catch { return null; }
  if (!data.sub || !(data.exp > Date.now() / 1000)) return null;
  const profile = await getUser(data.sub);
  if (!profile) return null;
  return { sub: data.sub, profile, isOwner: (await ownerSub()) === data.sub };
}

export async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch { return {}; } }
  return {};
}

export function sendError(res, err) {
  const status = err.status || (err.code ? 400 : 500);
  res.status(status).json({ error: String(err.message || err), code: err.code });
}
