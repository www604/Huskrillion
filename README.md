# Huskrillion 🐺🌊

The daily Northeastern University rare-answer trivia dive (PG-13 edition). Fan-made and inspired by Krillion. Not affiliated with Northeastern.

- 7 prompts a day, the same for everyone (resets at midnight Boston time)
- 25 seconds per prompt; one dive per day (refreshing mid-prompt counts as a timeout)
- An AI judge (OpenAI) checks validity and rarity; each point = 10 m deeper into the Charles (max 7,000 m)

| Tier | Points |
|---|---|
| Tour Group | 10 |
| Honors Kid (the 'clever' pick everyone thinks of) | 15 |
| First-Year | 30 |
| Co-op Veteran | 60 |
| Fifth-Year Senior | 85 |
| One in a Huskrillion (the designated gem) | 100 |
| Missed the Green Line (time ran out) | 0 |

Not accepted? Keep trying until the 25 seconds run out (the timer pauses while the AI judges).

## Deploy on Vercel

1. Put this folder in a GitHub repo, then in Vercel: **Add New → Project → Import** that repo. Framework preset: **Other**. No build command needed.
   (Or from this folder run `npx vercel` then `npx vercel --prod`.)
2. In the project: **Settings → Environment Variables**, add:
   - `OPENAI_API_KEY` = your key (required). It stays on the server and is never sent to the browser.
   - `OPENAI_MODEL` (optional) – defaults to `gpt-5.6-luna`, OpenAI's cheap, fast tier. Change it here if you want a different model.
3. Redeploy. Done.

### Optional (recommended once people play): real-player rarity
In Vercel: **Storage → Marketplace → Upstash Redis → Create**, and connect it to the project. That adds `KV_REST_API_URL` / `KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_*`) automatically. With it on:
- The same answer gets the same judgment for everyone (cached) and the OpenAI bill drops a lot.
- After 25+ answers to a prompt, rarity blends the AI's guess with what players actually answered that day, and the reveal shows "X% of divers said this today."
- Rate limiting (150 answers/hour per IP) works across all servers.

Without it, the game still works; rarity is AI-only.

## Files
- `index.html` – the whole game UI (pixel art, timer, reveal, results, share)
- `api/daily.js` – today's dive number + 7 prompts
- `api/judge.js` – validates the prompt is today's, calls the AI judge, applies tiers
- `api/_lib/prompts.js` – **the prompt pool (text, 3 obvious answers, the designated gem). Add more at the bottom with new ids.** 85 prompts = 12 days before a reshuffled cycle starts.
- `api/_lib/judge.js` – the judge instructions sent to OpenAI (tune the tone/strictness here)
- `api/_lib/game.js` – tiers, daily rotation, frequency blending

## Cost
Each answer is one small OpenAI call (~600 input tokens). On a "mini/luna"-class model that is a fraction of a cent per player per day. Set a monthly budget limit in your OpenAI dashboard anyway.
