import { calculateFocusScore, } from "@biosync/shared";
export class ScoringService {
    db;
    lastSequenceMap = new Map();
    latestVitals = null;
    lastUpdateTimestamp = Date.now();
    staleTimeoutMs = 15000; // 15 seconds stale limit
    constructor(db) {
        this.db = db;
        // Periodically check for stale readings (every 3 seconds)
        setInterval(() => this.checkStaleStatus(), 3000);
    }
    /**
     * Processes an incoming raw sensor payload, validates schema, deduplicates sequence numbers,
     * adds backend receivedAt timestamp, and calculates Focus Score and Energy Band.
     */
    processSensorPayload(rawPayload, currentSessionMinutes = 0) {
        // 1. Schema Validation
        if (!rawPayload || typeof rawPayload !== "object") {
            return { vitals: null, error: "Malformed payload: Not an object" };
        }
        const { deviceId, sequence, uptimeMs, source, hrBpm, pulseRmssdMs, motion, quality } = rawPayload;
        if (!deviceId || typeof deviceId !== "string") {
            return { vitals: null, error: "Malformed payload: Missing or invalid deviceId" };
        }
        if (typeof sequence !== "number") {
            return { vitals: null, error: "Malformed payload: Missing or invalid sequence" };
        }
        if (typeof uptimeMs !== "number") {
            return { vitals: null, error: "Malformed payload: Missing or invalid uptimeMs" };
        }
        if (source !== "simulated" && source !== "hardware") {
            return { vitals: null, error: "Malformed payload: Invalid source field" };
        }
        const validQualities = ["warming_up", "good", "poor", "no_contact"];
        if (!validQualities.includes(quality)) {
            return { vitals: null, error: `Malformed payload: Invalid quality status '${quality}'` };
        }
        // 2. Duplicate sequence number rejection
        const lastSeq = this.lastSequenceMap.get(deviceId);
        if (lastSeq !== undefined && sequence <= lastSeq && sequence !== 0) {
            return { vitals: null, error: `Duplicate or out-of-order sequence ${sequence} for device ${deviceId}` };
        }
        this.lastSequenceMap.set(deviceId, sequence);
        // Note: If device supplied focusScore, it is intentionally omitted / ignored here!
        const cleanPayload = {
            deviceId,
            sequence,
            uptimeMs,
            source,
            hrBpm: typeof hrBpm === "number" ? hrBpm : null,
            pulseRmssdMs: typeof pulseRmssdMs === "number" ? pulseRmssdMs : null,
            motion: typeof motion === "number" ? motion : null,
            quality,
        };
        const receivedAt = new Date().toISOString();
        this.lastUpdateTimestamp = Date.now();
        // 3. Compute score using single shared backend implementation
        const scoreResult = calculateFocusScore(cleanPayload.hrBpm, cleanPayload.pulseRmssdMs, cleanPayload.motion, cleanPayload.quality, currentSessionMinutes, false // Not stale at ingestion moment
        );
        const processed = {
            ...cleanPayload,
            receivedAt,
            isStale: false,
            score: scoreResult.score,
            band: scoreResult.band,
            reason: scoreResult.reason,
        };
        this.latestVitals = processed;
        // Log to DB
        this.db.logVitals(processed).catch((err) => {
            console.error("Failed to log vitals to DB:", err);
        });
        return { vitals: processed };
    }
    /**
     * Checks if the latest vitals reading has gone stale (>15 seconds without update).
     */
    checkStaleStatus() {
        if (!this.latestVitals)
            return;
        const elapsedMs = Date.now() - this.lastUpdateTimestamp;
        if (elapsedMs > this.staleTimeoutMs && !this.latestVitals.isStale) {
            this.latestVitals = {
                ...this.latestVitals,
                isStale: true,
                score: null,
                band: "UNAVAILABLE",
                reason: "Sensor data stale (>15s without telemetry update)",
            };
        }
    }
    getLatestVitals() {
        if (!this.latestVitals)
            return null;
        const elapsedMs = Date.now() - this.lastUpdateTimestamp;
        if (elapsedMs > this.staleTimeoutMs) {
            return {
                ...this.latestVitals,
                isStale: true,
                score: null,
                band: "UNAVAILABLE",
                reason: "Sensor data stale (>15s without telemetry update)",
            };
        }
        return this.latestVitals;
    }
}
