// Dijagnostika: koje varijante zahtjeva Apple prihvata sa GitHub servera.
const out = (m) => console.log(`::notice::${String(m).replace(/\r?\n/g, "%0A")}`);
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36";
const FAMILY = "https://www.apple.com/shop/buy-iphone/iphone-18-pro";
const VARIANT = FAMILY + "/6.9-inch-display-256gb-black-unlocked";

const jar = new Map();
function store(res) {
  for (const c of res.headers.getSetCookie?.() || []) {
    const [kv] = c.split(";");
    const i = kv.indexOf("=");
    jar.set(kv.slice(0, i).trim(), kv.slice(i + 1));
  }
}
const cookie = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");

async function go(url, extra = {}) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9", Cookie: cookie(), ...extra },
    redirect: "follow",
    signal: AbortSignal.timeout(20000),
  });
  store(res);
  return { status: res.status, text: await res.text() };
}

// 1) posjeti stranice kao preglednik
const fam = await go(FAMILY, { Accept: "text/html" });
const v = await go(VARIANT, { Accept: "text/html" });
out(`family ${fam.status}, variant ${v.status}, kolacici: ${[...jar.keys()].join(",")}`);

// Part broj sa stranice varijante (256GB Black Pro Max)
const parts = [...new Set(v.text.match(/\b[MN][A-Z0-9]{4}LL\/A\b/g) || [])];
out(`variant parts: ${parts.slice(0, 10).join(" ")}`);
// Pokusaj naci "partNumber" / fulfillment url u HTML-u
const hints = [...new Set(v.text.match(/\/shop\/[a-z\-\/]*(fulfillment|pickup|retail)[a-z\-\/]*/gi) || [])];
out(`URL tragovi u HTML-u: ${hints.slice(0, 15).join(" ")}`);
const pn = (v.text.match(/"partNumber"\s*:\s*"([^"]+)"/) || [])[1];
out(`prvi partNumber JSON: ${pn}`);

const p = pn || parts[0];
const tries = {
  "fulfillment + kolacici": `https://www.apple.com/shop/fulfillment-messages?pl=true&mts.0=regular&parts.0=${encodeURIComponent(p)}&location=32068`,
  "fulfillment + kolacici + fae": `https://www.apple.com/shop/fulfillment-messages?fae=true&pl=true&mts.0=regular&mts.1=compact&parts.0=${encodeURIComponent(p)}&location=32068`,
  "pickup-message-recommendations": `https://www.apple.com/shop/pickup-message-recommendations?mts.0=regular&location=32068&product=${encodeURIComponent(p)}`,
  "retail/pickup-message": `https://www.apple.com/shop/retail/pickup-message?parts.0=${encodeURIComponent(p)}&location=32068`,
};
for (const [name, url] of Object.entries(tries)) {
  try {
    const r = await go(url, {
      Accept: "application/json, text/javascript, */*; q=0.01",
      Referer: VARIANT,
      "X-Requested-With": "XMLHttpRequest",
      "x-aos-ui-fetch-call-1": "true",
    });
    let info = r.text.slice(0, 120);
    try {
      const j = JSON.parse(r.text);
      const st = j?.body?.content?.pickupMessage?.stores || j?.body?.stores || [];
      info = `JSON stores=${st.length} first=${st[0]?.storeName || ""} disp=${JSON.stringify(st[0]?.partsAvailability || {}).slice(0, 160)}`;
    } catch {}
    out(`[${r.status}] ${name}: ${info}`);
  } catch (e) {
    out(`[ERR] ${name}: ${e.message}`);
  }
  await new Promise((r) => setTimeout(r, 1500));
}
