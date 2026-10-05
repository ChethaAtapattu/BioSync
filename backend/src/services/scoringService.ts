import {
  calculateFocusScore,
  ProcessedVitals,
  SensorPayload,
  SensorSource,
} from "@biosync/shared";
import { SqliteDatabaseManager } from "../database/sqliteRepository.js";

interface DeviceState {
  sequence: number;
  uptimeMs: number;
  bootId?: string;
}

export class ScoringService {
  private deviceStateMap: Map<string, DeviceState> = new Map();
  private latestVitalsBySource: Map<SensorSource, ProcessedVitals> = new Map();
  private lastUpdateTimestampBySource: Map<SensorSource, number> = new Map();
  private staleTimeoutMs: number = 15000; // 15 seconds stale threshold

  constructor(private db: SqliteDatabaseManager) {}

  /**
   * Processes an incoming raw sensor payload.
   * Enforces numeric range validations, reboot detection, source selection filtering,
   * deduplication, backend ISO timestamping, and Focus Score calculation.
   */
  public processSensorPayload(
    rawPayload: any,
    currentSessionMinutes: number = 0,
    activeSelectedSource: SensorSource = "simulated"
  ): { vitals: ProcessedVitals | null; error?: string; ignoredReason?: string } {
    // 1. Schema & Structure Validation
    if (!rawPayload || typeof rawPayload !== "object") {
      return { vitals: null, error: "Malformed payload: Not an object" };
    }

    const { deviceId, sequence, uptimeMs, bootId, source, hrBpm, pulseRmssdMs, motion, quality } = rawPayload;

    if (!deviceId || typeof deviceId !== "string" || deviceId.trim().length === 0) {
      return { vitals: null, error: "Malformed payload: Missing or invalid deviceId" };
    }

    if (typeof sequence !== "number" || !Number.isInteger(sequence) || sequence < 0) {
      return { vitals: null, error: "Malformed payload: Invalid sequence number" };
    }

    if (typeof uptimeMs !== "number" || uptimeMs < 0) {
      return { vitals: null, error: "Malformed payload: Invalid uptimeMs" };
    }

    if (source !== "simulated" && source !== "hardware") {
      return { vitals: null, error: "Malformed payload: Invalid source field" };
    }

    const validQualities = ["warming_up", "good", "poor", "no_contact"];
    if (!validQualities.includes(quality)) {
      return { vitals: null, error: `Malformed payload: Invalid quality status '${quality}'` };
    }

    // 2. Telemetry Numeric Range Validation
    let cleanHr: number | null = null;
    if (hrBpm !== null && hrBpm !== undefined) {
      if (typeof hrBpm !== "number" || isNaN(hrBpm) || hrBpm < 30 || hrBpm > 220) {
        cleanHr = null; // Invalidate out-of-range HR reading
      } else {
        cleanHr = hrBpm;
      }
    }

    let cleanRmssd: number | null = null;
    if (pulseRmssdMs !== null && pulseRmssdMs !== undefined) {
      if (typeof pulseRmssdMs !== "number" || isNaN(pulseRmssdMs) || pulseRmssdMs < 1 || pulseRmssdMs > 300) {
        cleanRmssd = null; // Invalidate out-of-range RMSSD reading
      } else {
        cleanRmssd = pulseRmssdMs;
      }
    }

    let cleanMotion: number | null = null;
    if (motion !== null && motion !== undefined) {
      if (typeof motion === "number" && !isNaN(motion)) {
        cleanMotion = Math.min(1.0, Math.max(0.0, motion));
      }
    }

    // 3. Reboot & Sequence Deduplication Policy
    const storedState = this.deviceStateMap.get(deviceId);
    let isReboot = false;

    if (storedState) {
      if (bootId && storedState.bootId && bootId !== storedState.bootId) {
        isReboot = true;
      } else if (sequence < storedState.sequence) {
        isReboot = true; // Sequence number reset to 1
      } else if (uptimeMs < storedState.uptimeMs) {
        isReboot = true; // Device uptime reset to 0
      }
    }

    if (!isReboot && storedState && sequence <= storedState.sequence && sequence !== 0) {
      return { vitals: null, error: `Duplicate or out-of-order sequence ${sequence} for device ${deviceId}` };
    }

    // Update stored state for reboot tracking
    this.deviceStateMap.set(deviceId, {
      sequence,
      uptimeMs,
      bootId: typeof bootId === "string" ? bootId : undefined,
    });

    if (isReboot) {
      console.log(`[Device Reboot Detected] Reset sequence tracker for device '${deviceId}' (seq #${sequence}, uptime ${uptimeMs}ms)`);
    }

    // 4. Source Filter Gate
    // If incoming source does not match activeSelectedSource, log payload but do not update live vitals
    const receivedAt = new Date().toISOString();
    const nowMs = Date.now();
    this.lastUpdateTimestampBySource.set(source, nowMs);

    const cleanPayload: SensorPayload = {
      deviceId,
      sequence,
      uptimeMs,
      bootId: typeof bootId === "string" ? bootId : undefined,
      source,
      hrBpm: cleanHr,
      pulseRmssdMs: cleanRmssd,
      motion: cleanMotion,
      quality,
    };

    const scoreResult = calculateFocusScore(
      cleanPayload.hrBpm,
      cleanPayload.pulseRmssdMs,
      cleanPayload.motion,
      cleanPayload.quality,
      currentSessionMinutes,
      false
    );

    const processed: ProcessedVitals = {
      ...cleanPayload,
      receivedAt,
      isStale: false,
      score: scoreResult.score,
      band: scoreResult.band,
      reason: scoreResult.reason,
    };

    this.latestVitalsBySource.set(source, processed);

    // Log to DB
    this.db.logVitals(processed).catch((err) => {
      console.error("Failed to log vitals to DB:", err);
    });

    if (source !== activeSelectedSource) {
      return {
        vitals: null,
        ignoredReason: `Payload source '${source}' ignored because active selected source is '${activeSelectedSource}'`,
      };
    }

    return { vitals: processed };
  }

  /**
   * Retrieves latest processed vitals for the currently selected source, checking 15s stale timeout.
   */
  public getLatestVitals(selectedSource: SensorSource = "simulated"): ProcessedVitals | null {
    const vitals = this.latestVitalsBySource.get(selectedSource);
    if (!vitals) return null;

    const lastTs = this.lastUpdateTimestampBySource.get(selectedSource) || 0;
    const elapsedMs = Date.now() - lastTs;

    if (elapsedMs > this.staleTimeoutMs) {
      return {
        ...vitals,
        isStale: true,
        score: null,
        band: "UNAVAILABLE",
        reason: `Sensor telemetry from source '${selectedSource}' is stale (>15s without update)`,
      };
    }

    return vitals;
  }
}
