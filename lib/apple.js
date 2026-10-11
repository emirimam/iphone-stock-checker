// Provjera zaliha Apple Store pickup - zajednicka logika za Vercel API i GitHub Actions.

const FAMILY_URL = "https://www.apple.com/shop/buy-iphone/iphone-18-pro";
const PICKUP_URL = "https://www.apple.com/shop/retail/pickup-message";
const CAPS = ["256gb", "512gb", "1tb", "2tb"];
const COLORS = ["black", "silver", "glacier", "burgundy"];
const PART_RE = /\b[MN][A-Z0-9]{4}LL\/A\b/g;

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: FAMILY_URL,
};

export const DEFAULTS = {
  zip: "32068",
  maxMiles: 60,
  model: "pro max",
};

async function get(url, json = false) {
  const res = await fetch(url, {
    headers: { ...HEADERS, Accept: json ? "application/json" : "text/html" },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} za ${url.split("?")[0]} (${url.length} zn.)`);
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

/** Pronadji sve part brojeve iPhone 18 Pro linije sa Apple stranice. */
export async function discoverParts() {
  if (process.env.PARTS) {
    return process.env.PARTS.split(",").map((s) => s.trim()).filter(Boolean);
  }
  // Porodicna stranica + stranice 6.9" varijanti (tu su Pro Max part brojevi)
  const urls = [FAMILY_URL, ...CAPS.map((c) => `${FAMILY_URL}/6.9-inch-display-${c}-black-unlocked`)];
  const pages = await Promise.allSettled(urls.map((u) => get(u)));
  const found = new Set();
  for (const p of pages) {
    if (p.status === "fulfilled") (p.value.match(PART_RE) || []).forEach((x) => found.add(x));
  }
  if (found.size === 0) {
    throw new Error("Nisam nasao part brojeve na apple.com (stranica promijenjena ili blokira).");
  }
  return [...found].sort();
}

function pickupUrl(zip, parts) {
  const q = new URLSearchParams();
  parts.forEach((p, i) => q.set(`parts.${i}`, p));
  q.set("location", zip);
  return `${PICKUP_URL}?${q}`;
}

function parseDistance(store) {
  const raw = store.storedistance ?? store.storeDistanceWithUnit ?? "0";
  const n = parseFloat(String(raw));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Glavna provjera. Vraca listu ducana sa statusom svake Pro Max konfiguracije.
 */
export async function checkStock({ zip, maxMiles, model } = {}) {
  zip = zip || DEFAULTS.zip;
  maxMiles = Number(maxMiles) || DEFAULTS.maxMiles;
  model = (model || DEFAULTS.model).toLowerCase();

  const parts = await discoverParts();
  const batches = [];
  for (let i = 0; i < parts.length; i += 10) batches.push(parts.slice(i, i + 10));

  const responses = await Promise.all(batches.map((b) => get(pickupUrl(zip, b), true)));

  const stores = new Map();
  const products = {};
  const seenTitles = new Set();
  for (const data of responses) {
    for (const st of findKey(data, "stores") || []) {
      const dist = parseDistance(st);
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
        const title = findKey(pa, "storePickupProductTitle") || part;
        seenTitles.add(title);
        if (!title.toLowerCase().includes(model)) continue;
        products[part] = title;
        entry.items.push({
          part,
          title,
          available: pa.pickupDisplay === "available",
          quote: findKey(pa, "pickupSearchQuote") || findKey(pa, "storePickupQuote") || "",
        });
      }
    }
  }

  const list = [...stores.values()]
    .map((s) => ({ ...s, items: s.items.sort((a, b) => a.title.localeCompare(b.title)) }))
    .sort((a, b) => a.distance - b.distance);

  const available = list.flatMap((s) =>
    s.items
      .filter((i) => i.available)
      .map((i) => ({ key: `${s.id}|${i.part}`, store: s.name, distance: s.distance, title: i.title, quote: i.quote }))
  );

  return {
    checkedAt: new Date().toISOString(),
    zip,
    maxMiles,
    partsChecked: parts.length,
    productsMatched: Object.keys(products).length,
    stores: list,
    available,
    sampleTitles: [...seenTitles],
    buyUrl: FAMILY_URL,
  };
}
