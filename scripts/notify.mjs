// Pokrece GitHub Actions svakih 15 min:
// 1) od stranice uzme listu korisnika (prijava GitHub OIDC tokenom),
// 2) provjeri Apple jednom po ZIP-u, 3) svakom korisniku posalje obavijest po njegovim filterima,
// 4) vrati rezultate stranici (prikaz "zadnja automatska provjera").
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { checkStock, isWanted } from "../lib/apple.js";
import { sendNtfy, t } from "../lib/notify.js";
import { filtersOf } from "../lib/settings.js";

const APP_URL = (process.env.APP_URL || "https://iphone-stock-checker-hazel.vercel.app").replace(/\/+$/, "");
const STATE = "state/state.json";
const gh = (level, msg) => console.log(`::${level}::${String(msg).replace(/\r?\n/g, "%0A")}`);

async function githubToken() {
  const url = process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
  const tok = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if (!url || !tok) throw new Error("GitHub OIDC nije dostupan (treba permissions: id-token: write)");
  const res = await fetch(`${url}&audience=iphone-stock-checker`, { headers: { Authorization: `Bearer ${tok}` } });
  return (await res.json()).value;
}

async function jobs(method, body) {
  const res = await fetch(`${APP_URL}/api/jobs`, {
    method,
    headers: { Authorization: `Bearer ${await githubToken()}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// --- 1) korisnici
let targets = [], zips = ["32068"];
try {
  ({ targets, zips } = await jobs("GET"));
} catch (e) {
  gh("error", `Ne mogu dobiti listu korisnika sa ${APP_URL}: ${e.message}`);
  process.exit(1);
}

// --- 2) Apple, jednom po ZIP-u
const results = {};
for (const zip of zips) {
  try {
    results[zip] = await checkStock({ zip, maxMiles: 500, filters: {} });
  } catch (e) {
    gh("warning", `ZIP ${zip}: ${e.message}`);
    results[zip] = { error: e.message, checkedAt: new Date().toISOString(), zip };
  }
}

// --- 3) obavijesti po korisniku
const now = Date.now();
let prev = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : {};
if (Object.keys(prev).some((k) => k.includes("|"))) prev = { legacy: prev }; // stari format stanja
const next = {};
const log = [];

for (const { id, settings: s } of targets) {
  const r = results[s.zip];
  if (!r || r.error) continue;
  const f = filtersOf(s);
  const hits = r.stores
    .filter((st) => st.distance <= s.maxMiles)
    .flatMap((st) => st.items.filter((i) => i.available && isWanted(i, f)).map((i) => ({ ...i, store: st.name, storeId: st.id, distance: st.distance })));
  const mine = prev[id] || {};
  const state = {};
  const toSend = [];
  for (const h of hits) {
    const key = `${h.storeId}|${h.part}`;
    const last = mine[key] || 0;
    const due = !last || (s.repeatHours > 0 && now - last >= s.repeatHours * 3600e3);
    if (due) toSend.push(h);
    state[key] = due ? now : last;
  }
  next[id] = state;

  let outcome = `${hits.length} na stanju`;
  if (toSend.length && s.enabled && s.ntfyTopic) {
    const lines = toSend.map((h) => `${h.title} - ${h.store} (${h.distance} mi) ${h.quote}`.trim());
    const res = await sendNtfy(s, t(s.lang).stockTitle, lines.join("\n"), APP_URL);
    outcome += res.sent ? `, poslano ${toSend.length}` : `, NIJE poslano (${res.reason})`;
  } else if (toSend.length) {
    outcome += ", obavijesti iskljucene ili bez topica";
  }
  log.push(`${id === "legacy" ? "legacy" : id.slice(-4)} ZIP ${s.zip}/${s.maxMiles}mi [${f.models.join(",")}]: ${outcome}`);
}
writeFileSync(STATE, JSON.stringify(next));

// --- 4) rezultati stranici
const statuses = Object.fromEntries(Object.entries(results).map(([zip, r]) => [zip, { ...r, source: "github" }]));
try {
  await jobs("POST", { statuses });
} catch (e) {
  gh("warning", `Rezultati nisu spremljeni: ${e.message}`);
}

const zipInfo = Object.entries(results).map(([zip, r]) =>
  r.error ? `${zip}: greska` : `${zip}: ${r.stores.length} ducana, ${r.stores.reduce((n, s) => n + s.items.filter((i) => i.available).length, 0)} konfig. na stanju`
);
gh("notice", `Korisnika: ${targets.length}, ZIP-ova: ${zips.length}%0A${zipInfo.join("%0A")}%0A${log.join("%0A")}`);
