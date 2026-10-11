const u = process.argv[2] || "https://iphone-stock-checker-hazel.vercel.app";
for (let i = 0; i < 3; i++) {
  const t0 = Date.now();
  try {
    const r = await fetch(`${u}/api/check?nocache=${Date.now()}`, { signal: AbortSignal.timeout(70000) });
    const txt = await r.text();
    let info = txt.slice(0, 300).replace(/\s+/g, " ");
    try { const c = JSON.parse(txt); info = c.error || `stores=${c.stores?.length} wanted=${c.wantedConfigs} other=${c.otherAvailable?.length}`; } catch {}
    console.log(`::notice::try ${i + 1}: [${r.status}] ${Date.now() - t0} ms ${r.headers.get("x-vercel-cache") || ""} | ${info}`);
  } catch (e) {
    console.log(`::notice::try ${i + 1}: ERR after ${Date.now() - t0} ms ${e.message}`);
  }
}
