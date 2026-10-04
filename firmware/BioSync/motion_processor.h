#ifndef MOTION_PROCESSOR_H
#define MOTION_PROCESSOR_H

#include <Arduino.h>

class MotionProcessor {
private:
    float currentMotionNormalized;
    float gravityEarth;

public:
    MotionProcessor(float gravity = 9.80665f);

    void processAccel(float ax, float ay, float az);
    float getNormalizedMotion() const;
};

#endif // MOTION_PROCESSOR_H
