// Local high-score table, arcade-cabinet style: every run gets recorded,
// persisted in localStorage so it survives reloads on this machine. Storage
// is unbounded — a low score still gets a permanent spot, even if it's far
// enough down the list that the on-screen leaderboard (which only shows the
// top rows) never displays it.
const STORAGE_KEY = "northbound.leaderboard";

export function loadLeaderboard() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Records a run. `distanceKm` is how far north (of the 500km total) the run got before it ended — 500 for a win. Returns the full sorted list plus the exact entry object just added (for highlighting it in the UI). */
export function saveScore(name, score, distanceKm, date = new Date()) {
  const entries = loadLeaderboard();
  const entry = { name, score, distanceKm, date: date.toISOString() };
  entries.push(entry);
  entries.sort((a, b) => b.score - a.score);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Storage unavailable (private browsing, quota) — leaderboard just won't persist.
  }
  return { entries, entry };
}

/** Compact "MM/DD HH:MM" rendering of a stored entry's ISO date, in local time. */
export function formatEntryDate(isoString) {
  const d = new Date(isoString);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${mm}/${dd} ${hh}:${min}`;
}
