import { Router } from "express";
import { rankTasks } from "@biosync/shared";
import { SqliteDatabaseManager } from "../database/sqliteRepository.js";
import { ScoringService } from "../services/scoringService.js";

export function createTasksRouter(
  db: SqliteDatabaseManager,
  scoringService: ScoringService,
  onTasksChanged?: () => void
): Router {
  const router = Router();

  // GET /api/tasks - list tasks and compute ranked list
  router.get("/", async (req, res) => {
    try {
      const tasks = await db.getAllTasks();
      const latestVitals = scoringService.getLatestVitals();
      const band = latestVitals?.band || "UNAVAILABLE";
      const ranked = rankTasks(tasks, band);

      res.json({
        tasks,
        ranked,
        band,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/tasks - create new task
  router.post("/", async (req, res) => {
    try {
      const { title, description, difficulty, estimatedMinutes, deadline } = req.body;

      if (!title || typeof title !== "string") {
        return res.status(400).json({ error: "Title is required" });
      }

      if (!difficulty || difficulty < 1 || difficulty > 5) {
        return res.status(400).json({ error: "Difficulty must be between 1 and 5" });
      }

      const newTask = await db.createTask({
        title,
        description: description || "",
        difficulty: Number(difficulty) as any,
        estimatedMinutes: Number(estimatedMinutes) || 30,
        deadline: deadline || new Date(Date.now() + 3 * 3600 * 1000).toISOString(),
        status: "pending",
      });

      if (onTasksChanged) onTasksChanged();
      res.status(201).json(newTask);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // PUT /api/tasks/:id - update existing task
  router.put("/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updated = await db.updateTask(id, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Task not found" });
      }
      if (onTasksChanged) onTasksChanged();
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/tasks/:id - delete task
  router.delete("/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const success = await db.deleteTask(id);
      if (!success) {
        return res.status(404).json({ error: "Task not found" });
      }
      if (onTasksChanged) onTasksChanged();
      res.json({ success: true, id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
