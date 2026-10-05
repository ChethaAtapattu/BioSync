import { Router } from "express";
import { rankTasks, SensorSource } from "@biosync/shared";
import { SqliteDatabaseManager } from "../database/sqliteRepository.js";
import { ScoringService } from "../services/scoringService.js";

export function createTasksRouter(
  db: SqliteDatabaseManager,
  scoringService: ScoringService,
  getSelectedSource: () => SensorSource,
  onTasksChanged?: () => void
): Router {
  const router = Router();

  // GET /api/tasks - list tasks and compute ranked list
  router.get("/", async (req, res) => {
    try {
      const tasks = await db.getAllTasks();
      const selectedSource = getSelectedSource();
      const latestVitals = scoringService.getLatestVitals(selectedSource);
      const band = latestVitals?.band || "UNAVAILABLE";
      const ranked = rankTasks(tasks, band);

      res.json({
        tasks,
        ranked,
        band,
        selectedSource,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/tasks - create new task with input validation
  router.post("/", async (req, res) => {
    try {
      const { title, description, difficulty, estimatedMinutes, deadline } = req.body;

      if (!title || typeof title !== "string" || title.trim().length === 0) {
        return res.status(400).json({ error: "Task title must be a non-empty string" });
      }

      if (title.trim().length > 200) {
        return res.status(400).json({ error: "Task title cannot exceed 200 characters" });
      }

      const diffNum = Number(difficulty);
      if (!Number.isInteger(diffNum) || diffNum < 1 || diffNum > 5) {
        return res.status(400).json({ error: "Difficulty must be an integer between 1 and 5" });
      }

      const estNum = Number(estimatedMinutes);
      if (!Number.isInteger(estNum) || estNum < 1 || estNum > 1440) {
        return res.status(400).json({ error: "Estimated minutes must be an integer between 1 and 1440" });
      }

      if (!deadline || typeof deadline !== "string" || isNaN(Date.parse(deadline))) {
        return res.status(400).json({ error: "Deadline must be a valid ISO date string" });
      }

      const newTask = await db.createTask({
        title: title.trim(),
        description: typeof description === "string" ? description.trim() : "",
        difficulty: diffNum as any,
        estimatedMinutes: estNum,
        deadline: new Date(deadline).toISOString(),
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
      const updates = req.body;

      if (updates.title !== undefined) {
        if (typeof updates.title !== "string" || updates.title.trim().length === 0) {
          return res.status(400).json({ error: "Task title must be a non-empty string" });
        }
        updates.title = updates.title.trim();
      }

      if (updates.difficulty !== undefined) {
        const diffNum = Number(updates.difficulty);
        if (!Number.isInteger(diffNum) || diffNum < 1 || diffNum > 5) {
          return res.status(400).json({ error: "Difficulty must be an integer between 1 and 5" });
        }
        updates.difficulty = diffNum;
      }

      if (updates.estimatedMinutes !== undefined) {
        const estNum = Number(updates.estimatedMinutes);
        if (!Number.isInteger(estNum) || estNum < 1 || estNum > 1440) {
          return res.status(400).json({ error: "Estimated minutes must be an integer between 1 and 1440" });
        }
        updates.estimatedMinutes = estNum;
      }

      if (updates.deadline !== undefined) {
        if (typeof updates.deadline !== "string" || isNaN(Date.parse(updates.deadline))) {
          return res.status(400).json({ error: "Deadline must be a valid ISO date string" });
        }
        updates.deadline = new Date(updates.deadline).toISOString();
      }

      const updated = await db.updateTask(id, updates);
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
