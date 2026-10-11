// Podesavanja i stanje, cuvano u Upstash Redis (Vercel Marketplace -> Storage).

export const OPTIONS = {
  models: ["18 pro max", "18 pro", "air", "17", "17e"],
  storages: ["128gb", "256gb", "512gb", "1tb", "2tb"],
  priorities: ["min", "low", "default", "high", "urgent"],
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
};

const KEY = "iphone:settings";
const STATUS_KEY = "iphone:status";

function redisEnv() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

export const hasStorage = () => Boolean(redisEnv());

async function redis(cmd) {
  const env = redisEnv();
  if (!env) throw new Error("Baza nije povezana (Vercel -> Storage -> Upstash Redis).");
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

export function checkPin(req) {
  const pin = process.env.ADMIN_PIN;
  if (!pin) return { ok: false, reason: "ADMIN_PIN nije postavljen u Vercel Environment Variables." };
  const given = req.headers["x-pin"] || (req.body && req.body.pin) || "";
  return String(given) === String(pin) ? { ok: true } : { ok: false, reason: "Pogrešan PIN." };
}
