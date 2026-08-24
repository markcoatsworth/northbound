// Local high-score table, arcade-cabinet style: initials + score, persisted
// in localStorage so it survives reloads on this machine.
const STORAGE_KEY = "northbound.leaderboard";
export const MAX_ENTRIES = 10;

export function loadLeaderboard() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Whether a score earns a spot on the (possibly not-yet-full) table. */
export function qualifiesForLeaderboard(score, entries = loadLeaderboard()) {
  if (score <= 0) return false;
  if (entries.length < MAX_ENTRIES) return true;
  return score > entries[entries.length - 1].score;
}

export function saveScore(initials, score, levelName) {
  const entries = loadLeaderboard();
  entries.push({ initials, score, levelName });
  entries.sort((a, b) => b.score - a.score);
  entries.length = Math.min(entries.length, MAX_ENTRIES);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Storage unavailable (private browsing, quota) — leaderboard just won't persist.
  }
  return entries;
}
