# BioSync Hardware Shopping Checklist

This checklist contains all physical components required to construct the **BioSync Hardware Sensor Node** for student embedded-systems lab evaluations.

---

## Required Components Checklist

| Item Description | Qty | Target Model / Specs | Purpose | Est. Cost ($) |
| :--- | :---: | :--- | :--- | :---: |
| **ESP32 Development Board** | 1 | Classic ESP32-WROOM-32 (30-pin) | Micro-controller with Wi-Fi & Bluetooth | $4.50 |
| **Pulse Oximeter & HR Sensor** | 1 | MAX30102 / MAX30105 Breakout Module | Continuous optical HR & pulse interval sampling | $3.50 |
| **6-DOF Motion Sensor** | 1 | MPU6050 Accelerometer & Gyroscope | Real-time hand/arm activity & gravity removal | $2.00 |
| **Solderless Breadboard** | 1 | 400 or 830 tie-point breadboard | Prototype circuit assembly | $2.00 |
| **Jumper Wires** | 10 | Male-to-Female & Male-to-Male (20cm) | I2C & Power pin connections | $1.50 |
| **Micro-USB / USB-C Cable** | 1 | Data-capable USB cable | Firmware flashing & serial debug power | $2.00 |
| **4.7 kΩ Resistors** | 2 | 1/4W Metal Film Resistors | Optional I2C bus pull-ups | $0.20 |

---

## Hardware Tools Needed

- [x] Computer with PlatformIO / VS Code or Arduino IDE installed.
- [x] Micro-USB Data Cable (verify it supports data transmission, not power-only).
- [x] Optional: Mosquitto MQTT Broker running on local host or Raspberry Pi.
