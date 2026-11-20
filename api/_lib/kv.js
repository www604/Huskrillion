// Optional Redis (Upstash / Vercel KV) via REST. If no env vars are set,
// everything still works: judgments are cached in memory per server instance
// and rarity is AI-only.
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export const kvEnabled = Boolean(URL_ && TOKEN);
const mem = new Map();

export async function pipeline(commands) {
  if (!kvEnabled) return null;
  try {
    const r = await fetch(`${URL_.replace(/\/$/, "")}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(commands),
    });
    if (!r.ok) return null;
    const data = await r.json();
    return data.map((x) => x.result);
  } catch {
    return null;
  }
}

export async function getJSON(key) {
  if (!kvEnabled) return mem.get(key) ?? null;
  const res = await pipeline([["GET", key]]);
  try { return res && res[0] ? JSON.parse(res[0]) : null; } catch { return null; }
}

export async function setJSON(key, value, ttlSeconds) {
  if (!kvEnabled) {
    if (mem.size > 5000) mem.clear();
    mem.set(key, value);
    return;
  }
  await pipeline([["SET", key, JSON.stringify(value), "EX", String(ttlSeconds)]]);
}

const memRate = new Map();
export async function rateLimited(ip, limit = 80) {
  const hour = Math.floor(Date.now() / 3600000);
  const key = `hk:rl:${ip}:${hour}`;
  if (!kvEnabled) {
    const n = (memRate.get(key) || 0) + 1;
    if (memRate.size > 5000) memRate.clear();
    memRate.set(key, n);
    return n > limit;
  }
  const res = await pipeline([["INCR", key], ["EXPIRE", key, "3600"]]);
  return res ? Number(res[0]) > limit : false;
}
