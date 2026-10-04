#include "pulse_processor.h"
#include <math.h>

PulseProcessor::PulseProcessor() {
    rrHead = 0;
    rrCount = 0;
    lastBeatTimestampMs = 0;
    sampleCount = 0;
    dcFilterIR = 0;
    acFilterIR = 0;
    noContactCounter = 0;
    motionArtifactCounter = 0;
}

void PulseProcessor::init() {
    rrHead = 0;
    rrCount = 0;
    lastBeatTimestampMs = 0;
    sampleCount = 0;
}

void PulseProcessor::addRRInterval(uint32_t intervalMs) {
    // Physiological validity check (350ms to 1500ms -> 40 BPM to 170 BPM)
    if (intervalMs < 350 || intervalMs > 1500) return;

    rrIntervalsMs[rrHead] = intervalMs;
    rrHead = (rrHead + 1) % MAX_RR_SAMPLES;
    if (rrCount < MAX_RR_SAMPLES) {
        rrCount++;
    }
}

void PulseProcessor::processSample(uint32_t redRaw, uint32_t irRaw, float currentMotion) {
    sampleCount++;

    // 1. Finger contact detection threshold (MAX30102 IR threshold)
    if (irRaw < 50000) {
        noContactCounter++;
        return;
    } else {
        if (noContactCounter > 0) noContactCounter--;
    }

    // 2. Motion artifact check
    if (currentMotion > 0.45f) {
        motionArtifactCounter++;
    } else {
        if (motionArtifactCounter > 0) motionArtifactCounter--;
    }

    // 3. DC Baseline subtraction (Single-pole IIR high-pass filter)
    dcFilterIR = 0.95f * dcFilterIR + 0.05f * (float)irRaw;
    acFilterIR = (float)irRaw - dcFilterIR;

    // 4. Peak detection with adaptive threshold
    uint32_t nowMs = millis();
    static float prevAc = 0;
    static float prevAc2 = 0;

    if (prevAc2 < prevAc && prevAc > acFilterIR && prevAc > 25.0f) {
        uint32_t interval = nowMs - lastBeatTimestampMs;
        if (lastBeatTimestampMs > 0 && interval >= 350 && interval <= 1500) {
            addRRInterval(interval);
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

    if (noContactCounter > 10) {
        m.quality = NO_CONTACT;
        return m;
    }

    if (motionArtifactCounter > 15) {
        m.quality = POOR;
        return m;
    }

    if (rrCount < 8) {
        m.quality = WARMING_UP;
        return m;
    }

    // Compute average HR from rolling RR intervals
    float sumRR = 0;
    for (size_t i = 0; i < rrCount; i++) {
        sumRR += rrIntervalsMs[i];
    }
    float avgRRMs = sumRR / (float)rrCount;
    m.hrBpm = 60000.0f / avgRRMs;

    // Compute experimental pulse RMSSD: sqrt( 1/(N-1) * sum( (RR[i+1] - RR[i])^2 ) )
    if (rrCount >= 8) {
        float sumSquareDiffs = 0;
        size_t diffCount = 0;

        for (size_t i = 0; i < rrCount - 1; i++) {
            float diff = (float)rrIntervalsMs[i + 1] - (float)rrIntervalsMs[i];
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
