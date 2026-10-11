// Podesavanja prijavljenog korisnika. Bez prijave: zadana podesavanja (samo pregled).
import { OPTIONS, DEFAULT_SETTINGS } from "../lib/settings.js";
import { MODELS } from "../lib/apple.js";
import { loadSettings, saveSettings, loadStatus, hasStorage } from "../lib/db.js";
import { currentUser, readBody, sendError } from "../lib/session.js";
import { sendNtfy, testMessage } from "../lib/notify.js";

const options = () => ({ ...OPTIONS, modelLabels: Object.fromEntries(MODELS.map((m) => [m.key, m.label])) });

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const me = await currentUser(req);

    if (req.method === "GET") {
      const settings = me ? await loadSettings(me.sub) : { ...DEFAULT_SETTINGS };
      const zip = /^\d{5}$/.test(String(req.query?.zip || "")) ? req.query.zip : settings.zip;
      return res.status(200).json({
        settings,
        signedIn: Boolean(me),
        options: options(),
        storage: hasStorage(),
        status: await loadStatus(zip).catch(() => null),
      });
    }

    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    if (!me) return res.status(401).json({ error: "Please sign in with Google first.", code: "sign_in" });
    const body = await readBody(req);
    const action = body.action || "save";

    if (action === "save") {
      return res.status(200).json({ ok: true, settings: await saveSettings(me.sub, body.settings || {}) });
    }

    if (action === "test") {
      const s = await loadSettings(me.sub);
      if (!s.ntfyTopic) return res.status(400).json({ error: "No ntfy topic set.", code: "no_topic" });
      const m = testMessage(s);
      const r = await sendNtfy(s, m.title, m.body, body.origin || "");
      return res.status(r.sent ? 200 : 400).json({ ok: r.sent, error: r.sent ? undefined : r.reason });
    }

    res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (err) {
    sendError(res, err);
  }
}
