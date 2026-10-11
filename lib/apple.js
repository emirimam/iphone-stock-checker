// Provjera zaliha Apple Store pickup - zajednicka logika za Vercel API i GitHub Actions.

const SHOP = "https://www.apple.com/shop/buy-iphone";
const FAMILIES = ["iphone-18-pro", "iphone-air", "iphone-17", "iphone-17e"];
const PRO_VARIANTS = ["256gb", "512gb", "1tb", "2tb"].map(
  (c) => `${SHOP}/iphone-18-pro/6.9-inch-display-${c}-black-unlocked`
);
const PICKUP_URL = "https://www.apple.com/shop/retail/pickup-message";
const PART_RE = /\b[MN][A-Z0-9]{4}LL\/A\b/g;
export const BUY_URL = `${SHOP}/iphone-18-pro`;

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: BUY_URL,
};

/** Modeli koje prepoznajemo iz Apple naziva, od najspecificnijeg. */
export const MODELS = [
  { key: "18 pro max", label: "iPhone 18 Pro Max", re: /iphone 18 pro max/ },
  { key: "18 pro", label: "iPhone 18 Pro", re: /iphone 18 pro/ },
  { key: "air", label: "iPhone Air", re: /iphone air/ },
  { key: "17e", label: "iPhone 17e", re: /iphone 17e/ },
  { key: "17", label: "iPhone 17", re: /iphone 17/ },
];

async function get(url, json = false) {
  const res = await fetch(url, {
    headers: { ...HEADERS, Accept: json ? "application/json" : "text/html" },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} za ${url.split("?")[0]}`);
  return json ? res.json() : res.text();
}

function findKey(obj, key) {
  if (Array.isArray(obj)) {
    for (const v of obj) {
      const r = findKey(v, key);
      if (r) return r;
    }
  } else if (obj && typeof obj === "object") {
    if (obj[key]) return obj[key];
    for (const v of Object.values(obj)) {
      const r = findKey(v, key);
      if (r) return r;
    }
  }
  return null;
}

/** Iz naziva "iPhone 18 Pro Max 2TB Glacier" izvuci model, memoriju i boju. */
export function parseTitle(title) {
  const t = title.replace(/\s+/g, " ").trim();
  const low = t.toLowerCase();
  const model = MODELS.find((m) => m.re.test(low));
  const st = low.match(/(\d+)\s*(gb|tb)\b/);
  const storage = st ? st[1] + st[2] : "";
  const color = st ? low.slice(low.indexOf(st[0]) + st[0].length).trim() : "";
  return { title: t, model: model ? model.key : "other", modelLabel: model ? model.label : t, storage, color };
}

export function isWanted(item, f) {
  return (
    (!f.models?.length || f.models.includes(item.model)) &&
    (!f.storages?.length || f.storages.includes(item.storage)) &&
    (!f.colors?.length || f.colors.includes(item.color))
  );
}

/** Pronadji part brojeve svih aktuelnih iPhone modela sa Apple stranica. */
export async function discoverParts() {
  if (process.env.PARTS) return process.env.PARTS.split(",").map((s) => s.trim()).filter(Boolean);
  const urls = [...FAMILIES.map((f) => `${SHOP}/${f}`), ...PRO_VARIANTS];
  const pages = await Promise.allSettled(urls.map((u) => get(u)));
  const found = new Set();
  for (const p of pages) {
    if (p.status === "fulfilled") (p.value.match(PART_RE) || []).forEach((x) => found.add(x));
  }
  if (!found.size) throw new Error("Nisam nasao part brojeve na apple.com (stranica promijenjena ili blokira).");
  return [...found].sort();
}

function pickupUrl(zip, parts) {
  const q = new URLSearchParams();
  parts.forEach((p, i) => q.set(`parts.${i}`, p));
  q.set("location", zip);
  return `${PICKUP_URL}?${q}`;
}

/**
 * Provjera. filters = { models, storages, colors } odredjuje sta je "trazeno";
 * svi ostali modeli se takodje vracaju (wanted: false).
 */
export async function checkStock({ zip = "32068", maxMiles = 60, filters = {} } = {}) {
  maxMiles = Number(maxMiles) || 60;
  const parts = await discoverParts();
  const batches = [];
  for (let i = 0; i < parts.length; i += 10) batches.push(parts.slice(i, i + 10));
  const settled = await Promise.allSettled(batches.map((b) => get(pickupUrl(zip, b), true)));
  const responses = settled.filter((s) => s.status === "fulfilled").map((s) => s.value);
  if (!responses.length) throw settled[0].reason;

  const stores = new Map();
  for (const data of responses) {
    for (const st of findKey(data, "stores") || []) {
      const dist = parseFloat(String(st.storedistance ?? st.storeDistanceWithUnit ?? "0")) || 0;
      if (dist > maxMiles) continue;
      const id = st.storeNumber || st.storeName;
      if (!stores.has(id)) {
        stores.set(id, {
          id,
          name: st.storeName,
          city: [st.city, st.state].filter(Boolean).join(", "),
          distance: dist,
          items: [],
        });
      }
      const entry = stores.get(id);
      for (const [part, pa] of Object.entries(st.partsAvailability || {})) {
        if (entry.items.some((i) => i.part === part)) continue;
        const info = parseTitle(String(findKey(pa, "storePickupProductTitle") || part));
        const item = {
          part,
          ...info,
          available: pa.pickupDisplay === "available",
          quote: String(findKey(pa, "pickupSearchQuote") || findKey(pa, "storePickupQuote") || ""),
        };
        item.wanted = isWanted(item, filters);
        entry.items.push(item);
      }
    }
  }

  const order = (i) => MODELS.findIndex((m) => m.key === i.model);
  const list = [...stores.values()]
    .map((s) => ({ ...s, items: s.items.sort((a, b) => order(a) - order(b) || a.title.localeCompare(b.title)) }))
    .sort((a, b) => a.distance - b.distance);

  const flat = list.flatMap((s) =>
    s.items.filter((i) => i.available).map((i) => ({
      key: `${s.id}|${i.part}`,
      store: s.name,
      distance: s.distance,
      title: i.title,
      model: i.model,
      quote: i.quote,
      wanted: i.wanted,
    }))
  );

  return {
    checkedAt: new Date().toISOString(),
    zip,
    maxMiles,
    filters,
    partsChecked: parts.length,
    wantedConfigs: list.reduce((n, s) => n + s.items.filter((i) => i.wanted).length, 0),
    stores: list,
    available: flat.filter((a) => a.wanted),
    otherAvailable: flat.filter((a) => !a.wanted),
    buyUrl: BUY_URL,
  };
}
