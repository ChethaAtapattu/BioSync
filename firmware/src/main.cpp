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

// Hardware Devices
MAX30105 particleSensor;
Adafruit_MPU6050 mpu;
WiFiClient espClient;
PubSubClient mqttClient(espClient);

PulseProcessor pulseProc;
MotionProcessor motionProc;

uint32_t sequenceNumber = 1;
uint32_t lastPublishMs = 0;
uint32_t lastSampleMs = 0;

void setupWiFi() {
    delay(10);
    Serial.println("\n[WiFi] Connecting to network...");
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    uint8_t attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20) {
        delay(500);
        Serial.print(".");
        attempts++;
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("\n[WiFi] Connected! IP address: ");
        Serial.println(WiFi.localIP());
    } else {
        Serial.println("\n[WiFi] Connection timeout. Non-blocking retry in loop().");
    }
}

void reconnectMQTT() {
    if (!mqttClient.connected()) {
        Serial.print("[MQTT] Attempting connection to ");
        Serial.print(MQTT_BROKER_HOST);
        Serial.print("...");

        if (mqttClient.connect(DEVICE_ID)) {
            Serial.println(" connected!");
        } else {
            Serial.print(" failed, rc=");
            Serial.print(mqttClient.state());
            Serial.println(" try again in 5 seconds");
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
        Serial.print("[MQTT Publish] ");
        Serial.println(buffer);
    } else {
        Serial.print("[MQTT Offline Summary Log] ");
        Serial.println(buffer);
    }
}

void setup() {
    Serial.begin(115200);
    while (!Serial && millis() < 3000);

    Serial.println("\n=============================================");
    Serial.println("BioSync Hardware Firmware — ESP32 WROOM 32");
    Serial.println("=============================================");

    Wire.begin(SDA_PIN, SCL_PIN, I2C_CLOCK_SPEED);

    // Initialize MAX30102
    if (!particleSensor.begin(Wire, I2C_SPEED_FAST)) {
        Serial.println("[ERROR] MAX30102 pulse sensor was not found. Please check wiring!");
    } else {
        Serial.println("[OK] MAX30102 initialized successfully!");
        // Configure MAX30102: LED pulse amplitude, sample rate (100Hz), sample averaging (4x)
        byte powerLevel = 0x1F; // 6.4mA LED current
        byte sampleAverage = SAMPLEAVG_4;
        byte ledMode = MODE_MULTILED; // Red + IR
        int sampleRate = SAMPLERATE_100; // 100Hz continuous
        int pulseWidth = PULSEWIDTH_411;
        int adcRange = ADCRANGE_4096;

        particleSensor.setup(powerLevel, sampleAverage, ledMode, sampleRate, pulseWidth, adcRange);
        particleSensor.setPulseAmplitudeRed(0x1F);
        particleSensor.setPulseAmplitudeGreen(0);
    }

    // Initialize MPU6050
    if (!mpu.begin()) {
        Serial.println("[ERROR] MPU6050 accelerometer was not found. Check wiring!");
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
    // 1. Continuous Non-blocking Sampling @ ~100Hz (10ms interval)
    uint32_t nowMs = millis();
    if (nowMs - lastSampleMs >= 10) {
        lastSampleMs = nowMs;

        // Sample MAX30102
        uint32_t red = particleSensor.getRed();
        uint32_t ir = particleSensor.getIR();

        // Sample MPU6050 Accel
        sensors_event_t a, g, temp;
        mpu.getEvent(&a, &g, &temp);

        motionProc.processAccel(a.acceleration.x, a.acceleration.y, a.acceleration.z);
        pulseProc.processSample(red, ir, motionProc.getNormalizedMotion());

        particleSensor.nextSample();
    }

    // 2. Non-blocking WiFi & MQTT Reconnect Logic
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
