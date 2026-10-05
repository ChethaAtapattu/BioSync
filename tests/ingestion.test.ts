import { describe, expect, it } from "vitest";
import { ScoringService } from "../backend/src/services/scoringService.js";
import { SqliteDatabaseManager } from "../backend/src/database/sqliteRepository.js";

describe("Telemetry Ingestion Pipeline & Regression Tests", () => {
  const db = new SqliteDatabaseManager(":memory:");
  const scoringService = new ScoringService(db);

  it("processes valid hardware sensor contract and appends backend receivedAt", () => {
    const rawPayload = {
      deviceId: "ESP32-TEST-001",
      sequence: 1,
      uptimeMs: 10000,
      bootId: "BOOT-101",
      source: "hardware",
      hrBpm: 72,
      pulseRmssdMs: 45,
      motion: 0.04,
      quality: "good",
      focusScore: 99, // Should be IGNORED!
    };

    const result = scoringService.processSensorPayload(rawPayload, 10, "hardware");
    expect(result.error).toBeUndefined();
    expect(result.vitals).not.toBeNull();
    expect(result.vitals!.receivedAt).toBeDefined();
    expect(result.vitals!.deviceId).toBe("ESP32-TEST-001");
    // Device-supplied focusScore must be ignored in favor of backend computed score
    expect(result.vitals!.score).not.toBe(99);
  });

  it("ignores live vitals broadcast when payload source does not match active selected source", () => {
    const rawPayload = {
      deviceId: "ESP32-HW-001",
      sequence: 2,
      uptimeMs: 12000,
      source: "hardware",
      hrBpm: 75,
      pulseRmssdMs: 42,
      motion: 0.05,
      quality: "good",
    };

    // Selected source is 'simulated', incoming payload is 'hardware'
    const result = scoringService.processSensorPayload(rawPayload, 0, "simulated");
    expect(result.vitals).toBeNull();
    expect(result.ignoredReason).toContain("ignored because active selected source is 'simulated'");
  });

  it("handles device reboot when sequence resets to 1 or bootId changes", () => {
    const p1 = {
      deviceId: "ESP32-REBOOT-TEST",
      sequence: 150,
      uptimeMs: 500000,
      bootId: "BOOT-V1",
      source: "simulated",
      hrBpm: 70,
      pulseRmssdMs: 40,
      motion: 0.05,
      quality: "good",
    };

    const res1 = scoringService.processSensorPayload(p1, 0, "simulated");
    expect(res1.error).toBeUndefined();

    // Reboot occurs: sequence resets to 1, uptime resets to 1000ms, new bootId
    const pReboot = {
      deviceId: "ESP32-REBOOT-TEST",
      sequence: 1,
      uptimeMs: 1000,
      bootId: "BOOT-V2",
      source: "simulated",
      hrBpm: 72,
      pulseRmssdMs: 42,
      motion: 0.04,
      quality: "good",
    };

    const resReboot = scoringService.processSensorPayload(pReboot, 0, "simulated");
    expect(resReboot.error).toBeUndefined();
    expect(resReboot.vitals).not.toBeNull();
    expect(resReboot.vitals!.sequence).toBe(1);
  });

  it("invalidates out-of-range telemetry values (HR outside 30-220 or RMSSD outside 1-300)", () => {
    const pBadRange = {
      deviceId: "ESP32-RANGE-TEST",
      sequence: 1,
      uptimeMs: 5000,
      source: "simulated",
      hrBpm: 999, // Impossible HR
      pulseRmssdMs: 500, // Impossible RMSSD
      motion: 0.05,
      quality: "good",
    };

    const res = scoringService.processSensorPayload(pBadRange, 0, "simulated");
    expect(res.vitals).not.toBeNull();
    expect(res.vitals!.hrBpm).toBeNull();
    expect(res.vitals!.pulseRmssdMs).toBeNull();
    expect(res.vitals!.score).toBeNull();
  });

  it("rejects malformed payloads missing required contract fields", () => {
    const malformed = { deviceId: "ESP32-BAD" };
    const result = scoringService.processSensorPayload(malformed, 0, "simulated");
    expect(result.vitals).toBeNull();
    expect(result.error).toContain("Malformed payload");
  });
});
