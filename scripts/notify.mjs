// Pokrece GitHub Actions svakih 15 min: provjeri zalihe i posalji ntfy poruku za NOVE pojave.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { checkStock } from "../lib/apple.js";

const TOPIC = process.env.NTFY_TOPIC;
const STATE = "state/state.json";
const APP_URL = process.env.APP_URL || "";

async function notify(title, message, click) {
  if (!TOPIC) {
    console.log("NTFY_TOPIC nije postavljen, preskacem slanje:", title);
    return;
  }
  const res = await fetch(`https://ntfy.sh/${TOPIC}`, {
    method: "POST",
    body: message,
    headers: { Title: title, Priority: "high", Tags: "iphone", Click: click },
  });
  console.log("ntfy:", res.status);
}

if (process.argv.includes("--test")) {
  await notify("Test", "iPhone provjera je podesena. Poruke stizu ovdje.", APP_URL || "https://ntfy.sh");
  process.exit(0);
}

const result = await checkStock({
  zip: process.env.ZIP,
  maxMiles: process.env.MAX_MILES,
  model: process.env.MODEL,
});

console.log(
  `Provjereno ${result.partsChecked} part brojeva, ${result.productsMatched} Pro Max konfiguracija, ` +
    `${result.stores.length} ducana do ${result.maxMiles} mi od ${result.zip}.`
);
for (const s of result.stores) {
  const n = s.items.filter((i) => i.available).length;
  console.log(`  ${s.name} (${s.distance} mi): ${n}/${s.items.length} na stanju`);
}

const prev = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : [];
const prevKeys = new Set(prev);
const fresh = result.available.filter((a) => !prevKeys.has(a.key));
writeFileSync(STATE, JSON.stringify(result.available.map((a) => a.key)));

if (fresh.length) {
  const lines = fresh.map((a) => `${a.title} - ${a.store} (${a.distance} mi) ${a.quote}`.trim());
  console.log("NOVO NA STANJU:\n" + lines.join("\n"));
  await notify("iPhone 18 Pro Max na stanju!", lines.join("\n"), result.buyUrl);
} else {
  console.log(`Nema novih pojava (na stanju trenutno: ${result.available.length}).`);
}

if (result.productsMatched === 0) {
  throw new Error("Apple nije vratio nijednu Pro Max konfiguraciju - provjeri log.");
}
