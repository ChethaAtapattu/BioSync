/*
  BioSync Planner — ESP32 Hardware Firmware (Arduino IDE Sketch)
  Target: ESP32-WROOM-32 (ESP32 Dev Module)
  Sensors: SparkFun MAX30102 (Pulse Oximeter) & Adafruit MPU6050 (6-DOF Accel/Gyro)
  Transport: MQTT over Wi-Fi (Topic: biosync/ESP32-HW-001/vitals)
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
const char* bootId = "BOOT-ESP32-1001"; // Boot identifier for reboot tracking

void setupWiFi() {
    delay(10);
    Serial.println("\n[WiFi] Connecting to SSID: " WIFI_SSID);
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    uint8_t attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 10) {
        delay(300);
        Serial.print(".");
        attempts++;
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("\n[WiFi] Connected successfully!");
        Serial.print("[WiFi] ESP32 IP Address: ");
        Serial.println(WiFi.localIP());
    } else {
        Serial.println("\n[WiFi] Connection timed out. Non-blocking reconnect active in loop().");
    }
}

void reconnectMQTT() {
    if (!mqttClient.connected()) {
        Serial.print("[MQTT] Connecting to broker ");
        Serial.print(MQTT_BROKER_HOST);
        Serial.print(":");
        Serial.print(MQTT_BROKER_PORT);
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

    StaticJsonDocument<256> doc;
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

    char buffer[256];
    serializeJson(doc, buffer);

    if (mqttClient.connected()) {
        mqttClient.publish(MQTT_TOPIC_VITALS, buffer);
        Serial.print("[MQTT PUBLISH] ");
        Serial.println(buffer);
    } else {
        Serial.print("[SERIAL DEBUG SUMMARY LOG] ");
        Serial.println(buffer);
    }
}

void setup() {
    Serial.begin(115200);
    while (!Serial && millis() < 3000);

    Serial.println("\n=============================================");
    Serial.println("BioSync Hardware Firmware — Arduino IDE Sketch");
    Serial.println("Target: ESP32-WROOM-32 (MAX30102 + MPU6050)");
    Serial.println("=============================================");

    Wire.begin(SDA_PIN, SCL_PIN, I2C_CLOCK_SPEED);

    // Initialize MAX30102 via SparkFun MAX30105 library API
    if (!particleSensor.begin(Wire, I2C_SPEED_FAST)) {
        Serial.println("[ERROR] MAX30102 pulse sensor not found at 0x57. Check SDA/SCL wiring!");
    } else {
        Serial.println("[OK] MAX30102 initialized successfully!");
        byte powerLevel = 0x1F;       // 6.4mA LED current
        byte sampleAverage = SAMPLEAVG_4; // 4x sample averaging
        byte ledMode = MODE_MULTILED;  // Red + IR mode
        int sampleRate = SAMPLERATE_100; // 100 Hz effective sample rate
        int pulseWidth = PULSEWIDTH_411; // 411us pulse width
        int adcRange = ADCRANGE_4096;   // 15-bit ADC range

        particleSensor.setup(powerLevel, sampleAverage, ledMode, sampleRate, pulseWidth, adcRange);
        particleSensor.setPulseAmplitudeRed(0x1F);
        particleSensor.setPulseAmplitudeGreen(0);
    }

    // Initialize MPU6050
    if (!mpu.begin()) {
        Serial.println("[ERROR] MPU6050 accelerometer not found at 0x68. Check SDA/SCL wiring!");
    } else {
        Serial.println("[OK] MPU6050 initialized successfully!");
        mpu.setAccelerometerRange(MPU6050_RANGE_4_G);
        mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
    }

    pulseProc.init();
    mqttClient.setServer(MQTT_BROKER_HOST, MQTT_BROKER_PORT);
    setupWiFi();
}

void loop() {
    uint32_t nowMs = millis();

    // 1. Non-blocking continuous 100Hz I2C sampling via MAX3010x FIFO check
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

    // 2. Non-blocking WiFi & MQTT Reconnect Logic (Never blocks continuous 100Hz I2C loop)
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

    // 3. Publish Summary Telemetry Payload Every 5 Seconds
    if (nowMs - lastPublishMs >= TELEMETRY_PUBLISH_INTERVAL_MS) {
        lastPublishMs = nowMs;
        publishVitalsSummary();
    }
}
