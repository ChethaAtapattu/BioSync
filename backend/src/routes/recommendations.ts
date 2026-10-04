import { Router } from "express";
import { rankTasks } from "@biosync/shared";
import { SqliteDatabaseManager } from "../database/sqliteRepository.js";
import { ScoringService } from "../services/scoringService.js";
import { ClaudeRecommendationService } from "../services/claudeService.js";

export function createRecommendationsRouter(
  db: SqliteDatabaseManager,
  scoringService: ScoringService,
  claudeService: ClaudeRecommendationService,
  getSessionMinutes: () => number
): Router {
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

      const recommendation = await claudeService.getRecommendation(
        band,
        score,
        topTasks,
        sessionMins
      );

      res.json(recommendation);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
