import { ProcessedVitals, StudySessionState, Task } from "@biosync/shared";

export interface ITaskRepository {
  getAllTasks(): Promise<Task[]>;
  getTaskById(id: string): Promise<Task | null>;
  createTask(task: Omit<Task, "id" | "createdAt" | "updatedAt">): Promise<Task>;
  updateTask(id: string, updates: Partial<Task>): Promise<Task | null>;
  deleteTask(id: string): Promise<boolean>;
}

export interface ISessionRepository {
  getCurrentSession(): Promise<StudySessionState | null>;
  saveCurrentSession(session: StudySessionState): Promise<void>;
}

export interface IVitalsRepository {
  logVitals(vitals: ProcessedVitals): Promise<void>;
  getRecentVitals(limit?: number): Promise<ProcessedVitals[]>;
}
