// Provjera uzivo. Vraca sve dućane koje Apple vrati za ZIP; filtriranje (trazeno, udaljenost) radi stranica.
import { checkStock } from "../lib/apple.js";
import { loadSettings } from "../lib/db.js";
import { currentUser, sendError } from "../lib/session.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const me = await currentUser(req).catch(() => null);
    const s = me ? await loadSettings(me.sub) : null;
    const q = req.query || {};
    const zip = /^\d{5}$/.test(String(q.zip || "")) ? q.zip : s?.zip || "32068";
    const result = await checkStock({ zip, maxMiles: 500, filters: {} });
    res.status(200).json({ source: "live", ...result });
  } catch (err) {
    sendError(res, err);
  }
}
