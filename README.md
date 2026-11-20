# Huskrillion 🐺🌊

The daily Northeastern University rare-answer trivia dive. Fan-made and inspired by Krillion. Not affiliated with Northeastern.

- 7 prompts a day, the same for everyone (resets at midnight Boston time)
- 25 seconds per prompt, one answer, no do-overs (refreshing mid-prompt counts as a timeout)
- An AI judge (OpenAI) checks validity and rarity; each point = 10 m deeper into the Charles (max 7,000 m)

| Tier | Points |
|---|---|
| Tour Group | 10 |
| Technically Correct | 15 |
| First-Year | 30 |
| Co-op Veteran | 60 |
| Fifth-Year Senior | 85 |
| One in a Huskrillion | 100 |
| Waitlisted (invalid) / Missed the Green Line (timeout) | 0 |

## Deploy on Vercel

1. In Vercel: **Add New → Project → Import** this repo. Framework preset: **Other**. No build command needed.
2. **Settings → Environment Variables**, add:
   - `OPENAI_API_KEY` = your key (required). It stays on the server and is never sent to the browser.
   - `OPENAI_MODEL` (optional) – defaults to `gpt-5.6-luna`.
3. Redeploy.

### Optional: real-player rarity
In Vercel: **Storage → Marketplace → Upstash Redis → Create**, and connect it to the project. With it on, identical answers get identical judgments (cached, cheaper), and after 25+ answers to a prompt, rarity blends in what players actually answered that day.

## Files
- `index.html` – the game UI
- `api/daily.js` – today's dive number + 7 prompts
- `api/judge.js` – checks the prompt is today's, calls the AI judge, applies tiers
- `api/_lib/prompts.js` – **the prompt pool. Add more prompts at the bottom with new ids.**
- `api/_lib/judge.js` – the judge instructions sent to OpenAI
- `api/_lib/game.js` – tiers, daily rotation, frequency blending
