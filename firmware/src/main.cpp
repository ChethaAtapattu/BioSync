/*
  BioSync Planner — ESP32 Hardware Firmware (PlatformIO main.cpp)
  Target: ESP32-WROOM-32 (ESP32 Dev Module)
  Sensors: SparkFun MAX30102 (Pulse Oximeter) & Adafruit MPU6050 (6-DOF Accel/Gyro)
  Transport: MQTT over Wi-Fi (Topic: biosync/ESP32-HW-001/vitals)
  Configuration: ESP32 Web Setup Portal (BioSync-Setup Access Point + NVS Preferences)
*/

#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <Wire.h>

#include "MAX30105.h"
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>

#include "config.h"
#include "web_portal.h"
#include "pulse_processor.h"
#include "motion_processor.h"

// Hardware Device Instances
MAX30105 particleSensor;
Adafruit_MPU6050 mpu;
WiFiClient espClient;
PubSubClient mqttClient(espClient);

PulseProcessor pulseProc;
MotionProcessor motionProc;

uint32_t sequenceNumber = 1;
uint32_t lastPublishMs = 0;
uint32_t lastSampleMs = 0;
uint32_t buttonPressStartMs = 0;
char bootId[32]; // Unique per-boot identifier for reboot tracking

void generateBootId() {
    uint32_t r1 = esp_random();
    uint32_t r2 = esp_random();
    snprintf(bootId, sizeof(bootId), "BOOT-%08X-%08X", r1, r2);
}

void checkReconfigTriggers() {
    // 1. Check Serial Monitor Commands
    if (Serial.available() > 0) {
        String cmd = Serial.readStringUntil('\n');
        cmd.trim();
        cmd.toUpperCase();
        if (cmd == "C" || cmd == "CONFIG" || cmd == "RESET") {
            Serial.println("\n[SETUP TRIGGER] Serial 'C' command received! Erasing credentials & launching Access Point mode...");
            webPortal.triggerReconfiguration();
        }
    }

    // 2. Check BOOT Button (GPIO 0) holding for 3 seconds
    if (digitalRead(SETUP_BUTTON_PIN) == LOW) {
        if (buttonPressStartMs == 0) {
            buttonPressStartMs = millis();
        } else if (millis() - buttonPressStartMs > 3000) {
            Serial.println("\n[SETUP TRIGGER] BOOT button (GPIO 0) held for 3s! Erasing credentials & launching Access Point mode...");
            buttonPressStartMs = 0;
            webPortal.triggerReconfiguration();
        }
    } else {
        buttonPressStartMs = 0;
    }
}

void reconnectMQTT() {
    if (WiFi.status() != WL_CONNECTED) return;

    const BioSyncDeviceConfig &cfg = webPortal.getConfig();
    if (strlen(cfg.mqttHost) == 0) return;

    mqttClient.setServer(cfg.mqttHost, cfg.mqttPort);

    if (!mqttClient.connected()) {
        Serial.print("[MQTT] Connecting to broker ");
        Serial.print(cfg.mqttHost);
        Serial.print(":");
        Serial.print(cfg.mqttPort);
        Serial.print("...");

        if (mqttClient.connect(DEVICE_ID)) {
            Serial.println(" CONNECTED!");
        } else {
            Serial.print(" FAILED (rc=");
            Serial.print(mqttClient.state());
            Serial.println("). Non-blocking retry active.");
        }
    }
}

void publishVitalsSummary() {
    PulseMetrics p = pulseProc.getMetrics();
    float motion = motionProc.getNormalizedMotion();

    StaticJsonDocument<384> doc;
    doc["deviceId"] = DEVICE_ID;
    doc["sequence"] = sequenceNumber++;
    doc["uptimeMs"] = millis();
    doc["bootId"] = bootId;
    doc["source"] = "hardware";

    if (p.quality == GOOD) {
        doc["hrBpm"] = round(p.hrBpm * 10.0f) / 10.0f;
        doc["pulseRmssdMs"] = round(p.pulseRmssdMs * 10.0f) / 10.0f;
    } else {
        doc["hrBpm"] = nullptr;
        doc["pulseRmssdMs"] = nullptr;
    }

    doc["motion"] = round(motion * 100.0f) / 100.0f;
    doc["quality"] = pulseProc.getQualityString(p.quality);

    char buffer[384];
    size_t len = serializeJson(doc, buffer, sizeof(buffer));

    if (mqttClient.connected()) {
        bool published = mqttClient.publish(MQTT_TOPIC_VITALS, (const uint8_t*)buffer, len, false);
        if (published) {
            Serial.print("[MQTT PUBLISH SUCCESS] ");
            Serial.println(buffer);
        } else {
            Serial.print("[MQTT PUBLISH FAILED] Length: ");
            Serial.println(len);
        }
    } else {
        Serial.print("[SERIAL DEBUG SUMMARY LOG] ");
        Serial.println(buffer);
    }
}

void setup() {
    Serial.begin(115200);
    while (!Serial && millis() < 3000);

    pinMode(SETUP_BUTTON_PIN, INPUT_PULLUP);

    generateBootId();

    Serial.println("\n==================================================");
    Serial.println("BioSync Hardware Firmware — ESP32-WROOM-32");
    Serial.print("Boot ID: "); Serial.println(bootId);
    Serial.println("Web Setup Portal & NVS Preferences Enabled");
    Serial.println("Press BOOT button (GPIO 0) or send 'C' over Serial to open Setup.");
    Serial.println("==================================================\n");

    Wire.begin(SDA_PIN, SCL_PIN, I2C_CLOCK_SPEED);

    if (!particleSensor.begin(Wire, I2C_SPEED_FAST)) {
        Serial.println("[ERROR] MAX30102 pulse sensor not found at 0x57. Check SDA/SCL wiring!");
    } else {
        Serial.println("[OK] MAX30102 initialized successfully!");
        particleSensor.setup(0x1F, 1, 2, 100, 411, 4096);
        particleSensor.setPulseAmplitudeRed(0x1F);
        particleSensor.setPulseAmplitudeGreen(0);
    }

    if (!mpu.begin()) {
        Serial.println("[ERROR] MPU6050 accelerometer not found at 0x68. Check SDA/SCL wiring!");
    } else {
        Serial.println("[OK] MPU6050 initialized successfully!");
        mpu.setAccelerometerRange(MPU6050_RANGE_4_G);
        mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
    }

    pulseProc.init();

    mqttClient.setBufferSize(512);

    // Initialize Preferences & Web Setup Portal (or load stored WiFi/MQTT credentials)
    webPortal.begin();

    // If BOOT button pressed at startup, force setup AP mode immediately
    if (digitalRead(SETUP_BUTTON_PIN) == LOW) {
        Serial.println("[SETUP TRIGGER] BOOT button pressed during startup! Launching Access Point mode...");
        webPortal.triggerReconfiguration();
    }
}

void loop() {
    uint32_t nowMs = millis();

    // 1. Check Serial commands and BOOT button press for reopening setup portal
    checkReconfigTriggers();

    // 2. Handle HTTP Setup Portal requests non-blockingly
    webPortal.handleClient();

    // 3. Non-blocking continuous 100Hz I2C sampling via MAX3010x FIFO (Runs during AP mode & network failures!)
    if (nowMs - lastSampleMs >= 10) {
        lastSampleMs = nowMs;

        particleSensor.check(); // Check sensor FIFO buffer
        while (particleSensor.available()) {
            uint32_t red = particleSensor.getFIFORed();
            uint32_t ir = particleSensor.getFIFOIR();

            sensors_event_t a, g, temp;
            mpu.getEvent(&a, &g, &temp);

            motionProc.processAccel(a.acceleration.x, a.acceleration.y, a.acceleration.z);
            pulseProc.processSample(red, ir, motionProc.getNormalizedMotion());

            particleSensor.nextSample(); // Advance FIFO read pointer
        }
    }

    // 4. Non-blocking WiFi & MQTT Reconnect Logic
    if (WiFi.status() == WL_CONNECTED) {
        if (!mqttClient.connected()) {
            static uint32_t lastMqttReconnect = 0;
            if (nowMs - lastMqttReconnect > 5000) {
                lastMqttReconnect = nowMs;
                reconnectMQTT();
            }
        } else {
            mqttClient.loop();
        }
    }

    // 5. Publish Summary Telemetry Payload Every 5 Seconds (Log to Serial if MQTT offline)
    if (nowMs - lastPublishMs >= TELEMETRY_PUBLISH_INTERVAL_MS) {
        lastPublishMs = nowMs;
        publishVitalsSummary();
    }
}
