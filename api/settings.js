import {
  OPTIONS,
  hasStorage,
  loadSettings,
  saveSettings,
  loadStatus,
  saveStatus,
  publicView,
  checkPin,
} from "../lib/settings.js";
import { MODELS } from "../lib/apple.js";
import { sendNtfy } from "../lib/notify.js";

const options = () => ({ ...OPTIONS, modelLabels: Object.fromEntries(MODELS.map((m) => [m.key, m.label])) });

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET") {
      const settings = await loadSettings();
      const auth = checkPin(req);
      return res.status(200).json({
        settings: auth.ok ? settings : publicView(settings),
        authorized: auth.ok,
        options: options(),
        storage: hasStorage(),
        pinConfigured: Boolean(process.env.ADMIN_PIN),
        status: await loadStatus().catch(() => null),
      });
    }

    if (req.method !== "POST") return res.status(405).json({ error: "Metoda nije dozvoljena" });

    const auth = checkPin(req);
    if (!auth.ok) return res.status(401).json({ error: auth.reason });
    const body = req.body || {};
    const action = body.action || "save";

    if (action === "login") {
      return res.status(200).json({ ok: true, settings: await loadSettings() });
    }

    if (action === "save") {
      const saved = await saveSettings(body.settings || {});
      return res.status(200).json({ ok: true, settings: saved });
    }

    if (action === "test") {
      const s = await loadSettings();
      const r = await sendNtfy(
        s,
        "Test obavijesti",
        `Obavijesti rade. Pratim: ${s.models.join(", ")} kod ZIP ${s.zip} (do ${s.maxMiles} mi).`,
        body.origin || ""
      );
      return res.status(r.sent ? 200 : 400).json({ ok: r.sent, ...r });
    }

    if (action === "status") {
      await saveStatus(body.status || null);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: `Nepoznata akcija: ${action}` });
  } catch (err) {
    return res.status(500).json({ error: String(err.message || err) });
  }
}
