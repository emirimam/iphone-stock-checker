const urls = [
  "https://iphone-stock-checker-hazel.vercel.app",
  "https://iphone-stock-checker-emirimamovice-5317s-projects.vercel.app",
  "https://iphone-stock-checker-git-main-emirimamovice-5317s-projects.vercel.app",
  "https://iphone-stock-checker-emirimam.vercel.app",
  ...(process.argv.slice(2)),
];
for (const u of urls) {
  for (const path of ["/", "/api/settings"]) {
    try {
      const r = await fetch(u + path, { redirect: "manual", signal: AbortSignal.timeout(15000) });
      const t = (await r.text()).replace(/\s+/g, " ").slice(0, 160);
      console.log(`::notice::[${r.status}] ${u}${path} loc=${r.headers.get("location") || ""} | ${t}`);
    } catch (e) {
      console.log(`::notice::[ERR] ${u}${path} ${e.message}`);
    }
  }
}
