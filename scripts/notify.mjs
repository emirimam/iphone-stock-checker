// Pokrece GitHub Actions svakih 15 min:
// 1) procita podesavanja sa Vercel stranice, 2) provjeri Apple, 3) posalje ntfy za trazene modele,
// 4) vrati rezultat na stranicu da se prikaze kao "zadnja automatska provjera".
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { checkStock } from "../lib/apple.js";
import { sendNtfy } from "../lib/notify.js";
import { sanitize, filtersOf } from "../lib/settings.js";

const APP_URL = (process.env.APP_URL || "").replace(/\/+$/, "");
const PIN = process.env.ADMIN_PIN || "";
const STATE = "state/state.json";

const gh = (level, msg) => console.log(`::${level}::${String(msg).replace(/\r?\n/g, "%0A")}`);

async function api(method, body) {
  const res = await fetch(`${APP_URL}/api/settings`, {
    method,
    headers: { "x-pin": PIN, "Content-Type": "application/json" },
    body: body ? JSON.stringify({ pin: PIN, ...body }) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// --- 1) podesavanja
let settings = sanitize({
  ntfyTopic: process.env.NTFY_TOPIC || "",
  zip: process.env.ZIP,
  maxMiles: process.env.MAX_MILES,
});
let fromApp = false;
if (APP_URL && PIN) {
  try {
    const data = await api("GET");
    if (data.authorized) {
      settings = sanitize({ ...data.settings, ntfyTopic: data.settings.ntfyTopic || settings.ntfyTopic });
      fromApp = true;
    } else gh("warning", "PIN nije prihvacen na stranici - koristim zadana podesavanja.");
  } catch (e) {
    gh("warning", `Ne mogu procitati podesavanja sa stranice (${e.message}) - koristim zadana.`);
  }
}

if (process.argv.includes("--test")) {
  const r = await sendNtfy(settings, "Test obavijesti", "GitHub provjera je podesena. Poruke stizu ovdje.", APP_URL);
  gh(r.sent ? "notice" : "error", `Probna poruka: ${r.sent ? "poslana" : r.reason}`);
  process.exit(r.sent ? 0 : 1);
}

// --- 2) provjera
let result;
try {
  result = await checkStock({ zip: settings.zip, maxMiles: settings.maxMiles, filters: filtersOf(settings) });
} catch (err) {
  gh("error", `Provjera nije uspjela: ${err.message}`);
  if (fromApp) await api("POST", { action: "status", status: { error: err.message, checkedAt: new Date().toISOString() } }).catch(() => {});
  process.exit(1);
}

// --- 3) obavijesti
const now = Date.now();
const prev = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : {};
const state = {};
const toSend = [];
for (const a of result.available) {
  const last = Array.isArray(prev) ? (prev.includes(a.key) ? now : 0) : prev[a.key] || 0;
  const due = !last || (settings.repeatHours > 0 && now - last >= settings.repeatHours * 3600e3);
  if (due) toSend.push(a);
  state[a.key] = due ? now : last;
}
writeFileSync(STATE, JSON.stringify(state));

let notified = "";
if (!settings.enabled) {
  notified = "obavijesti iskljucene";
} else if (toSend.length) {
  const lines = toSend.map((a) => `${a.title} - ${a.store} (${a.distance} mi) ${a.quote}`.trim());
  const r = await sendNtfy(settings, "iPhone na stanju!", lines.join("\n"), APP_URL || result.buyUrl);
  notified = r.sent ? `poslano (${toSend.length})` : `NIJE poslano: ${r.reason}`;
  gh(r.sent ? "notice" : "error", `Obavijest ${notified}:%0A${lines.join("%0A")}`);
} else {
  notified = "nista novo";
}

const summary = result.stores.map((s) => {
  const w = s.items.filter((i) => i.wanted);
  return `${s.name} (${s.distance} mi): trazeno ${w.filter((i) => i.available).length}/${w.length}, ostalo dostupno ${s.items.filter((i) => !i.wanted && i.available).length}`;
});
gh(
  "notice",
  `${result.partsChecked} part br., ${result.wantedConfigs} trazenih konfig., podesavanja: ${fromApp ? "sa stranice" : "zadana"}, obavijest: ${notified}%0A` +
    summary.join("%0A")
);

// --- 4) rezultat nazad na stranicu
if (fromApp) {
  const compact = {
    ...result,
    source: "github",
    notified,
    stores: result.stores.map((s) => ({
      ...s,
      items: s.items.map(({ part, title, model, storage, color, available, quote, wanted }) => ({
        part, title, model, storage, color, available, quote, wanted,
      })),
    })),
  };
  await api("POST", { action: "status", status: compact }).catch((e) => gh("warning", `Status nije spremljen: ${e.message}`));
}
