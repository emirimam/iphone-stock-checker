import { checkStock } from "../lib/apple.js";

export default async function handler(req, res) {
  const { zip, miles, model } = req.query || {};
  try {
    const result = await checkStock({ zip, maxMiles: miles, model });
    res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=60");
    res.status(200).json(result);
  } catch (err) {
    res.status(502).json({ error: String(err.message || err), checkedAt: new Date().toISOString() });
  }
}
