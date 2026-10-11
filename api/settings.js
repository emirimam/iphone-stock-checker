import {
  OPTIONS,
  hasStorage,
  loadSettings,
  saveSettings,
  loadStatus,
  saveStatus,
  publicView,
  authorize,
  pinConfigured,
  setPin,
} from "../lib/settings.js";
import { MODELS } from "../lib/apple.js";
import { sendNtfy, testMessage } from "../lib/notify.js";

const options = () => ({ ...OPTIONS, modelLabels: Object.fromEntries(MODELS.map((m) => [m.key, m.label])) });

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET") {
      const storage = hasStorage();
      const settings = await loadSettings();
      const auth = storage ? await authorize(req) : { ok: false };
      return res.status(200).json({
        settings: auth.ok ? settings : publicView(settings),
        authorized: auth.ok,
        options: options(),
        storage,
        pinConfigured: storage ? await pinConfigured() : false,
        status: storage ? await loadStatus().catch(() => null) : null,
      });
    }

    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const body = req.body || {};
    const action = body.action || "save";

    // Prvo postavljanje PIN-a (radi samo dok PIN ne postoji)
    if (action === "setpin") {
      await setPin(body.newPin);
      return res.status(200).json({ ok: true, settings: await loadSettings() });
    }

    const auth = await authorize(req);
    if (!auth.ok) return res.status(401).json({ error: auth.reason, code: auth.code });

    if (action === "login") return res.status(200).json({ ok: true, settings: await loadSettings() });

    if (action === "save") {
      const saved = await saveSettings(body.settings || {});
      return res.status(200).json({ ok: true, settings: saved });
    }

    if (action === "test") {
      const s = await loadSettings();
      if (!s.ntfyTopic) return res.status(400).json({ error: "No ntfy topic set.", code: "no_topic" });
      const m = testMessage(s);
      const r = await sendNtfy(s, m.title, m.body, body.origin || "");
      return res.status(r.sent ? 200 : 400).json({ ok: r.sent, ...r, error: r.sent ? undefined : r.reason });
    }

    if (action === "status") {
      if (auth.who !== "github" && auth.who !== "pin") return res.status(403).json({ error: "Forbidden" });
      await saveStatus(body.status || null);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (err) {
    const status = err.code && err.code.startsWith("pin_") ? 400 : 500;
    return res.status(status).json({ error: String(err.message || err), code: err.code });
  }
}
