// Podesavanja i stanje, cuvano u Upstash Redis (Vercel Marketplace -> Storage).
import { verifyGithubToken, hashPin, samePin } from "./auth.js";

export const OPTIONS = {
  models: ["18 pro max", "18 pro", "air", "17", "17e"],
  storages: ["128gb", "256gb", "512gb", "1tb", "2tb"],
  priorities: ["min", "low", "default", "high", "urgent"],
  langs: ["en", "bs"],
};

export const DEFAULT_SETTINGS = {
  enabled: true,
  zip: "32068",
  maxMiles: 60,
  models: ["18 pro max"],
  storages: [], // prazno = sve
  colors: [], // prazno = sve
  ntfyTopic: "",
  email: "",
  priority: "high",
  repeatHours: 0, // 0 = samo kad se nesto NOVO pojavi
  lang: "en", // jezik obavijesti
};

const KEY = "iphone:settings";
const STATUS_KEY = "iphone:status";

function redisEnv() {
  const env = process.env;
  let url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
  let token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    // Vercel ponekad doda vlastiti prefiks (npr. STORAGE_KV_REST_API_URL)
    for (const k of Object.keys(env)) {
      if (!url && /(REST_API_URL|REDIS_REST_URL)$/.test(k)) {
        const base = k.replace(/(REST_API_URL|REDIS_REST_URL)$/, "");
        const t = env[`${base}REST_API_TOKEN`] || env[`${base}REDIS_REST_TOKEN`];
        if (t) { url = env[k]; token = t; }
      }
    }
  }
  return url && token ? { url, token } : null;
}

export const hasStorage = () => Boolean(redisEnv());

async function redis(cmd) {
  const env = redisEnv();
  if (!env) throw coded("no_storage", "Database is not connected (Vercel -> Storage -> Upstash Redis).");
  const res = await fetch(env.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(`Redis: ${data.error || res.status}`);
  return data.result;
}

const pick = (arr, allowed) =>
  Array.isArray(arr) ? [...new Set(arr.map((x) => String(x).toLowerCase().trim()))].filter((x) => allowed.includes(x)) : [];

export function sanitize(input = {}) {
  const s = { ...DEFAULT_SETTINGS };
  if (typeof input.enabled === "boolean") s.enabled = input.enabled;
  if (/^\d{5}$/.test(String(input.zip || "").trim())) s.zip = String(input.zip).trim();
  const miles = Number(input.maxMiles);
  if (Number.isFinite(miles) && miles >= 1 && miles <= 500) s.maxMiles = Math.round(miles);
  if (input.models !== undefined) s.models = pick(input.models, OPTIONS.models);
  if (!s.models.length) s.models = [...DEFAULT_SETTINGS.models];
  if (input.storages !== undefined) s.storages = pick(input.storages, OPTIONS.storages);
  if (input.colors !== undefined)
    s.colors = Array.isArray(input.colors)
      ? [...new Set(input.colors.map((c) => String(c).toLowerCase().trim()))].filter((c) => /^[a-z ]{2,24}$/.test(c)).slice(0, 12)
      : [];
  if (typeof input.ntfyTopic === "string") s.ntfyTopic = input.ntfyTopic.trim().replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);
  if (typeof input.email === "string") {
    const e = input.email.trim();
    s.email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e.slice(0, 120) : "";
  }
  if (OPTIONS.priorities.includes(input.priority)) s.priority = input.priority;
  if (OPTIONS.langs.includes(input.lang)) s.lang = input.lang;
  const rep = Number(input.repeatHours);
  if (Number.isFinite(rep) && rep >= 0 && rep <= 48) s.repeatHours = rep;
  return s;
}

export async function loadSettings() {
  if (!hasStorage()) return { ...DEFAULT_SETTINGS };
  const raw = await redis(["GET", KEY]);
  return sanitize(raw ? JSON.parse(raw) : {});
}

/** Spoji izmjene sa postojecim podesavanjima (prazan topic/email u formi = zadrzi stari). */
export async function saveSettings(input) {
  const current = await loadSettings();
  const merged = { ...current, ...input };
  if (input.ntfyTopic === undefined || input.ntfyTopic === null) merged.ntfyTopic = current.ntfyTopic;
  if (input.email === undefined || input.email === null) merged.email = current.email;
  const s = sanitize(merged);
  await redis(["SET", KEY, JSON.stringify(s)]);
  return s;
}

export async function loadStatus() {
  if (!hasStorage()) return null;
  const raw = await redis(["GET", STATUS_KEY]);
  return raw ? JSON.parse(raw) : null;
}

export async function saveStatus(status) {
  await redis(["SET", STATUS_KEY, JSON.stringify(status)]);
}

export const filtersOf = (s) => ({ models: s.models, storages: s.storages, colors: s.colors });

/** Javni pogled: bez punog topica i emaila. */
export function publicView(s) {
  const mask = (v) => (v ? v.slice(0, 2) + "•••" + v.slice(-2) : "");
  return { ...s, ntfyTopic: mask(s.ntfyTopic), email: mask(s.email), ntfyTopicSet: !!s.ntfyTopic, emailSet: !!s.email };
}

// ---------- PIN i autorizacija
const PIN_KEY = "iphone:pin";

export async function pinConfigured() {
  if (process.env.ADMIN_PIN) return true;
  if (!hasStorage()) return false;
  return Boolean(await redis(["GET", PIN_KEY]));
}

/** Prvo postavljanje PIN-a sa stranice (samo dok PIN jos ne postoji). */
export async function setPin(pin) {
  pin = String(pin || "").trim();
  if (pin.length < 4) throw coded("pin_short", "PIN must be at least 4 characters.");
  if (await pinConfigured()) throw coded("pin_exists", "PIN is already set.");
  // NX: postavi samo ako kljuc ne postoji (zastita od istovremenog postavljanja)
  const r = await redis(["SET", PIN_KEY, hashPin(pin), "NX"]);
  if (r !== "OK") throw coded("pin_exists", "PIN is already set.");
}

function coded(code, message) {
  const e = new Error(message);
  e.code = code;
  return e;
}

/** ok za ispravan PIN ili za GitHub Actions token ovog repoa. */
export async function authorize(req) {
  const auth = String(req.headers.authorization || "");
  if (auth.startsWith("Bearer ") && (await verifyGithubToken(auth.slice(7)))) return { ok: true, who: "github" };

  const given = String(req.headers["x-pin"] || (req.body && req.body.pin) || "");
  if (!given) return { ok: false, code: "pin_required", reason: "Enter your PIN." };
  if (process.env.ADMIN_PIN) {
    return given === String(process.env.ADMIN_PIN)
      ? { ok: true, who: "pin" }
      : { ok: false, code: "pin_wrong", reason: "Wrong PIN." };
  }
  if (!hasStorage()) return { ok: false, code: "no_storage", reason: "Database is not connected." };
  const stored = await redis(["GET", PIN_KEY]);
  if (!stored) return { ok: false, code: "pin_not_set", reason: "PIN has not been set yet." };
  return samePin(given, stored) ? { ok: true, who: "pin" } : { ok: false, code: "pin_wrong", reason: "Wrong PIN." };
}
