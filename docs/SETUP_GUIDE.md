# BioSync Planner — Complete System Setup & Startup Guide

This document outlines environment requirements, installation steps, and commands to run the full BioSync Planner stack.

---

## 1. Architecture & Execution Strategy

- **React Frontend**: Independent application in `/frontend` (`http://localhost:3000`).
- **Node.js Backend**: Independent application in `/backend` (`http://localhost:3001`).
- **ESP32 Firmware**: Arduino IDE sketch located at `firmware/BioSync/BioSync.ino`.
- **Implementation Strategy**:
  1. **Build & Verify Simulated Dashboard First**: Run backend + frontend with the built-in simulator engine (`rested`, `elevated_pulse`, `prolonged_session`, `motion_artifact`, `no_finger_contact`, `disconnected`).
  2. **Connect Physical Hardware**: Flash the ESP32 via Arduino IDE and stream hardware telemetry over MQTT to the backend.

---

## 2. Environment Configuration

Copy `backend/.env.example` to `backend/.env`:

```bash
cp backend/.env.example backend/.env
```

Environment variables supported in `backend/.env`:
- `PORT`: Node server port (Default: `3001`).
- `MQTT_BROKER_URL`: Broker URL (Default: `mqtt://localhost:1883`).
- `ANTHROPIC_API_KEY`: *(Optional)* Anthropic key for AI schedule explanations.
- `ANTHROPIC_MODEL`: Anthropic model (Default: `claude-3-5-sonnet-20241022`).
- `CLAUDE_TIMEOUT_MS`: API timeout in ms (Default: `5000`).

---

## 3. Quick Start Commands (Web Application)

From the root project directory:

```bash
# 1. Install all monorepo dependencies
npm install

# 2. Build shared TypeScript package
npm run build:shared

# 3. Start backend server and frontend development server concurrently
npm start
```

- **Frontend Dashboard**: `http://localhost:3000`
- **Backend API & Socket.io Server**: `http://localhost:3001`

---

## 4. Running Automated Verification Tests

To execute the automated unit test suite covering scoring heuristics, task ranking, deadline urgency, 10-minute alert timers, and sensor contract ingestion:

```bash
npm test
```

---

## 5. ESP32 Firmware Setup via Arduino IDE

### A. Arduino IDE Board Package Installation
1. Open **Arduino IDE** (v2.0+ recommended).
2. Go to **File -> Preferences** (or **Arduino IDE -> Settings** on macOS).
3. In **Additional Boards Manager URLs**, add:
   `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`
4. Open **Tools -> Board -> Boards Manager...**, search for **esp32** by Espressif Systems, and click **Install**.
5. Select Board: **Tools -> Board -> esp32 -> ESP32 Dev Module**.

### B. Required Arduino IDE Libraries
Open **Tools -> Manage Libraries...** (Ctrl+Shift+I / Cmd+Shift+I) and install:
1. **PubSubClient** by Nick O'Leary
2. **ArduinoJson** by Benoit Blanchon (Version 6.x)
3. **SparkFun MAX3010x Pulse and Proximity Sensor Library** by SparkFun Electronics
4. **Adafruit MPU6050** by Adafruit
5. **Adafruit Unified Sensor** by Adafruit

### C. Sketch Configuration & Upload Instructions
1. Open the sketch: **File -> Open...** -> select `firmware/BioSync/BioSync.ino`.
2. Edit `firmware/BioSync/config.h` to set your Wi-Fi credentials and local Mosquitto MQTT broker IP:
   ```cpp
   #define WIFI_SSID "YOUR_WIFI_SSID"
   #define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"
   #define MQTT_BROKER_HOST "192.168.1.100" // Local Mosquitto IP
   ```
3. Connect your **ESP32-WROOM-32** board via USB data cable.
4. Select Port: **Tools -> Port -> /dev/cu.usbserial-...** (or COM port on Windows).
5. Click **Upload** (Right Arrow button).

### D. Serial Monitor Debugging Steps
1. Open **Tools -> Serial Monitor** and set baud rate to **115200 baud**.
2. Press the **EN / RST** button on the ESP32 board.
3. Verify initialization output:
   ```text
   =============================================
   BioSync Hardware Firmware — Arduino IDE Sketch
   Target: ESP32-WROOM-32 (MAX30102 + MPU6050)
   =============================================
   [OK] MAX30102 initialized successfully!
   [OK] MPU6050 initialized successfully!
   [WiFi] Connected successfully!
   [WiFi] ESP32 IP Address: 192.168.1.120
   [MQTT] Connecting to broker 192.168.1.100:1883... CONNECTED!
   [MQTT PUBLISH] {"deviceId":"ESP32-HW-001","sequence":1,"uptimeMs":5012,"source":"hardware","hrBpm":72.0,"pulseRmssdMs":48.5,"motion":0.04,"quality":"good"}
   ```
