// Samo za GitHub Actions (potpisani OIDC token): lista korisnika za obavijesti i spremanje rezultata po ZIP-u.
import { verifyGithubToken } from "../lib/auth.js";
import { allUsers, legacySettings, saveStatuses } from "../lib/db.js";
import { readBody, sendError } from "../lib/session.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const auth = String(req.headers.authorization || "");
    if (!auth.startsWith("Bearer ") || !(await verifyGithubToken(auth.slice(7))))
      return res.status(401).json({ error: "GitHub token required." });

    if (req.method === "GET") {
      const users = await allUsers();
      const targets = users
        .filter((u) => u.settings)
        .map((u) => ({ id: u.sub, settings: u.settings }));
      const legacy = await legacySettings();
      if (legacy) targets.push({ id: "legacy", settings: legacy });
      const zips = [...new Set(["32068", ...targets.map((t) => t.settings.zip)])];
      return res.status(200).json({ targets, zips });
    }

    if (req.method === "POST") {
      const body = await readBody(req);
      await saveStatuses(body.statuses || {});
      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    sendError(res, err);
  }
}
