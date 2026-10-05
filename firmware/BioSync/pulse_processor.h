#ifndef PULSE_PROCESSOR_H
#define PULSE_PROCESSOR_H

#include <Arduino.h>

enum SignalQualityState {
    WARMING_UP,
    GOOD,
    POOR,
    NO_CONTACT
};

struct PulseMetrics {
    float hrBpm;
    float pulseRmssdMs;
    SignalQualityState quality;
    bool hasValidReading;
};

struct RRSample {
    uint32_t intervalMs;
    uint32_t timestampMs;
};

class PulseProcessor {
private:
    static const size_t MAX_RR_SAMPLES = 60; // Up to 60 samples in 60-second window
    RRSample rrBuffer[MAX_RR_SAMPLES];
    size_t rrHead;
    size_t rrCount;

    uint32_t lastBeatTimestampMs;
    uint32_t sampleCount;

    // Moving average filter for DC baseline removal
    float dcFilterIR;
    float acFilterIR;

    // Signal quality & contact loss counters
    uint32_t noContactCounter;
    uint32_t motionArtifactCounter;

public:
    PulseProcessor();

    void init();
    void clearBuffer();
    void processSample(uint32_t redRaw, uint32_t irRaw, float currentMotion);
    void addRRInterval(uint32_t intervalMs, uint32_t nowMs);

    PulseMetrics getMetrics();
    const char* getQualityString(SignalQualityState q);
};

#endif // PULSE_PROCESSOR_H
