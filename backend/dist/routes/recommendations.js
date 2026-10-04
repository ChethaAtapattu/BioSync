import { Router } from "express";
import { rankTasks } from "@biosync/shared";
export function createRecommendationsRouter(db, scoringService, claudeService, getSessionMinutes) {
    const router = Router();
    // GET /api/recommendations
    router.get("/", async (req, res) => {
        try {
            const tasks = await db.getAllTasks();
            const latestVitals = scoringService.getLatestVitals();
            const band = latestVitals?.band || "UNAVAILABLE";
            const score = latestVitals?.score ?? null;
            const sessionMins = getSessionMinutes();
            const ranked = rankTasks(tasks, band);
            const topTasks = ranked.slice(0, 3);
            const recommendation = await claudeService.getRecommendation(band, score, topTasks, sessionMins);
            res.json(recommendation);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    return router;
}
