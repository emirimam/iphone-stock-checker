// Okidac provjere. Prihvata: tajni kljuc (?key=..., za vanjski cron servis) ili GitHub Actions OIDC token.
import { runJob } from "../lib/job.js";
import { cronKey } from "../lib/db.js";
import { verifyGithubToken } from "../lib/auth.js";
import { sendError } from "../lib/session.js";
import { timingSafeEqual } from "node:crypto";

const same = (a, b) => {
  const x = Buffer.from(String(a || "")), y = Buffer.from(String(b || ""));
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
};

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const auth = String(req.headers.authorization || "");
    let source = "";
    if (auth.startsWith("Bearer ") && (await verifyGithubToken(auth.slice(7)))) source = "github";
    else if (same(req.query?.key, await cronKey())) source = "cron";
    if (!source) return res.status(401).json({ error: "Unauthorized" });

    const result = await runJob({ source, force: req.query?.force === "1" });
    res.status(200).json(result);
  } catch (err) {
    sendError(res, err);
  }
}
