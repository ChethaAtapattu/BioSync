export class SimulatorService {
    deviceId;
    currentScenario = "rested";
    sequence = 1;
    startTimeMs = Date.now();
    timer = null;
    callback = null;
    constructor(deviceId = "SIM-ESP32-001") {
        this.deviceId = deviceId;
    }
    setScenario(scenario) {
        this.currentScenario = scenario;
        console.log(`Simulator scenario set to: ${scenario}`);
    }
    getScenario() {
        return this.currentScenario;
    }
    start(intervalMs = 2000, callback) {
        this.stop();
        this.callback = callback;
        this.timer = setInterval(() => this.tick(), intervalMs);
        console.log(`Simulator started emitting every ${intervalMs}ms`);
    }
    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
    tick() {
        if (this.currentScenario === "disconnected") {
            // Disconnected scenario: simply emit nothing!
            return;
        }
        const uptimeMs = Date.now() - this.startTimeMs;
        const seq = this.sequence++;
        let payload;
        switch (this.currentScenario) {
            case "rested":
                payload = {
                    deviceId: this.deviceId,
                    sequence: seq,
                    uptimeMs,
                    source: "simulated",
                    hrBpm: 68 + Math.round((Math.random() - 0.5) * 4),
                    pulseRmssdMs: 52 + Math.round((Math.random() - 0.5) * 6),
                    motion: Number((0.03 + Math.random() * 0.03).toFixed(2)),
                    quality: "good",
                };
                break;
            case "elevated_pulse":
                payload = {
                    deviceId: this.deviceId,
                    sequence: seq,
                    uptimeMs,
                    source: "simulated",
                    hrBpm: 108 + Math.round((Math.random() - 0.5) * 6),
                    pulseRmssdMs: 24 + Math.round((Math.random() - 0.5) * 4),
                    motion: Number((0.05 + Math.random() * 0.04).toFixed(2)),
                    quality: "good",
                };
                break;
            case "prolonged_session":
                // Lower HRV RMSSD and elevated HR simulating deep fatigue after 100+ mins
                payload = {
                    deviceId: this.deviceId,
                    sequence: seq,
                    uptimeMs,
                    source: "simulated",
                    hrBpm: 86 + Math.round((Math.random() - 0.5) * 5),
                    pulseRmssdMs: 18 + Math.round((Math.random() - 0.5) * 3),
                    motion: Number((0.06 + Math.random() * 0.04).toFixed(2)),
                    quality: "good",
                };
                break;
            case "motion_artifact":
                payload = {
                    deviceId: this.deviceId,
                    sequence: seq,
                    uptimeMs,
                    source: "simulated",
                    hrBpm: 115 + Math.round((Math.random() - 0.5) * 15),
                    pulseRmssdMs: 14 + Math.round((Math.random() - 0.5) * 8),
                    motion: Number((0.72 + Math.random() * 0.2).toFixed(2)),
                    quality: "poor",
                };
                break;
            case "no_finger_contact":
                payload = {
                    deviceId: this.deviceId,
                    sequence: seq,
                    uptimeMs,
                    source: "simulated",
                    hrBpm: null,
                    pulseRmssdMs: null,
                    motion: Number((0.02 + Math.random() * 0.02).toFixed(2)),
                    quality: "no_contact",
                };
                break;
            default:
                payload = {
                    deviceId: this.deviceId,
                    sequence: seq,
                    uptimeMs,
                    source: "simulated",
                    hrBpm: 72,
                    pulseRmssdMs: 48,
                    motion: 0.05,
                    quality: "good",
                };
        }
        if (this.callback) {
            this.callback(payload);
        }
    }
}
