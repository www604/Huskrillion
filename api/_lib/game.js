import { PROMPTS } from "./prompts.js";

export const PROMPTS_PER_DAY = 7;
export const EPOCH = Date.UTC(2026, 10, 19); // Dive #1 = 2026-11-19 (America/New_York)
const TZ = "America/New_York";

// Tier ladder. "rank" orders the rarity tiers (technically_correct sits outside it).
export const TIERS = {
  waitlisted:          { label: "Waitlisted",            points: 0 },
  missed:              { label: "Missed the Green Line", points: 0 },
  tour_group:          { label: "Tour Group",            points: 10,  rank: 0 },
  technically_correct: { label: "Technically Correct",   points: 15 },
  first_year:          { label: "First-Year",            points: 30,  rank: 1 },
  coop_veteran:        { label: "Co-op Veteran",         points: 60,  rank: 2 },
  fifth_year:          { label: "Fifth-Year Senior",     points: 85,  rank: 3 },
  huskrillion:         { label: "One in a Huskrillion",  points: 100, rank: 4 },
};
export const RANKED = ["tour_group", "first_year", "coop_veteran", "fifth_year", "huskrillion"];

function nyParts(d = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(d);
  const o = {};
  for (const p of parts) o[p.type] = p.value;
  return { y: +o.year, m: +o.month, d: +o.day, h: +o.hour % 24, mi: +o.minute, s: +o.second };
}

export function nyDateString(d = new Date()) {
  const p = nyParts(d);
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

export function dayNumberFor(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return Math.max(1, Math.round((Date.UTC(y, m - 1, d) - EPOCH) / 86400000) + 1);
}

export function msUntilReset(d = new Date()) {
  const p = nyParts(d);
  return (86400 - (p.h * 3600 + p.mi * 60 + p.s)) * 1000;
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Deterministic: everyone gets the same 7 prompts per day, no repeats within a cycle.
export function promptsForDay(dayNumber) {
  const perCycle = Math.floor(PROMPTS.length / PROMPTS_PER_DAY);
  const idx = Math.max(0, dayNumber - 1);
  const cycle = Math.floor(idx / perCycle);
  const pos = idx % perCycle;
  const order = PROMPTS.slice();
  const rand = mulberry32(cycle * 9973 + 1898); // 1898 = NU founding year
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order.slice(pos * PROMPTS_PER_DAY, pos * PROMPTS_PER_DAY + PROMPTS_PER_DAY);
}

export function normalize(s) {
  return String(s)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’'`".,!?;:()\[\]{}]/g, "")
    .replace(/[-_/]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^the /, "")
    .trim();
}

// Optional: blend AI rarity with real player answer frequency.
export function frequencyTier(count, total) {
  const share = count / total;
  if (share >= 0.18) return "tour_group";
  if (share >= 0.07) return "first_year";
  if (share >= 0.025) return "coop_veteran";
  if (share >= 0.008) return "fifth_year";
  return "huskrillion";
}

export function blendTiers(aiTier, freqTier) {
  const a = TIERS[aiTier].rank, f = TIERS[freqTier].rank;
  return RANKED[Math.round((a + f) / 2)];
}
