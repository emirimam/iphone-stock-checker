// Upstash Redis preko REST-a (Vercel Marketplace -> Storage). Bez dodatnih paketa.

function redisEnv() {
  const env = process.env;
  let url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
  let token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    // Vercel ponekad doda vlastiti prefiks (npr. STORAGE_KV_REST_API_URL)
    for (const k of Object.keys(env)) {
      if (!url && /(REST_API_URL|REDIS_REST_URL)$/.test(k)) {
        const base = k.replace(/(REST_API_URL|REDIS_REST_URL)$/, "");
        const t = env[`${base}REST_API_TOKEN`] || env[`${base}REDIS_REST_TOKEN`];
        if (t) { url = env[k]; token = t; }
      }
    }
  }
  return url && token ? { url, token } : null;
}

export const hasStorage = () => Boolean(redisEnv());

export function coded(code, message, status = 400) {
  const e = new Error(message);
  e.code = code;
  e.status = status;
  return e;
}

async function call(path, body) {
  const env = redisEnv();
  if (!env) throw coded("no_storage", "Database is not connected (Vercel -> Storage -> Upstash Redis).", 503);
  const res = await fetch(env.url + path, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(`Redis: ${data.error || res.status}`);
  return data;
}

/** Jedna komanda, npr. redis(["GET", "kljuc"]). */
export async function redis(cmd) {
  return (await call("", cmd)).result;
}

/** Vise komandi u jednom zahtjevu; vraca niz rezultata. */
export async function pipeline(cmds) {
  if (!cmds.length) return [];
  const data = await call("/pipeline", cmds);
  return data.map((r) => {
    if (r.error) throw new Error(`Redis: ${r.error}`);
    return r.result;
  });
}

export const getJson = async (key) => {
  const raw = await redis(["GET", key]);
  return raw ? JSON.parse(raw) : null;
};
export const setJson = (key, value) => redis(["SET", key, JSON.stringify(value)]);
