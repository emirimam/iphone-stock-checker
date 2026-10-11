// Jedan krug provjere: Apple jednom po ZIP-u, obavijesti po korisniku, rezultati u bazu.
// Pokrece ga /api/cron (vanjski cron servis ili GitHub Actions).
import { checkStock, isWanted } from "./apple.js";
import { sendNtfy, t } from "./notify.js";
import { filtersOf } from "./settings.js";
import { allUsers, legacySettings, saveStatuses } from "./db.js";
import { redis, getJson, setJson } from "./redis.js";

const APP_URL = "https://iphone-stock-checker-hazel.vercel.app";
const STATE_KEY = "iphone:notified";
const LOCK_KEY = "iphone:job-lock";
const LAST_KEY = "iphone:job-last";
const MIN_GAP_S = 5 * 60; // dva okidaca u roku od 5 min = jedan krug

export async function runJob({ force = false, source = "cron" } = {}) {
  const now = Date.now();
  if (!force) {
    const last = await getJson(LAST_KEY);
    if (last && now - Date.parse(last.at) < MIN_GAP_S * 1000) {
      return { skipped: "recent", last };
    }
  }
  const got = await redis(["SET", LOCK_KEY, String(now), "NX", "EX", 120]);
  if (got !== "OK") return { skipped: "running" };

  try {
    const users = await allUsers();
    const targets = users.filter((u) => u.settings).map((u) => ({ id: u.sub, settings: u.settings }));
    const legacy = await legacySettings();
    if (legacy) targets.push({ id: "legacy", settings: legacy });
    const zips = [...new Set(["32068", ...targets.map((x) => x.settings.zip)])];

    // Apple, jednom po ZIP-u (paralelno, ali najvise 4 odjednom)
    const results = {};
    for (let i = 0; i < zips.length; i += 4) {
      await Promise.all(zips.slice(i, i + 4).map(async (zip) => {
        try {
          results[zip] = await checkStock({ zip, maxMiles: 500, filters: {} });
        } catch (e) {
          results[zip] = { error: e.message, checkedAt: new Date().toISOString(), zip };
        }
      }));
    }

    // obavijesti po korisniku
    const prev = (await getJson(STATE_KEY)) || {};
    const next = {};
    const log = [];
    for (const { id, settings: s } of targets) {
      const r = results[s.zip];
      if (!r || r.error) { next[id] = prev[id] || {}; continue; }
      const f = filtersOf(s);
      const hits = r.stores
        .filter((st) => st.distance <= s.maxMiles)
        .flatMap((st) => st.items.filter((i) => i.available && isWanted(i, f))
          .map((i) => ({ ...i, store: st.name, storeId: st.id, distance: st.distance })));
      const mine = prev[id] || {};
      const state = {};
      const toSend = [];
      for (const h of hits) {
        const key = `${h.storeId}|${h.part}`;
        const lastSent = mine[key] || 0;
        const due = !lastSent || (s.repeatHours > 0 && now - lastSent >= s.repeatHours * 3600e3);
        if (due) toSend.push(h);
        state[key] = due ? now : lastSent;
      }
      next[id] = state;
      let sent = 0;
      if (toSend.length && s.enabled && s.ntfyTopic) {
        const lines = toSend.map((h) => `${h.title} - ${h.store} (${h.distance} mi) ${h.quote}`.trim());
        const res = await sendNtfy(s, t(s.lang).stockTitle, lines.join("\n"), APP_URL);
        if (res.sent) sent = toSend.length;
        else for (const h of toSend) delete state[`${h.storeId}|${h.part}`]; // pokusaj opet sljedeci put
      }
      log.push({ user: id === "legacy" ? "legacy" : id.slice(-4), zip: s.zip, hits: hits.length, sent });
    }
    await setJson(STATE_KEY, next);

    const statuses = Object.fromEntries(Object.entries(results).map(([zip, r]) => [zip, { ...r, source: "github" }]));
    await saveStatuses(statuses);

    const summary = {
      at: new Date().toISOString(),
      source,
      users: targets.length,
      zips: zips.length,
      ms: Date.now() - now,
      errors: Object.values(results).filter((r) => r.error).map((r) => `${r.zip}: ${r.error}`),
      log,
    };
    await setJson(LAST_KEY, summary);
    return summary;
  } finally {
    await redis(["DEL", LOCK_KEY]);
  }
}

export const lastRun = () => getJson(LAST_KEY);
