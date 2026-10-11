// Google prijava: GET = ko sam ja + konfiguracija, POST = prijava Google tokenom, DELETE = odjava.
import { getConfig, upsertUser, pinConfigured, ownerSub, hasStorage } from "../lib/db.js";
import { verifyGoogleToken } from "../lib/auth.js";
import { createSession, clearSession, currentUser, readBody, sendError } from "../lib/session.js";

const view = (u) => u && {
  email: u.profile.email, name: u.profile.name, picture: u.profile.picture, isOwner: u.isOwner,
};

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET") {
      const storage = hasStorage();
      const [config, me] = await Promise.all([storage ? getConfig() : { googleClientId: "" }, currentUser(req)]);
      return res.status(200).json({
        storage,
        googleClientId: config.googleClientId,
        pinConfigured: storage ? await pinConfigured() : false,
        ownerExists: storage ? Boolean(await ownerSub()) : false,
        user: view(me),
      });
    }

    if (req.method === "POST") {
      const body = await readBody(req);
      const { googleClientId } = await getConfig();
      const profile = await verifyGoogleToken(body.credential, googleClientId);
      if (!profile) return res.status(401).json({ error: "Google sign-in could not be verified.", code: "google_failed" });
      await upsertUser(profile);
      await createSession(res, profile.sub);
      const me = { profile, isOwner: (await ownerSub()) === profile.sub };
      return res.status(200).json({ user: view(me) });
    }

    if (req.method === "DELETE") {
      clearSession(res);
      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    sendError(res, err);
  }
}
