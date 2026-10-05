import { describe, expect, it } from "vitest";
import { rankTasks, Task } from "../shared/src/index.js";
import { ScoringService } from "../backend/src/services/scoringService.js";
import { SqliteDatabaseManager } from "../backend/src/database/sqliteRepository.js";
import { ClaudeRecommendationService } from "../backend/src/services/claudeService.js";

describe("Hardware Mode Integration & Source Switching Tests", () => {
  const db = new SqliteDatabaseManager(":memory:");
  const scoringService = new ScoringService(db);
  const claudeService = new ClaudeRecommendationService();

  const mockTasks: Task[] = [
    {
      id: "task-hw-1",
      title: "Hard Embedded Task",
      difficulty: 5,
      estimatedMinutes: 60,
      deadline: "2026-11-01T18:00:00.000Z",
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "task-hw-2",
      title: "Easy Lab Maintenance",
      difficulty: 1,
      estimatedMinutes: 15,
      deadline: "2026-11-01T18:00:00.000Z",
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  it("1. Ignores hardware payloads when selectedSource is set to 'simulated'", () => {
    const hwPayload = {
      deviceId: "ESP32-HW-001",
      sequence: 1,
      uptimeMs: 5000,
      bootId: "BOOT-HW-001",
      source: "hardware",
      hrBpm: 70,
      pulseRmssdMs: 50,
      motion: 0.04,
      quality: "good",
    };

    // Active selected source is 'simulated'
    const result = scoringService.processSensorPayload(hwPayload, 0, "simulated");
    expect(result.vitals).toBeNull();
    expect(result.ignoredReason).toContain("ignored because active selected source is 'simulated'");
    expect(scoringService.getLatestVitals("hardware")).not.toBeNull(); // Vitals stored for hardware
    expect(scoringService.getLatestVitals("simulated")).toBeNull(); // Simulated vitals remain null
  });

  it("2. Processes hardware telemetry and updates live vitals when selectedSource is 'hardware'", () => {
    const hwPayload = {
      deviceId: "ESP32-HW-001",
      sequence: 2,
      uptimeMs: 10000,
      bootId: "BOOT-HW-001",
      source: "hardware",
      hrBpm: 68,
      pulseRmssdMs: 52,
      motion: 0.03,
      quality: "good",
    };

    // Active selected source is 'hardware'
    const result = scoringService.processSensorPayload(hwPayload, 10, "hardware");
    expect(result.vitals).not.toBeNull();
    expect(result.vitals!.source).toBe("hardware");
    expect(result.vitals!.band).toBe("HIGH");

    const latestHW = scoringService.getLatestVitals("hardware");
    expect(latestHW).not.toBeNull();
    expect(latestHW!.score).toBeGreaterThanOrEqual(70);
  });

  it("3. Generates recommendations based on hardware vitals when hardware source is selected", async () => {
    const hwPayload = {
      deviceId: "ESP32-HW-REC",
      sequence: 1,
      uptimeMs: 10000,
      bootId: "BOOT-REC",
      source: "hardware",
      hrBpm: 68,
      pulseRmssdMs: 52,
      motion: 0.03,
      quality: "good",
    };
    scoringService.processSensorPayload(hwPayload, 10, "hardware");

    const latestHW = scoringService.getLatestVitals("hardware");
    expect(latestHW).not.toBeNull();

    const band = latestHW!.band; // 'HIGH'
    const score = latestHW!.score;
    const ranked = rankTasks(mockTasks, band);

    const rec = await claudeService.getRecommendation(band, score, ranked, 10);
    expect(rec.advice).toBeDefined();
    expect(rec.suggestedAction).toBeDefined();
  });

  it("4. Handles switching to hardware when no connected sensor telemetry exists", () => {
    const emptyScoring = new ScoringService(db);

    // No hardware telemetry has been received yet
    const latestHW = emptyScoring.getLatestVitals("hardware");
    expect(latestHW).toBeNull();

    // Task planner should fall back to UNAVAILABLE band & deadline ranking
    const band = latestHW?.band || "UNAVAILABLE";
    expect(band).toBe("UNAVAILABLE");

    const ranked = rankTasks(mockTasks, band);
    expect(ranked[0].reason).toContain("ranked by deadline urgency");
  });

  it("5. Rejects duplicate sequence numbers within same bootId and accepts new bootId as reboot", () => {
    const bootService = new ScoringService(db);

    const payloadBoot1 = {
      deviceId: "ESP32-BOOT-TEST",
      sequence: 10,
      uptimeMs: 20000,
      bootId: "BOOT-SESSION-A",
      source: "hardware",
      hrBpm: 72,
      pulseRmssdMs: 45,
      motion: 0.04,
      quality: "good",
    };

    // 1st packet accepted
    const r1 = bootService.processSensorPayload(payloadBoot1, 0, "hardware");
    expect(r1.vitals).not.toBeNull();

    // Duplicate sequence 10 within same bootId 'BOOT-SESSION-A' REJECTED
    const rDuplicate = bootService.processSensorPayload(payloadBoot1, 0, "hardware");
    expect(rDuplicate.vitals).toBeNull();
    expect(rDuplicate.error).toContain("Duplicate or out-of-order sequence");

    // Device reboot: NEW bootId 'BOOT-SESSION-B' with sequence reset to 1 -> ACCEPTED
    const payloadBoot2 = {
      deviceId: "ESP32-BOOT-TEST",
      sequence: 1,
      uptimeMs: 1000,
      bootId: "BOOT-SESSION-B",
      source: "hardware",
      hrBpm: 74,
      pulseRmssdMs: 46,
      motion: 0.03,
      quality: "good",
    };

    const rReboot = bootService.processSensorPayload(payloadBoot2, 0, "hardware");
    expect(rReboot.vitals).not.toBeNull();
    expect(rReboot.vitals!.sequence).toBe(1);
    expect(rReboot.vitals!.bootId).toBe("BOOT-SESSION-B");
  });
});
