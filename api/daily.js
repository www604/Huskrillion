import { nyDateString, dayNumberFor, promptsForDay, msUntilReset, PROMPTS_PER_DAY } from "./_lib/game.js";

export default function handler(req, res) {
  const date = nyDateString();
  const dayNumber = dayNumberFor(date);
  const prompts = promptsForDay(dayNumber).map((p) => ({ id: p.id, text: p.text }));
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ date, dayNumber, perDay: PROMPTS_PER_DAY, prompts, msUntilReset: msUntilReset() });
}
