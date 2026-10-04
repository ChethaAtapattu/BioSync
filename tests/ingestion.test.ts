import { describe, expect, it } from "vitest";
import { ScoringService } from "../backend/src/services/scoringService.js";
import { SqliteDatabaseManager } from "../backend/src/database/sqliteRepository.js";

describe("Telemetry Ingestion & Data Contract Pipeline", () => {
  const db = new SqliteDatabaseManager(":memory:");
  const scoringService = new ScoringService(db);

  it("processes valid simulated/hardware sensor contract and appends backend receivedAt", () => {
    const rawPayload = {
      deviceId: "ESP32-TEST-001",
      sequence: 1,
      uptimeMs: 10000,
      source: "hardware",
      hrBpm: 72,
      pulseRmssdMs: 45,
      motion: 0.04,
      quality: "good",
      focusScore: 99, // Should be IGNORED!
    };

    const result = scoringService.processSensorPayload(rawPayload, 10);
    expect(result.error).toBeUndefined();
    expect(result.vitals).not.toBeNull();
    expect(result.vitals!.receivedAt).toBeDefined();
    expect(result.vitals!.deviceId).toBe("ESP32-TEST-001");
    // Ensure device focusScore was NOT copied into score (score must be backend computed!)
    expect(result.vitals!.score).not.toBe(99);
  });

  it("rejects malformed payloads missing required contract fields", () => {
    const malformed = { deviceId: "ESP32-BAD" }; // missing sequence, quality, etc.
    const result = scoringService.processSensorPayload(malformed);
    expect(result.vitals).toBeNull();
    expect(result.error).toContain("Malformed payload");
  });

  it("rejects duplicate sequence numbers for the same deviceId", () => {
    const payload1 = {
      deviceId: "ESP32-SEQ-TEST",
      sequence: 10,
      uptimeMs: 5000,
      source: "hardware",
      hrBpm: 70,
      pulseRmssdMs: 40,
      motion: 0.05,
      quality: "good",
    };

    const res1 = scoringService.processSensorPayload(payload1);
    expect(res1.error).toBeUndefined();

    // Re-send exact same sequence number 10
    const res2 = scoringService.processSensorPayload(payload1);
    expect(res2.vitals).toBeNull();
    expect(res2.error).toContain("Duplicate or out-of-order sequence");
  });
});
