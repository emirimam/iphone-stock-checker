// Vlasnik: statistika posjeta i korisnici. Takodje: prvo postavljanje PIN-a, Google Client ID, preuzimanje vlasnistva.
import { stats, allUsers, claimOwner, setGoogleClientId, setPin, checkPin, pinConfigured, ownerSub } from "../lib/db.js";
import { currentUser, readBody, sendError } from "../lib/session.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const me = await currentUser(req);

    if (req.method === "GET") {
      if (!me?.isOwner) return res.status(403).json({ error: "Owner only.", code: "owner_only" });
      const [s, users] = await Promise.all([stats(30), allUsers()]);
      return res.status(200).json({
        stats: s,
        users: users
          .map((u) => ({
            email: u.profile.email || "",
            name: u.profile.name || "",
            createdAt: u.profile.createdAt,
            lastSeen: u.profile.lastSeen,
            logins: u.profile.logins || 0,
            zip: u.settings?.zip || "",
            models: u.settings?.models || [],
            notifications: Boolean(u.settings?.enabled && u.settings?.ntfyTopic),
            isOwner: u.sub === me.sub,
          }))
          .sort((a, b) => String(b.lastSeen).localeCompare(String(a.lastSeen))),
      });
    }

    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const body = await readBody(req);

    // Prvi PIN (samo dok ne postoji)
    if (body.action === "setpin") {
      await setPin(body.newPin);
      return res.status(200).json({ ok: true });
    }

    // Google Client ID: vlasnik ili PIN (prije nego sto prijava uopste radi)
    if (body.action === "clientId") {
      const allowed = me?.isOwner || (!(await ownerSub()) && (await pinConfigured()) && (await checkPin(body.pin)));
      if (!allowed) return res.status(403).json({ error: "Wrong PIN.", code: "pin_wrong" });
      await setGoogleClientId(body.clientId);
      return res.status(200).json({ ok: true });
    }

    // Postani vlasnik (prijavljen + PIN)
    if (body.action === "claim") {
      if (!me) return res.status(401).json({ error: "Please sign in with Google first.", code: "sign_in" });
      await claimOwner(me.sub, body.pin);
      return res.status(200).json({ ok: true });
    }

    res.status(400).json({ error: `Unknown action: ${body.action}` });
  } catch (err) {
    sendError(res, err);
  }
}
