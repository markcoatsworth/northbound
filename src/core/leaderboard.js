// Shared, global high-score table — backed by a small server API + Firestore
// (see server/index.js) instead of localStorage, so everyone who plays sees
// the same board. Both calls fail soft (return an empty/null result rather
// than throwing) so a network hiccup degrades to "no scores shown" instead
// of crashing the game.
const API_BASE = "/api/leaderboard";

export async function loadLeaderboard() {
  try {
    const res = await fetch(API_BASE);
    if (!res.ok) throw new Error(`GET ${API_BASE} -> ${res.status}`);
    const entries = await res.json();
    return Array.isArray(entries) ? entries : [];
  } catch {
    return [];
  }
}

/**
 * Records a run. `distanceKm` is how far north (of the 500km total) the run
 * got before it ended — 500 for a win. `levelLabel` is which level that
 * happened in (e.g. "LV3"), or "WIN". The server assigns the timestamp (its
 * clock, not the player's browser) and an id. Returns the freshly reloaded
 * full list plus the entry just added (matched by id, for highlighting it
 * in the UI) — `entry` is null if the save failed.
 */
export async function saveScore(name, score, distanceKm, levelLabel) {
  try {
    const res = await fetch(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, score, distanceKm, levelLabel }),
    });
    if (!res.ok) throw new Error(`POST ${API_BASE} -> ${res.status}`);
    const entry = await res.json();
    const entries = await loadLeaderboard();
    return { entries, entry };
  } catch {
    return { entries: [], entry: null };
  }
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
