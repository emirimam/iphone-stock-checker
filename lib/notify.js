// Slanje obavijesti preko ntfy.sh (push na mobitel, opcionalno i email).

export async function sendNtfy(settings, title, message, click) {
  const topic = settings.ntfyTopic;
  if (!topic) return { sent: false, reason: "ntfy topic nije postavljen" };
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
