const u = process.argv[2] || "https://iphone-stock-checker-hazel.vercel.app";
for (const p of ["/api/auth", "/api/settings", "/"]) {
  const r = await fetch(u + p); const t = await r.text();
  let info = t.slice(0, 120).replace(/\s+/g, " ");
  try { const j = JSON.parse(t); info = p === "/api/auth" ? `storage=${j.storage} clientId=${!!j.googleClientId} pin=${j.pinConfigured} owner=${j.ownerExists} user=${j.user}` : `signedIn=${j.signedIn} status=${j.status?.source} ${j.status?.zip} stores=${j.status?.stores?.length}`; } catch {}
  console.log(`::notice::[${r.status}] ${p} ${info}`);
}
const t = await fetch(u + "/api/track", { method: "POST", headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" }, body: "{}" });
console.log(`::notice::[${t.status}] /api/track (test posjeta se ne broji jer je server)`);
