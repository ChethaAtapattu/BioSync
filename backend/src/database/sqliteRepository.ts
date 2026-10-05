import sqlite3 from "sqlite3";
import { ProcessedVitals, StudySessionState, Task } from "@biosync/shared";
import { ITaskRepository, ISessionRepository, IVitalsRepository } from "./repository.js";

export class SqliteDatabaseManager implements ITaskRepository, ISessionRepository, IVitalsRepository {
  private db: sqlite3.Database;

  constructor(dbPath: string = "./biosync.db") {
    this.db = new sqlite3.Database(dbPath);
    this.initTables();
  }

  private initTables(): void {
    this.db.serialize(() => {
      this.db.run(`
        CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT,
          difficulty INTEGER NOT NULL,
          estimatedMinutes INTEGER NOT NULL,
          deadline TEXT NOT NULL,
          status TEXT NOT NULL,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        )
      `);

      this.db.run(`
        CREATE TABLE IF NOT EXISTS session (
          id TEXT PRIMARY KEY,
          startTime TEXT NOT NULL,
          endTime TEXT,
          isActive INTEGER NOT NULL,
          accumulatedMinutes REAL NOT NULL,
          lowScoreConsecutiveMs REAL NOT NULL,
          activeScenario TEXT NOT NULL,
          selectedSource TEXT NOT NULL DEFAULT 'simulated'
        )
      `);

      this.db.run(`
        CREATE TABLE IF NOT EXISTS vitals_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          deviceId TEXT NOT NULL,
          sequence INTEGER NOT NULL,
          source TEXT NOT NULL,
          hrBpm REAL,
          pulseRmssdMs REAL,
          motion REAL,
          quality TEXT NOT NULL,
          score INTEGER,
          band TEXT NOT NULL,
          receivedAt TEXT NOT NULL
        )
      `);

      // Migration: Add selectedSource column if missing from legacy table
      this.db.run(`
        ALTER TABLE session ADD COLUMN selectedSource TEXT NOT NULL DEFAULT 'simulated'
      `, () => {
        // Ignore error if column already exists
      });

      // Seed initial demonstration tasks if table is empty
      this.db.get("SELECT COUNT(*) as count FROM tasks", (err, row: { count: number }) => {
        if (!err && row && row.count === 0) {
          this.seedInitialTasks();
        }
      });
    });
  }

  private seedInitialTasks(): void {
    const now = new Date();

    const sampleTasks: Array<Omit<Task, "id" | "createdAt" | "updatedAt">> = [
      {
        title: "Implement MPU6050 Filter & Signal Pipeline",
        description: "Embedded C++ sensor processing & gravity removal algorithm",
        difficulty: 5,
        estimatedMinutes: 60,
        deadline: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
        status: "pending",
      },
      {
        title: "Write PlatformIO Firmware Unit Tests",
        description: "Verify pulse peak detection & rolling RMSSD algorithm",
        difficulty: 4,
        estimatedMinutes: 45,
        deadline: new Date(now.getTime() + 5 * 60 * 60 * 1000).toISOString(),
        status: "pending",
      },
      {
        title: "Review Biosensor Wiring Diagram",
        description: "Check I2C pullup resistors and Mosquitto broker setup",
        difficulty: 3,
        estimatedMinutes: 30,
        deadline: new Date(now.getTime() + 1 * 60 * 60 * 1000).toISOString(),
        status: "pending",
      },
      {
        title: "Organize Embedded Systems Lab Report Notes",
        description: "Draft discussion section on experimental HRV demo assumptions",
        difficulty: 2,
        estimatedMinutes: 20,
        deadline: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
        status: "pending",
      },
      {
        title: "Clear Workbench & Charge LiPo Batteries",
        description: "Routine lab maintenance before hardware testing",
        difficulty: 1,
        estimatedMinutes: 15,
        deadline: new Date(now.getTime() + 12 * 60 * 60 * 1000).toISOString(),
        status: "pending",
      },
    ];

    sampleTasks.forEach((t) => this.createTask(t));
  }

  // --- ITaskRepository ---

  public getAllTasks(): Promise<Task[]> {
    return new Promise((resolve, reject) => {
      this.db.all("SELECT * FROM tasks ORDER BY createdAt DESC", (err, rows: Task[]) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    });
  }

  public getTaskById(id: string): Promise<Task | null> {
    return new Promise((resolve, reject) => {
      this.db.get("SELECT * FROM tasks WHERE id = ?", [id], (err, row: Task) => {
        if (err) return reject(err);
        resolve(row || null);
      });
    });
  }

  public createTask(taskData: Omit<Task, "id" | "createdAt" | "updatedAt">): Promise<Task> {
    return new Promise((resolve, reject) => {
      const now = new Date().toISOString();
      const id = `task-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      const task: Task = {
        ...taskData,
        id,
        createdAt: now,
        updatedAt: now,
      };

      const sql = `
        INSERT INTO tasks (id, title, description, difficulty, estimatedMinutes, deadline, status, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      this.db.run(
        sql,
        [
          task.id,
          task.title,
          task.description || "",
          task.difficulty,
          task.estimatedMinutes,
          task.deadline,
          task.status,
          task.createdAt,
          task.updatedAt,
        ],
        (err) => {
          if (err) return reject(err);
          resolve(task);
        }
      );
    });
  }

  public updateTask(id: string, updates: Partial<Task>): Promise<Task | null> {
    return new Promise(async (resolve, reject) => {
      const existing = await this.getTaskById(id);
      if (!existing) return resolve(null);

      const updated: Task = {
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      const sql = `
        UPDATE tasks
        SET title = ?, description = ?, difficulty = ?, estimatedMinutes = ?, deadline = ?, status = ?, updatedAt = ?
        WHERE id = ?
      `;

      this.db.run(
        sql,
        [
          updated.title,
          updated.description || "",
          updated.difficulty,
          updated.estimatedMinutes,
          updated.deadline,
          updated.status,
          updated.updatedAt,
          id,
        ],
        (err) => {
          if (err) return reject(err);
          resolve(updated);
        }
      );
    });
  }

  public deleteTask(id: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.db.run("DELETE FROM tasks WHERE id = ?", [id], (err) => {
        if (err) return reject(err);
        resolve(true);
      });
    });
  }

  // --- ISessionRepository ---

  public getCurrentSession(): Promise<StudySessionState | null> {
    return new Promise((resolve, reject) => {
      this.db.get("SELECT * FROM session LIMIT 1", (err, row: any) => {
        if (err) return reject(err);
        if (!row) return resolve(null);
        resolve({
          id: row.id,
          startTime: row.startTime,
          endTime: row.endTime || undefined,
          isActive: Boolean(row.isActive),
          accumulatedMinutes: row.accumulatedMinutes,
          lowScoreConsecutiveMs: row.lowScoreConsecutiveMs,
          activeScenario: row.activeScenario,
          selectedSource: (row.selectedSource as any) || "simulated",
        });
      });
    });
  }

  public saveCurrentSession(session: StudySessionState): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO session (id, startTime, endTime, isActive, accumulatedMinutes, lowScoreConsecutiveMs, activeScenario, selectedSource)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          startTime = excluded.startTime,
          endTime = excluded.endTime,
          isActive = excluded.isActive,
          accumulatedMinutes = excluded.accumulatedMinutes,
          lowScoreConsecutiveMs = excluded.lowScoreConsecutiveMs,
          activeScenario = excluded.activeScenario,
          selectedSource = excluded.selectedSource
      `;

      this.db.run(
        sql,
        [
          session.id,
          session.startTime,
          session.endTime || null,
          session.isActive ? 1 : 0,
          session.accumulatedMinutes,
          session.lowScoreConsecutiveMs,
          session.activeScenario,
          session.selectedSource || "simulated",
        ],
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  }

  // --- IVitalsRepository ---

  public logVitals(vitals: ProcessedVitals): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO vitals_history (deviceId, sequence, source, hrBpm, pulseRmssdMs, motion, quality, score, band, receivedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      this.db.run(
        sql,
        [
          vitals.deviceId,
          vitals.sequence,
          vitals.source,
          vitals.hrBpm,
          vitals.pulseRmssdMs,
          vitals.motion,
          vitals.quality,
          vitals.score,
          vitals.band,
          vitals.receivedAt,
        ],
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  }

  public getRecentVitals(limit: number = 50): Promise<ProcessedVitals[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        "SELECT * FROM vitals_history ORDER BY id DESC LIMIT ?",
        [limit],
        (err, rows: any[]) => {
          if (err) return reject(err);
          const mapped: ProcessedVitals[] = (rows || []).map((row) => ({
            deviceId: row.deviceId,
            sequence: row.sequence,
            uptimeMs: 0,
            source: row.source,
            hrBpm: row.hrBpm,
            pulseRmssdMs: row.pulseRmssdMs,
            motion: row.motion,
            quality: row.quality,
            score: row.score,
            band: row.band,
            receivedAt: row.receivedAt,
            isStale: false,
          }));
          resolve(mapped.reverse());
        }
      );
    });
  }
}
