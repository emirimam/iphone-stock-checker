// Shema podesavanja korisnika (bez pristupa bazi).

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

export const filtersOf = (s) => ({ models: s.models, storages: s.storages, colors: s.colors });
