import { checkStock } from "../lib/apple.js";
import { loadSettings, filtersOf } from "../lib/settings.js";

const list = (v) => (v ? String(v).split(",").map((s) => s.trim().toLowerCase()).filter(Boolean) : null);

export default async function handler(req, res) {
  try {
    const s = await loadSettings().catch(() => null);
    const q = req.query || {};
    const filters = {
      models: list(q.models) ?? s?.models ?? ["18 pro max"],
      storages: list(q.storages) ?? s?.storages ?? [],
      colors: list(q.colors) ?? s?.colors ?? [],
    };
    const result = await checkStock({
      zip: q.zip || s?.zip || "32068",
      maxMiles: q.miles || s?.maxMiles || 60,
      filters: s && !q.models ? filtersOf(s) : filters,
    });
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ source: "live", ...result });
  } catch (err) {
    res.status(502).json({ error: String(err.message || err), checkedAt: new Date().toISOString() });
  }
}
