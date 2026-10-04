#include "motion_processor.h"
#include <math.h>

MotionProcessor::MotionProcessor(float gravity) {
    gravityEarth = gravity;
    currentMotionNormalized = 0.0f;
}

/**
 * Estimates movement after removing gravity component.
 * Motion = clamp( (|accel| - g) / 5.0, 0, 1 )
 */
void MotionProcessor::processAccel(float ax, float ay, float az) {
    float magnitude = sqrtf(ax * ax + ay * ay + az * az);
    float devFromGravity = fabsf(magnitude - gravityEarth);

    float targetMotion = devFromGravity / 5.0f;
    if (targetMotion > 1.0f) targetMotion = 1.0f;
    if (targetMotion < 0.0f) targetMotion = 0.0f;

    currentMotionNormalized = 0.8f * currentMotionNormalized + 0.2f * targetMotion;
}

float MotionProcessor::getNormalizedMotion() const {
    return currentMotionNormalized;
}
