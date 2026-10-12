// Slanje obavijesti preko ntfy.sh (push na mobitel, opcionalno i email) + tekstovi na EN/BS.

const TEXT = {
  en: {
    testTitle: "Test notification",
    testBody: (s) => `Notifications work. Watching: ${s.models.join(", ")} near ZIP ${s.zip} (within ${s.maxMiles} mi).`,
    stockTitle: "iPhone in stock!",
    githubTest: "GitHub check is set up. Notifications will arrive here.",
    goneTitle: "No longer available",
    goneLine: (title, store, mins) => `${title} - ${store} (was available ~${mins} min)`,
  },
  bs: {
    testTitle: "Test obavijesti",
    testBody: (s) => `Obavijesti rade. Pratim: ${s.models.join(", ")} kod ZIP ${s.zip} (do ${s.maxMiles} mi).`,
    stockTitle: "iPhone na stanju!",
    githubTest: "GitHub provjera je podešena. Poruke stižu ovdje.",
    goneTitle: "Više nije dostupno",
    goneLine: (title, store, mins) => `${title} - ${store} (bio dostupan ~${mins} min)`,
  },
};

export const t = (lang) => TEXT[lang] || TEXT.en;

export function testMessage(settings) {
  const x = t(settings.lang);
  return { title: x.testTitle, body: x.testBody(settings) };
}

export async function sendNtfy(settings, title, message, click) {
  const topic = settings.ntfyTopic;
  if (!topic) return { sent: false, reason: "No ntfy topic set" };
  const headers = {
    // ntfy prihvata UTF-8 naslov kroz RFC 2047 kodiranje
    Title: `=?UTF-8?B?${Buffer.from(title).toString("base64")}?=`,
    Priority: settings.priority || "high",
    Tags: "iphone",
  };
  if (click) headers.Click = click;
  if (settings.email) headers.Email = settings.email;
  const res = await fetch(`https://ntfy.sh/${encodeURIComponent(topic)}`, {
    method: "POST",
    body: message,
    headers,
    signal: AbortSignal.timeout(15000),
  });
  return { sent: res.ok, status: res.status, reason: res.ok ? "" : await res.text() };
}
