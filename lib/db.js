// Podaci u Redisu: korisnici, njihova podesavanja, vlasnik, PIN, konfiguracija, stanje po ZIP-u, statistika.
import { randomBytes } from "node:crypto";
import { redis, pipeline, getJson, setJson, hasStorage, coded } from "./redis.js";
import { sanitize, DEFAULT_SETTINGS } from "./settings.js";
import { hashPin, samePin } from "./auth.js";

const K = {
  legacySettings: "iphone:settings", // podesavanja iz vremena prije prijave (jedan korisnik)
  legacyStatus: "iphone:status",
  pin: "iphone:pin",
  owner: "iphone:owner",
  secret: "iphone:session-secret",
  config: "iphone:config",
  users: "iphone:users",
  user: (sub) => `iphone:user:${sub}`,
  settings: (sub) => `iphone:settings:${sub}`,
  status: (zip) => `iphone:status:${zip}`,
};

export { hasStorage };

// ---------- konfiguracija aplikacije
export async function getConfig() {
  const c = (hasStorage() && (await getJson(K.config))) || {};
  return { googleClientId: process.env.GOOGLE_CLIENT_ID || c.googleClientId || "" };
}

export async function setGoogleClientId(id) {
  id = String(id || "").trim();
  if (!/^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(id))
    throw coded("bad_client_id", "That doesn't look like a Google OAuth Client ID (…apps.googleusercontent.com).");
  const c = (await getJson(K.config)) || {};
  await setJson(K.config, { ...c, googleClientId: id });
}

/** Tajni kljuc za potpis sesija; generise se jednom i cuva u bazi. */
export async function sessionSecret() {
  let s = await redis(["GET", K.secret]);
  if (!s) {
    await redis(["SET", K.secret, randomBytes(32).toString("hex"), "NX"]);
    s = await redis(["GET", K.secret]);
  }
  return s;
}

// ---------- PIN (samo za preuzimanje vlasnistva i prvo podesavanje)
export async function pinConfigured() {
  if (process.env.ADMIN_PIN) return true;
  if (!hasStorage()) return false;
  return Boolean(await redis(["GET", K.pin]));
}

export async function checkPin(given) {
  given = String(given || "");
  if (!given) return false;
  if (process.env.ADMIN_PIN) return given === String(process.env.ADMIN_PIN);
  const stored = await redis(["GET", K.pin]);
  return Boolean(stored) && samePin(given, stored);
}

export async function setPin(pin) {
  pin = String(pin || "").trim();
  if (pin.length < 4) throw coded("pin_short", "PIN must be at least 4 characters.");
  if (await pinConfigured()) throw coded("pin_exists", "PIN is already set.");
  const r = await redis(["SET", K.pin, hashPin(pin), "NX"]);
  if (r !== "OK") throw coded("pin_exists", "PIN is already set.");
}

// ---------- korisnici
export async function upsertUser(profile) {
  const now = new Date().toISOString();
  const prev = (await getJson(K.user(profile.sub))) || { createdAt: now, visits: 0 };
  const user = { ...prev, ...profile, lastSeen: now, logins: (prev.logins || 0) + 1 };
  await pipeline([
    ["SET", K.user(profile.sub), JSON.stringify(user)],
    ["SADD", K.users, profile.sub],
  ]);
  return user;
}

export const getUser = (sub) => getJson(K.user(sub));

export async function touchUser(sub) {
  const u = await getUser(sub);
  if (u) await setJson(K.user(sub), { ...u, lastSeen: new Date().toISOString() });
}

export async function ownerSub() {
  return hasStorage() ? (await redis(["GET", K.owner])) || "" : "";
}

/** Vlasnik se postaje ispravnim PIN-om (jednom). Stara podesavanja prelaze na vlasnika. */
export async function claimOwner(sub, pin) {
  const current = await ownerSub();
  if (current && current !== sub) throw coded("owner_exists", "This app already has an owner.", 403);
  if (!(await pinConfigured())) throw coded("pin_not_set", "PIN has not been set yet.");
  if (!(await checkPin(pin))) throw coded("pin_wrong", "Wrong PIN.", 401);
  await redis(["SET", K.owner, sub]);
  const legacy = await getJson(K.legacySettings);
  if (legacy) {
    const mine = await getJson(K.settings(sub));
    if (!mine) await setJson(K.settings(sub), sanitize(legacy));
    await redis(["DEL", K.legacySettings]);
  }
  return true;
}

// ---------- podesavanja po korisniku
export async function loadSettings(sub) {
  if (!hasStorage() || !sub) return { ...DEFAULT_SETTINGS };
  return sanitize((await getJson(K.settings(sub))) || {});
}

/** Spoji izmjene sa postojecim (prazan topic/email u formi = zadrzi stari). */
export async function saveSettings(sub, input) {
  const current = await loadSettings(sub);
  const merged = { ...current, ...input };
  if (input.ntfyTopic === undefined || input.ntfyTopic === null) merged.ntfyTopic = current.ntfyTopic;
  if (input.email === undefined || input.email === null) merged.email = current.email;
  if (input.clearEmail) merged.email = "";
  const s = sanitize(merged);
  await setJson(K.settings(sub), s);
  return s;
}

/** Svi korisnici sa podesavanjima (za GitHub provjeru i admin pregled). */
export async function allUsers() {
  const subs = (await redis(["SMEMBERS", K.users])) || [];
  if (!subs.length) return [];
  const vals = await pipeline(subs.flatMap((s) => [["GET", K.user(s)], ["GET", K.settings(s)]]));
  return subs.map((sub, i) => ({
    sub,
    profile: vals[2 * i] ? JSON.parse(vals[2 * i]) : {},
    settings: vals[2 * i + 1] ? sanitize(JSON.parse(vals[2 * i + 1])) : null,
  }));
}

/** Stara (prije-prijave) podesavanja dok ih vlasnik ne preuzme - da obavijesti ne prestanu. */
export async function legacySettings() {
  const raw = hasStorage() ? await getJson(K.legacySettings) : null;
  return raw ? sanitize(raw) : null;
}

// ---------- stanje (rezultat provjere) po ZIP-u
export async function loadStatus(zip) {
  if (!hasStorage()) return null;
  return (await getJson(K.status(zip))) || null;
}

export async function saveStatuses(map) {
  const cmds = Object.entries(map).map(([zip, st]) => ["SET", K.status(zip), JSON.stringify(st)]);
  await pipeline(cmds);
}

// ---------- statistika posjeta
const day = (d = new Date()) => d.toISOString().slice(0, 10);

export async function trackVisit(visitorId, path) {
  const vid = String(visitorId || "").replace(/[^a-z0-9-]/gi, "").slice(0, 64) || "anon";
  const d = day();
  await pipeline([
    ["INCR", "iphone:stats:views"],
    ["INCR", `iphone:stats:views:${d}`],
    ["EXPIRE", `iphone:stats:views:${d}`, 60 * 60 * 24 * 120],
    ["PFADD", "iphone:stats:visitors", vid],
    ["PFADD", `iphone:stats:visitors:${d}`, vid],
    ["EXPIRE", `iphone:stats:visitors:${d}`, 60 * 60 * 24 * 120],
    ["INCR", `iphone:stats:path:${String(path || "/").slice(0, 40)}`],
  ]);
}

export async function stats(days = 30) {
  const list = [];
  for (let i = days - 1; i >= 0; i--) list.push(day(new Date(Date.now() - i * 864e5)));
  const r = await pipeline([
    ["GET", "iphone:stats:views"],
    ["PFCOUNT", "iphone:stats:visitors"],
    ["SCARD", K.users],
    ...list.flatMap((d) => [["GET", `iphone:stats:views:${d}`], ["PFCOUNT", `iphone:stats:visitors:${d}`]]),
  ]);
  return {
    totalViews: Number(r[0] || 0),
    uniqueVisitors: Number(r[1] || 0),
    registeredUsers: Number(r[2] || 0),
    daily: list.map((d, i) => ({ day: d, views: Number(r[3 + 2 * i] || 0), visitors: Number(r[4 + 2 * i] || 0) })),
  };
}
