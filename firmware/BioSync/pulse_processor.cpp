#include "pulse_processor.h"
#include <math.h>

PulseProcessor::PulseProcessor() {
    init();
}

void PulseProcessor::init() {
    rrHead = 0;
    rrCount = 0;
    lastBeatTimestampMs = 0;
    sampleCount = 0;
    dcFilterIR = 0;
    acFilterIR = 0;
    noContactCounter = 0;
    motionArtifactCounter = 0;
    clearBuffer();
}

void PulseProcessor::clearBuffer() {
    rrHead = 0;
    rrCount = 0;
    for (size_t i = 0; i < MAX_RR_SAMPLES; i++) {
        rrBuffer[i].intervalMs = 0;
        rrBuffer[i].timestampMs = 0;
    }
}

void PulseProcessor::addRRInterval(uint32_t intervalMs, uint32_t nowMs) {
    // Physiological validity check (350ms to 1500ms -> 40 BPM to 170 BPM)
    if (intervalMs < 350 || intervalMs > 1500) return;

    rrBuffer[rrHead].intervalMs = intervalMs;
    rrBuffer[rrHead].timestampMs = nowMs;

    rrHead = (rrHead + 1) % MAX_RR_SAMPLES;
    if (rrCount < MAX_RR_SAMPLES) {
        rrCount++;
    }
}

void PulseProcessor::processSample(uint32_t redRaw, uint32_t irRaw, float currentMotion) {
    sampleCount++;
    uint32_t nowMs = millis();

    // 1. Finger contact detection threshold (MAX30102 IR threshold)
    if (irRaw < 50000) {
        noContactCounter++;
        // Clear invalid history immediately after contact loss!
        if (noContactCounter > 10) {
            clearBuffer();
            lastBeatTimestampMs = 0;
        }
        return;
    } else {
        if (noContactCounter > 0) noContactCounter--;
    }

    // 2. Motion artifact check
    if (currentMotion > 0.45f) {
        motionArtifactCounter++;
        // Do not record pulse peaks during motion artifacts!
        return;
    } else {
        if (motionArtifactCounter > 0) motionArtifactCounter--;
    }

    // 3. DC Baseline subtraction (Single-pole IIR high-pass filter)
    dcFilterIR = 0.95f * dcFilterIR + 0.05f * (float)irRaw;
    acFilterIR = (float)irRaw - dcFilterIR;

    // 4. Peak detection with adaptive threshold
    static float prevAc = 0;
    static float prevAc2 = 0;

    if (prevAc2 < prevAc && prevAc > acFilterIR && prevAc > 25.0f) {
        uint32_t interval = nowMs - lastBeatTimestampMs;
        if (lastBeatTimestampMs > 0 && interval >= 350 && interval <= 1500) {
            addRRInterval(interval, nowMs);
        }
        lastBeatTimestampMs = nowMs;
    }

    prevAc2 = prevAc;
    prevAc = acFilterIR;
}

PulseMetrics PulseProcessor::getMetrics() {
    PulseMetrics m;
    m.hrBpm = -1.0f;
    m.pulseRmssdMs = -1.0f;
    m.hasValidReading = false;
    uint32_t nowMs = millis();

    // Expire readings when beats stop (> 2.5 seconds without pulse beat)
    if (lastBeatTimestampMs > 0 && (nowMs - lastBeatTimestampMs > 2500)) {
        m.quality = (noContactCounter > 10) ? NO_CONTACT : WARMING_UP;
        return m;
    }

    if (noContactCounter > 10) {
        m.quality = NO_CONTACT;
        return m;
    }

    if (motionArtifactCounter > 15) {
        m.quality = POOR;
        return m;
    }

    // Filter timestamped 60-second window samples chronologically
    uint32_t windowStartMs = (nowMs >= 60000) ? (nowMs - 60000) : 0;
    uint32_t validIntervals[MAX_RR_SAMPLES];
    size_t validCount = 0;

    // Chronological circular-buffer traversal
    size_t startIdx = (rrCount < MAX_RR_SAMPLES) ? 0 : rrHead;
    for (size_t i = 0; i < rrCount; i++) {
        size_t idx = (startIdx + i) % MAX_RR_SAMPLES;
        if (rrBuffer[idx].timestampMs >= windowStartMs && rrBuffer[idx].intervalMs > 0) {
            validIntervals[validCount++] = rrBuffer[idx].intervalMs;
        }
    }

    if (validCount < 8) {
        m.quality = WARMING_UP;
        return m;
    }

    // Compute average HR from valid intervals in 60s window
    float sumRR = 0;
    for (size_t i = 0; i < validCount; i++) {
        sumRR += validIntervals[i];
    }
    float avgRRMs = sumRR / (float)validCount;
    m.hrBpm = 60000.0f / avgRRMs;

    // Compute experimental pulse RMSSD chronologically: sqrt( 1/(N-1) * sum( (RR[i+1] - RR[i])^2 ) )
    if (validCount >= 8) {
        float sumSquareDiffs = 0;
        size_t diffCount = 0;

        for (size_t i = 0; i < validCount - 1; i++) {
            float diff = (float)validIntervals[i + 1] - (float)validIntervals[i];
            sumSquareDiffs += (diff * diff);
            diffCount++;
        }

        if (diffCount > 0) {
            m.pulseRmssdMs = sqrtf(sumSquareDiffs / (float)diffCount);
            m.quality = GOOD;
            m.hasValidReading = true;
        } else {
            m.quality = WARMING_UP;
        }
    } else {
        m.quality = WARMING_UP;
    }

    return m;
}

const char* PulseProcessor::getQualityString(SignalQualityState q) {
    switch (q) {
        case GOOD: return "good";
        case WARMING_UP: return "warming_up";
        case POOR: return "poor";
        case NO_CONTACT: return "no_contact";
        default: return "no_contact";
    }
}
