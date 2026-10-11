import { discoverParts } from "../lib/apple.js";
const parts = await discoverParts();
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36";
const q = new URLSearchParams(); parts.slice(0, 10).forEach((p, i) => q.set(`parts.${i}`, p)); q.set("location", "32068");
const j = await (await fetch(`https://www.apple.com/shop/retail/pickup-message?${q}`, { headers: { "User-Agent": UA, Accept: "application/json" } })).json();
const st = j.body.stores[0];
console.log(`::notice::store keys: ${Object.keys(st).join(",")} | dist=${st.storedistance} ${st.storeDistanceWithUnit}`);
const pa = Object.values(st.partsAvailability)[0];
console.log(`::notice::part obj: ${JSON.stringify(pa).slice(0, 900)}`);
console.log(`::notice::stores: ${j.body.stores.map((s) => s.storeName + " " + s.storedistance).join(" / ")}`);
for (let i = 0; i < parts.length; i += 10) {
  const q2 = new URLSearchParams(); parts.slice(i, i + 10).forEach((p, k) => q2.set(`parts.${k}`, p)); q2.set("location", "32068");
  const j2 = await (await fetch(`https://www.apple.com/shop/retail/pickup-message?${q2}`, { headers: { "User-Agent": UA, Accept: "application/json" } })).json();
  const s0 = j2.body.stores[0].partsAvailability;
  console.log(`::notice::${Object.entries(s0).map(([p, v]) => p + "=" + (v.storePickupProductTitle || JSON.stringify(v.messageTypes || {}).slice(0, 80)) + "[" + v.pickupDisplay + "]").join(" ; ")}`);
}
