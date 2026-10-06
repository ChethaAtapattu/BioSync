# BioSync ESP32 Firmware & Web Setup Portal Guide

Target Hardware: **ESP32-WROOM-32**  
Sensors: **MAX30102** (I2C 0x57) + **MPU6050** (I2C 0x68)  
Transport: **MQTT over Wi-Fi** (Topic: `biosync/ESP32-HW-001/vitals`)  

---

## Features

1. **No Hardcoded Credentials**: Wi-Fi SSID, Password, MQTT Broker IP, and Port are configured dynamically via a password-protected **Web Setup Portal**.
2. **Persistent Preferences NVS Storage**: Collected settings are saved to ESP32 Non-Volatile Storage (NVS) using `Preferences` and survive reboots.
3. **Password Security**: Connection status badges show network connectivity without displaying stored passwords.
4. **Reopen Setup Portal**:
   - **BOOT Button (GPIO 0)**: Hold for 3 seconds (or hold during boot) to clear settings and start AP mode.
   - **Serial Command**: Type `'C'`, `'config'`, or `'reset'` in the Serial Monitor (115200 baud).
   - **Web Portal Reset**: Click **Clear Stored Credentials** on `http://192.168.4.1`.
5. **Non-blocking Continuous Acquisition**: 100Hz MAX30102 pulse sampling and MPU6050 gravity removal run non-stop even during Wi-Fi reconnects or active AP setup mode.

---

## Evaluator Setup Procedure

1. **Upload Sketch**: Open `BioSync.ino` in Arduino IDE, select board `ESP32 Dev Module`, and click **Upload**.
2. **Connect to Access Point**: On first boot, connect your laptop or phone Wi-Fi to:
   - **SSID**: `BioSync-Setup`
   - **Password**: `biosyncsetup`
3. **Open Setup Page**: Navigate to `http://192.168.4.1` in your web browser.
4. **Enter Credentials**: Fill in your local Wi-Fi SSID, Wi-Fi Password, local Mosquitto Broker IP (e.g., `192.168.1.100`), and Port (`1883`).
5. **Click Save**: Click **Save & Connect**. The ESP32 saves the settings and connects to your Wi-Fi network.
