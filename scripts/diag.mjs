// Dijagnostika: koje varijante zahtjeva Apple prihvata sa GitHub servera.
import { discoverParts } from "../lib/apple.js";

const out = (m) => console.log(`::notice::${String(m).replace(/\r?\n/g, "%0A")}`);
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36";

const parts = await discoverParts();
out(`Pronadjeno ${parts.length} part br.: ${parts.slice(0, 12).join(" ")}`);
const p = parts[0];

const variants = {
  "1 part, pl+mts": `parts.0=${p}&location=32068&pl=true&mts.0=regular`,
  "1 part, samo location": `parts.0=${p}&location=32068`,
  "1 part, fae+mts compact": `fae=true&pl=true&mts.0=regular&mts.1=compact&parts.0=${p}&location=32068`,
  "1 part, searchNearby": `pl=true&mts.0=regular&parts.0=${p}&searchNearby=true&location=32068`,
  "2 parts": `pl=true&mts.0=regular&parts.0=${p}&parts.1=${parts[1]}&location=32068`,
  "ZIP sa tackom": `pl=true&mts.0=regular&parts.0=${p}&location=Middleburg,%20FL%2032068`,
};

for (const [name, q] of Object.entries(variants)) {
  for (const [hname, headers] of Object.entries({
    browser: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9", Accept: "application/json" },
    "browser+ref": {
      "User-Agent": UA,
      Accept: "application/json",
      Referer: "https://www.apple.com/shop/buy-iphone/iphone-18-pro",
      "x-aos-ui-fetch-call-1": "true",
    },
  })) {
    try {
      const r = await fetch(`https://www.apple.com/shop/fulfillment-messages?${q}`, {
        headers,
        signal: AbortSignal.timeout(15000),
      });
      const t = await r.text();
      let info = t.slice(0, 160);
      try {
        const j = JSON.parse(t);
        const st = j?.body?.content?.pickupMessage?.stores || [];
        info = `stores=${st.length} errMsg=${j?.body?.content?.pickupMessage?.errorMessage || ""} first=${st[0]?.storeName || ""} disp=${st[0]?.partsAvailability?.[p]?.pickupDisplay || ""}`;
      } catch {}
      out(`[${r.status}] ${name} / ${hname}: ${info}`);
    } catch (e) {
      out(`[ERR] ${name} / ${hname}: ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
}
