const u = process.argv[2] || "https://iphone-stock-checker-hazel.vercel.app";
const d = await (await fetch(`${u}/api/settings`)).json();
const s = d.settings || {};
console.log(`::notice::storage=${d.storage} pinConfigured=${d.pinConfigured} topicSet=${s.ntfyTopicSet} enabled=${s.enabled} models=${(s.models||[]).join("|")} storages=${(s.storages||[]).join("|")} colors=${(s.colors||[]).join("|")} zip=${s.zip} miles=${s.maxMiles} status=${d.status ? d.status.source + " " + d.status.checkedAt : "none"}`);
const r = await fetch(`${u}/api/check`); const c = await r.json();
console.log(`::notice::live check [${r.status}] ${c.error || `stores=${c.stores?.length} wanted=${c.wantedConfigs} other=${c.otherAvailable?.length}`}`);
