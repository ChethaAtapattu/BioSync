import { EnergyBand, RankedTask, Task, TaskDifficulty } from "./types.js";
/**
 * Groups difficulty rating into categorical buckets.
 */
export declare function getDifficultyCategory(difficulty: TaskDifficulty): "easy" | "medium" | "hard";
/**
 * Calculates deadline urgency weight (higher = more urgent).
 * Employs a bounded non-zero formula to prevent division by zero or negative math issues.
 */
export declare function calculateDeadlineUrgency(deadlineISO: string, nowISO?: string): {
    urgencyWeight: number;
    isOverdue: boolean;
    isDueSoon: boolean;
    minutesRemaining: number;
};
/**
 * Ranks tasks according to biometric energy band suitability and deadline urgency.
 */
export declare function rankTasks(tasks: Task[], band: EnergyBand, nowISO?: string): RankedTask[];
