// Serves the built game (dist/) and a tiny JSON API backing the shared,
// global leaderboard (Firestore-backed — see README for the collection
// shape). Runs as the production container's entrypoint; local dev instead
// uses Vite directly and talks to this same API when deployed.
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { Firestore } from "@google-cloud/firestore";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, "../dist");

const COLLECTION = "leaderboard";
const NAME_MAX_LENGTH = 8;
const LEVEL_LABEL_MAX_LENGTH = 10;
const READ_LIMIT = 100;

const app = express();
// Explicit projectId rather than relying on ADC/env auto-detection — the
// local dev environment's default credentials carry an unrelated quota
// project, which was enough to make that detection ambiguous.
const firestore = new Firestore({ projectId: process.env.GOOGLE_CLOUD_PROJECT || "northbound-506405" });

app.use(express.json());

app.get("/api/leaderboard", async (_req, res) => {
  try {
    const snapshot = await firestore.collection(COLLECTION).orderBy("score", "desc").limit(READ_LIMIT).get();
    const entries = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        score: data.score,
        distanceKm: data.distanceKm,
        levelLabel: data.levelLabel,
        date: data.date?.toDate?.().toISOString() ?? new Date().toISOString(),
      };
    });
    res.json(entries);
  } catch (err) {
    console.error("GET /api/leaderboard failed:", err);
    res.status(500).json({ error: "failed to load leaderboard" });
  }
});

app.post("/api/leaderboard", async (req, res) => {
  try {
    const body = req.body ?? {};
    const rawName = typeof body.name === "string" ? body.name : "";
    const name = rawName.trim().slice(0, NAME_MAX_LENGTH).toUpperCase() || "PLAYER";
    const score = Number.isFinite(body.score) ? Math.max(0, Math.round(body.score)) : 0;
    const distanceKm = Number.isFinite(body.distanceKm) ? Math.max(0, Math.round(body.distanceKm)) : null;
    const levelLabel =
      typeof body.levelLabel === "string" ? body.levelLabel.slice(0, LEVEL_LABEL_MAX_LENGTH) : null;
    // Server clock, not the client's — keeps every player's timestamps
    // consistent regardless of their device's clock/timezone.
    const date = new Date();

    const docRef = await firestore.collection(COLLECTION).add({ name, score, distanceKm, levelLabel, date });
    res.status(201).json({ id: docRef.id, name, score, distanceKm, levelLabel, date: date.toISOString() });
  } catch (err) {
    console.error("POST /api/leaderboard failed:", err);
    res.status(500).json({ error: "failed to save score" });
  }
});

app.use(express.static(distDir));
app.get("*", (_req, res) => {
  res.sendFile(path.join(distDir, "index.html"));
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Northbound server listening on port ${port}`);
});
