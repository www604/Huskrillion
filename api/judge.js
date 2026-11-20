import { PROMPT_MAP } from "./_lib/prompts.js";
import {
  TIERS, nyDateString, dayNumberFor, promptsForDay, normalize, frequencyTier, blendTiers,
} from "./_lib/game.js";
import { kvEnabled, getJSON, setJSON, pipeline, rateLimited } from "./_lib/kv.js";
import { judgeAnswer } from "./_lib/judge.js";

const MIN_SAMPLES = 25; // real-player counts kick in after this many answers to a prompt

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "Server is missing OPENAI_API_KEY." });
  }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  const promptId = String(body?.promptId || "");
  const answer = String(body?.answer || "").replace(/\s+/g, " ").trim().slice(0, 60);
  if (!answer) return res.status(400).json({ error: "Empty answer." });

  // Only today's (and yesterday's, for people playing across midnight) prompts are judgeable.
  const today = nyDateString();
  const dayNum = dayNumberFor(today);
  const allowed = new Set([...promptsForDay(dayNum), ...promptsForDay(dayNum - 1)].map((p) => p.id));
  const prompt = PROMPT_MAP[promptId];
  if (!prompt || !allowed.has(promptId)) return res.status(400).json({ error: "Unknown prompt." });

  const ip = String(req.headers["x-forwarded-for"] || "anon").split(",")[0].trim();
  if (await rateLimited(ip)) return res.status(429).json({ error: "Slow down, Husky. Try again in a bit." });

  const norm = normalize(answer);
  if (!norm) return res.status(400).json({ error: "Empty answer." });

  // Same answer -> same judgment for everyone.
  const cacheKey = `hk:j:${promptId}:${norm}`;
  let j = await getJSON(cacheKey);
  if (!j) {
    try {
      j = await judgeAnswer(prompt, answer);
    } catch (e) {
      return res.status(502).json({ error: "The judge is stuck on the Green Line. Try again.", detail: String(e.message || e) });
    }
    await setJSON(cacheKey, j, 60 * 60 * 24 * 60);
  }

  let tier = j.valid ? j.tier : "waitlisted";
  let share = null;

  if (j.valid && kvEnabled) {
    const countKey = `hk:c:${today}:${promptId}`;
    const field = normalize(j.canonical) || norm;
    const r = await pipeline([
      ["HINCRBY", countKey, field, "1"],
      ["HINCRBY", countKey, "__total", "1"],
      ["EXPIRE", countKey, String(60 * 60 * 72)],
    ]);
    if (r) {
      const count = Number(r[0]), total = Number(r[1]);
      if (total >= MIN_SAMPLES) {
        share = Math.round((count / total) * 1000) / 10;
        if (TIERS[tier].rank !== undefined) tier = blendTiers(tier, frequencyTier(count, total));
      }
    }
  }

  return res.status(200).json({
    valid: j.valid,
    tier,
    label: TIERS[tier].label,
    points: TIERS[tier].points,
    canonical: j.canonical,
    quip: j.quip,
    commonAnswers: j.common_answers,
    share,
  });
}
