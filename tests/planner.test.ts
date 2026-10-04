import { describe, expect, it } from "vitest";
import { rankTasks, calculateDeadlineUrgency } from "../shared/src/planner.js";
import { Task } from "../shared/src/types.js";

describe("Biometric Task Planner", () => {
  const mockNow = "2026-10-05T10:00:00.000Z";

  const sampleTasks: Task[] = [
    {
      id: "task-easy",
      title: "Easy Task",
      difficulty: 1,
      estimatedMinutes: 15,
      deadline: "2026-10-05T18:00:00.000Z", // Due in 8h
      status: "pending",
      createdAt: mockNow,
      updatedAt: mockNow,
    },
    {
      id: "task-medium",
      title: "Medium Task",
      difficulty: 3,
      estimatedMinutes: 30,
      deadline: "2026-10-05T18:00:00.000Z", // Due in 8h
      status: "pending",
      createdAt: mockNow,
      updatedAt: mockNow,
    },
    {
      id: "task-hard",
      title: "Hard Task",
      difficulty: 5,
      estimatedMinutes: 60,
      deadline: "2026-10-05T18:00:00.000Z", // Due in 8h
      status: "pending",
      createdAt: mockNow,
      updatedAt: mockNow,
    },
  ];

  it("prioritizes Hard difficulty task in HIGH energy band", () => {
    const ranked = rankTasks(sampleTasks, "HIGH", mockNow);
    expect(ranked[0].id).toBe("task-hard");
    expect(ranked[0].rank).toBe(1);
    expect(ranked[0].reason).toContain("HIGH energy");
  });

  it("prioritizes Medium difficulty task in MEDIUM energy band", () => {
    const ranked = rankTasks(sampleTasks, "MEDIUM", mockNow);
    expect(ranked[0].id).toBe("task-medium");
    expect(ranked[0].rank).toBe(1);
  });

  it("prioritizes Easy difficulty task in LOW energy band", () => {
    const ranked = rankTasks(sampleTasks, "LOW", mockNow);
    expect(ranked[0].id).toBe("task-easy");
    expect(ranked[0].rank).toBe(1);
  });

  it("boosts overdue tasks to top priority regardless of energy band", () => {
    const tasksWithOverdue: Task[] = [
      ...sampleTasks,
      {
        id: "task-overdue",
        title: "Critical Overdue Task",
        difficulty: 1,
        estimatedMinutes: 20,
        deadline: "2026-10-05T09:30:00.000Z", // Overdue by 30 mins
        status: "pending",
        createdAt: mockNow,
        updatedAt: mockNow,
      },
    ];

    const rankedInHigh = rankTasks(tasksWithOverdue, "HIGH", mockNow);
    expect(rankedInHigh[0].id).toBe("task-overdue");
    expect(rankedInHigh[0].isOverdue).toBe(true);
    expect(rankedInHigh[0].reason).toContain("OVERDUE");
  });

  it("computes bounded deadline urgency without division by zero", () => {
    // Exact same deadline as now
    const urgency = calculateDeadlineUrgency(mockNow, mockNow);
    expect(urgency.urgencyWeight).toBeGreaterThan(0);
    expect(urgency.minutesRemaining).toBe(0);
  });

  it("maintains stable sorting for identical priorities", () => {
    const t1 = rankTasks(sampleTasks, "HIGH", mockNow);
    const t2 = rankTasks(sampleTasks, "HIGH", mockNow);
    expect(t1.map((t) => t.id)).toEqual(t2.map((t) => t.id));
  });
});
