# BioSync Hardware Wiring Diagram & Pinout Table

This document provides the hardware pinout and electrical wiring specification for connecting the **MAX30102** (Pulse Oximeter & Heart Rate Sensor) and **MPU6050** (6-DOF Motion Sensor) to the **ESP32-WROOM-32** micro-controller.

---

## 1. Pin Assignment Table

| Microcontroller (ESP32) | MAX30102 Pulse Sensor | MPU6050 Accel/Gyro | Description / Function |
| :--- | :--- | :--- | :--- |
| **3V3** | VIN / VCC | VCC | 3.3V Regulated Power Supply |
| **GND** | GND | GND | System Ground Reference |
| **GPIO 21** | SDA | SDA | I2C Data Line (Shared Bus) |
| **GPIO 22** | SCL | SCL | I2C Clock Line (Shared Bus) |
| **GPIO 19** *(Optional)* | INT | — | Active-Low Interrupt for MAX30102 |
| **GPIO 18** *(Optional)* | — | INT | Motion Interrupt for MPU6050 |

---

## 2. I2C Bus Specifications

- **Protocol**: Shared I2C Bus (Fast-Mode @ 400 kHz).
- **Bus Addresses**:
  - `0x57` — SparkFun MAX30102 / MAX30105 Pulse Sensor.
  - `0x68` — InvenSense MPU6050 Motion Sensor (AD0 connected to GND).
- **Pull-up Resistors**:
  - The internal ESP32 pull-ups are enabled in software (`Wire.begin()`).
  - If long jumper wires (>15 cm) are used, add external **4.7 kΩ pull-up resistors** between SDA to 3V3 and SCL to 3V3.

---

## 3. Sensor Placement & Signal Integrity Guidelines

1. **Finger Placement (MAX30102)**:
   - Place index finger lightly over the optical red/IR LEDs.
   - Do **not** press firmly; excessive arterial compression reduces pulsatile blood flow and degrades pulse RMSSD calculation.
2. **Motion Isolation (MPU6050)**:
   - Mount the MPU6050 rigidly to the same breadboard or finger clip enclosure as the MAX30102.
   - The motion pipeline normalizes vector magnitude after subtracting 1g ($9.80665 \text{ m/s}^2$) gravity to distinguish voluntary hand movement from optical sensor artifacting.

---

## 4. Hardware Verification & Troubleshooting

- **Check I2C Connectivity**:
  ```cpp
  Wire.begin(21, 22, 400000);
  // Scan addresses 0x57 and 0x68
  ```
- **Error Status Exposing**:
  - If IR reading $< 50,000$, firmware exposes `quality: "no_contact"`.
  - If motion $> 45\%$, firmware exposes `quality: "poor"`.
