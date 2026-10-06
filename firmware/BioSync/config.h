#ifndef CONFIG_H
#define CONFIG_H

// --- Access Point & Setup Portal Defaults ---
#define AP_SSID "BioSync-Setup"
#define AP_PASSWORD "biosyncsetup" // WPA2 Password-protected Access Point
#define AP_IP_ADDR "192.168.4.1"

// --- NVS Storage Namespace & Default Fallbacks ---
#define PREFS_NAMESPACE "biosync"
#define DEFAULT_MQTT_HOST "192.168.1.100"
#define DEFAULT_MQTT_PORT 1883
#define DEVICE_ID "ESP32-HW-001"
#define MQTT_TOPIC_VITALS "biosync/ESP32-HW-001/vitals"

// --- Hardware Pins & Control Buttons ---
#define SETUP_BUTTON_PIN 0 // BOOT button on standard ESP32 (GPIO 0)
#define SDA_PIN 21
#define SCL_PIN 22
#define I2C_CLOCK_SPEED 400000 // 400 kHz Fast-mode I2C

// --- Sampling Rates & Timers ---
#define TELEMETRY_PUBLISH_INTERVAL_MS 5000 // 5 Seconds Summary Publish
#define MAX30102_SAMPLING_FREQ_HZ 100     // 100 Hz Continuous Sampling
#define ACCEL_GRAVITY_EARTH 9.80665f      // Earth standard gravity (m/s^2)

#endif // CONFIG_H
