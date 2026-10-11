// Brojac posjeta: anonimni ID posjetioca iz preglednika, bez IP adresa i kolacica za pracenje.
import { trackVisit, hasStorage } from "../lib/db.js";
import { readBody } from "../lib/session.js";

const BOT = /bot|crawl|spider|slurp|preview|monitor|curl|wget|python|node-fetch|headless/i;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).end();
  try {
    if (hasStorage() && !BOT.test(String(req.headers["user-agent"] || ""))) {
      const body = await readBody(req);
      await trackVisit(body.vid, body.path);
    }
  } catch {
    // brojac nikad ne smije srusiti stranicu
  }
  res.status(204).end();
}
