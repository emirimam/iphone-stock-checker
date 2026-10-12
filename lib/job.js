// Jedan krug provjere: Apple jednom po ZIP-u, obavijesti po korisniku, rezultati u bazu.
// Pokrece ga /api/cron (vanjski cron servis ili GitHub Actions).
import { checkStock, isWanted } from "./apple.js";
import { sendNtfy, t } from "./notify.js";
import { filtersOf } from "./settings.js";
import { allUsers, legacySettings, saveStatuses } from "./db.js";
import { redis, pipeline, getJson, setJson } from "./redis.js";

const APP_URL = "https://iphone-stock-checker-hazel.vercel.app";
const STATE_KEY = "iphone:notified";
const LOCK_KEY = "iphone:job-lock";
const LAST_KEY = "iphone:job-last";
const HISTORY_KEY = "iphone:alerts";
const MIN_GAP_S = 2 * 60; // dva okidaca u roku od 2 min = jedan krug

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
    const history = [];
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
        const old = mine[key];
        const lastSent = typeof old === "number" ? old : old?.t || 0; // stari format: samo broj
        const due = !lastSent || (s.repeatHours > 0 && now - lastSent >= s.repeatHours * 3600e3);
        if (due) toSend.push(h);
        state[key] = { t: due ? now : lastSent, title: h.title, store: h.store, since: old?.since || now };
      }
      // modeli za koje je stigla obavijest, a sada ih vise nema
      const gone = Object.entries(mine)
        .filter(([k, v]) => !state[k] && v && typeof v === "object" && v.title)
        .map(([, v]) => v);
      next[id] = state;
      let sent = 0;
      const notify = s.enabled && s.ntfyTopic;
      if (toSend.length && notify) {
        const lines = toSend.map((h) => `${h.title} - ${h.store} (${h.distance} mi) ${h.quote}`.trim());
        const res = await sendNtfy(s, t(s.lang).stockTitle, lines.join("\n"), APP_URL);
        if (res.sent) {
          sent = toSend.length;
          history.push(...toSend.map((h) => ({ at: new Date(now).toISOString(), user: id, type: "in", title: h.title, store: h.store, quote: h.quote })));
        } else for (const h of toSend) delete state[`${h.storeId}|${h.part}`]; // pokusaj opet sljedeci put
      }
      if (gone.length && notify) {
        const lines = gone.map((g) => {
          const mins = Math.max(1, Math.round((now - (g.since || g.t)) / 60000));
          return t(s.lang).goneLine(g.title, g.store, mins);
        });
        const res = await sendNtfy({ ...s, priority: "low" }, t(s.lang).goneTitle, lines.join("\n"), APP_URL);
        if (res.sent) history.push(...gone.map((g) => ({ at: new Date(now).toISOString(), user: id, type: "gone", title: g.title, store: g.store, mins: Math.max(1, Math.round((now - (g.since || g.t)) / 60000)) })));
      }
      log.push({ user: id === "legacy" ? "legacy" : id.slice(-4), zip: s.zip, hits: hits.length, sent, gone: gone.length });
    }
    await setJson(STATE_KEY, next);
    if (history.length) {
      await pipeline([
        ["LPUSH", HISTORY_KEY, ...history.map((h) => JSON.stringify(h))],
        ["LTRIM", HISTORY_KEY, 0, 199],
      ]);
    }

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

/** Zadnjih N obavijesti (najnovije prve). */
export async function alertHistory(n = 50) {
  const rows = (await redis(["LRANGE", HISTORY_KEY, 0, n - 1])) || [];
  return rows.map((r) => { try { return JSON.parse(r); } catch { return null; } }).filter(Boolean);
}
