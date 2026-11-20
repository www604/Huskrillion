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
  const final = Boolean(body?.final); // true = timer ran out, this is the last attempt
  const giveUp = Boolean(body?.giveUp); // timer ran out with nothing typed: just reveal

  // Only today's (and yesterday's, for people playing across midnight) prompts are judgeable.
  const today = nyDateString();
  const dayNum = dayNumberFor(today);
  const allowed = new Set([...promptsForDay(dayNum), ...promptsForDay(dayNum - 1)].map((p) => p.id));
  const prompt = PROMPT_MAP[promptId];
  if (!prompt || !allowed.has(promptId)) return res.status(400).json({ error: "Unknown prompt." });

  if (giveUp) return res.status(200).json({ valid: false, retry: false, gem: prompt.gem, commonAnswers: prompt.obvious });
  if (!answer) return res.status(400).json({ error: "Empty answer." });

  const ip = String(req.headers["x-forwarded-for"] || "anon").split(",")[0].trim();
  if (await rateLimited(ip, 150)) return res.status(429).json({ error: "Slow down, Husky. Try again in a bit." });

  const norm = normalize(answer);
  if (!norm) return res.status(400).json({ error: "Empty answer." });
  const gemNorm = normalize(prompt.gem);

  // Same answer -> same judgment for everyone.
  const cacheKey = `hk:j:${promptId}:${norm}`;
  let j = await getJSON(cacheKey);
  if (!j) {
    if (norm === gemNorm) {
      j = { valid: true, canonical: prompt.gem, tier: "huskrillion", quip: "" };
    } else {
      try {
        j = await judgeAnswer(prompt, answer);
      } catch (e) {
        return res.status(502).json({ error: "The judge is stuck on the Green Line. Try again.", detail: String(e.message || e) });
      }
    }
    await setJSON(cacheKey, j, 60 * 60 * 24 * 60);
  }

  const reveal = { gem: prompt.gem, commonAnswers: prompt.obvious };

  if (!j.valid) {
    // Not accepted: the player can keep trying until the timer runs out.
    return res.status(200).json({ valid: false, retry: !final, quip: j.quip, canonical: j.canonical, ...(final ? reveal : {}) });
  }

  let tier = j.tier;
  const isGem = normalize(j.canonical) === gemNorm || norm === gemNorm;
  if (isGem) tier = "huskrillion";
  else if (tier === "huskrillion") tier = "fifth_year";

  let share = null;
  if (kvEnabled) {
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
        if (!isGem && TIERS[tier].rank !== undefined) tier = blendTiers(tier, frequencyTier(count, total));
      }
    }
  }

  return res.status(200).json({
    valid: true,
    tier,
    label: TIERS[tier].label,
    points: TIERS[tier].points,
    canonical: isGem ? prompt.gem : j.canonical,
    quip: j.quip,
    share,
    ...reveal,
  });
}
