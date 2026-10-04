#ifndef CONFIG_H
#define CONFIG_H

// --- WiFi & MQTT Configuration ---
#define WIFI_SSID "YOUR_WIFI_SSID"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"

#define MQTT_BROKER_HOST "192.168.1.100" // Replace with local Mosquitto IP
#define MQTT_BROKER_PORT 1883
#define DEVICE_ID "ESP32-HW-001"
#define MQTT_TOPIC_VITALS "biosync/ESP32-HW-001/vitals"

// --- Hardware Pinouts & I2C ---
#define SDA_PIN 21
#define SCL_PIN 22
#define I2C_CLOCK_SPEED 400000 // 400 kHz Fast-mode I2C

// --- Sampling Rates & Timers ---
#define TELEMETRY_PUBLISH_INTERVAL_MS 5000 // 5 Seconds Summary Publish
#define MAX30102_SAMPLING_FREQ_HZ 100     // 100 Hz Continuous Sampling
#define ACCEL_GRAVITY_EARTH 9.80665f      // Earth standard gravity (m/s^2)

#endif // CONFIG_H
