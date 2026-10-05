# BioSync Planner — ESP32 Biometric Task & Break Recommendation MVP

> **Student Embedded-Systems Submission**  
> **Course / Lab Project**: Embedded Systems & Biosensing MVP Prototype

---

## Important Purpose & Academic Boundaries Notice

> [!IMPORTANT]
> **BioSync Planner** is a study task planner that uses experimental biometric indicators to suggest suitable study tasks and breaks.
> **DO NOT** claim to measure cognition, diagnose fatigue, or provide medical advice.

---

## 1. Stack & Architecture

- **Frontend Application**: Independent React 18 + Vite + TypeScript + Tailwind CSS application in `/frontend`.
- **Backend Application**: Independent Node.js + Express + TypeScript + Socket.io + SQLite3 (`biosync.db`) application in `/backend`.
- **Storage Layer**: SQLite for local single-user MVP, implemented using a modular repository pattern (`ITaskRepository`, `ISessionRepository`, `IVitalsRepository`) so storage remains easily replaceable if MongoDB or PostgreSQL is required later.
- **Transport Layer**: MQTT over local Mosquitto broker (Topic: `biosync/{deviceId}/vitals`).
- **Hardware Node**: Classic ESP32-WROOM-32 micro-controller, MAX30102 pulse oximeter/heart-rate sensor, MPU6050 6-DOF accelerometer/gyroscope.
- **ESP32 Firmware**: Arduino IDE C++ Sketch located at `firmware/BioSync/BioSync.ino`.

---

## 2. Directory Structure

```
BioSync/
├── frontend/                 # Independent React + Vite + TS Dashboard
├── backend/                  # Independent Node.js + Express + TS + Socket.io + SQLite + MQTT
├── shared/                   # Shared TS contracts, scoring formulas, task planner & alerts
├── firmware/
│   └── BioSync/              # Arduino IDE ESP32 Firmware Sketch
│       ├── BioSync.ino       # Main Arduino sketch file (100Hz sampling, 60s RMSSD, gravity removal)
│       ├── config.h          # Wi-Fi credentials, MQTT broker IP & pin definitions
│       ├── pulse_processor.h # MAX30102 signal processing & peak detection header (240 samples buffer)
│       ├── pulse_processor.cpp
│       ├── motion_processor.h# MPU6050 accelerometer gravity removal header
│       └── motion_processor.cpp
├── tests/                    # Automated Vitest test suite (fake clock, scoring, ranking, integration)
│   ├── scoring.test.ts       # Test score boundaries, null inputs, motion gating, stale data
│   ├── planner.test.ts       # Test difficulty matching, overdue priority, bounded urgency
│   ├── alerts.test.ts        # Test 10-consecutive-minute low score rule & invalid data interruption
│   ├── ingestion.test.ts     # Test sensor contract validation, deduplication, timestamping
│   └── hardware_integration.test.ts # Test hardware selection, source switching, bootId reboots
├── docs/
│   ├── WIRING.md             # Hardware pinout table & I2C bus configuration
│   ├── SHOPPING_CHECKLIST.md # Lab component purchasing checklist
│   ├── DEMO_SCRIPT.md        # 3-minute evaluator demonstration guide
│   ├── SETUP_GUIDE.md       # Arduino IDE setup, board packages, libraries, & execution guide
│   └── MOSQUITTO_SETUP.md    # Local Mosquitto MQTT broker LAN listener & firewall guide
├── .env.example              # Environment variables template
└── README.md                 # Project documentation & status report
```

---

## 3. Data Contract Specification

All sensor readings (whether from hardware ESP32 over MQTT or from the repeatable simulator engine) pass through the **exact same processing pipeline** using this JSON data contract:

```json
{
  "deviceId": "ESP32-HW-001",
  "sequence": 142,
  "uptimeMs": 450000,
  "bootId": "BOOT-A1B2C3D4-E5F67890",
  "source": "hardware",
  "hrBpm": 72.0,
  "pulseRmssdMs": 48.5,
  "motion": 0.04,
  "quality": "good"
}
```

- **`bootId`**: Unique identifier generated on each ESP32 boot (`esp_random()`). Used to distinguish valid device reboots from duplicate/out-of-order sequence packets.
- **`motion`**: Normalized to `0.0` – `1.0`. Estimated after subtracting gravity ($9.80665 \text{ m/s}^2$) from accelerometer magnitude.
- **`quality`**: `"warming_up"` | `"good"` | `"poor"` | `"no_contact"`.
- **Backend Enriched Field**: Backend appends ISO timestamp `receivedAt`. ESP32 clock synchronization is **not** assumed.
- **Validation**: Rejects malformed JSON, rejects duplicate sequence numbers per `deviceId` within the same boot, and ignores any device-supplied `focusScore`.

---

## 4. Provisional Demo Scoring Heuristic & Planning Bands

Score formula (unvalidated demo assumptions):

$$\text{hrvNorm} = \text{clamp}\left(\frac{\text{pulseRmssdMs} - 8}{52}, 0, 1\right)$$

$$\text{hrNorm} = \text{clamp}\left(\frac{110 - \text{hrBpm}}{55}, 0, 1\right)$$

$$\text{base} = 100 \times (0.6 \cdot \text{hrvNorm} + 0.4 \cdot \text{hrNorm})$$

$$\text{penalty} = \min\left(20, \max(0, \text{sessionMinutes} - 90) \times 0.3\right)$$

$$\text{score} = \text{clamp}(\text{base} - \text{penalty}, 0, 100)$$

### Experimental Planning Bands

| Band | Focus Score Range | Task Difficulty Preference | UI Action / Display |
| :--- | :---: | :--- | :--- |
| **`HIGH`** | $\ge 70$ | Hard (4–5) > Medium (3) > Easy (1–2) | Green Badge; recommends technical focus |
| **`MEDIUM`** | $\ge 50$ | Medium (3) > Hard (4–5) / Easy (1–2) | Blue Badge; steady task progression |
| **`LOW`** | $\ge 35$ | Easy (1–2) > Medium (3) > Hard (4–5) | Amber Badge; light/easy task focus |
| **`BREAK_SUGGESTED`** | $< 35$ | Shows break alert card; retains all tasks | Rose Badge; break recommendation banner |
| **`UNAVAILABLE`** | `null` | Ranked by deadline urgency alone | Slate Badge; signal gated/stale/warming up |

- **Motion Gate**: Motion is a signal-quality gate ($>0.45$ or `quality !== 'good'` returns `score = null`), not a concentration reward.
- **Stale Telemetry**: State marked stale after 15 seconds without update from active source.

---

## 5. Arduino IDE Firmware & Hardware Setup

### Required Board Package & Libraries
- **Board Package**: Espressif ESP32 (`https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`), select board **ESP32 Dev Module**.
- **Required Libraries**:
  1. `PubSubClient` by Nick O'Leary (`mqttClient.setBufferSize(512)`)
  2. `ArduinoJson` by Benoit Blanchon (v6.21.4)
  3. `SparkFun MAX3010x Pulse and Proximity Sensor Library` (`setup(0x1F, 1, 2, 100, 411, 4096)`)
  4. `Adafruit MPU6050`
  5. `Adafruit Unified Sensor`

### Arduino IDE Sketch Path & Upload
- Open sketch at: `firmware/BioSync/BioSync.ino`.
- Configure `firmware/BioSync/config.h` with Wi-Fi SSID, Password, and local Mosquitto IP.
- Connect ESP32 via USB and click **Upload**.
- Monitor debug output via **Serial Monitor** at **115200 baud**.

---

## 6. Execution Strategy & Verification

1. **Build & Verify Simulated Dashboard First**: Run backend + frontend with the built-in simulator engine (`rested`, `elevated_pulse`, `prolonged_session`, `motion_artifact`, `no_finger_contact`, `disconnected`).
2. **Connect Physical Sensors**: Configure Mosquitto (see `docs/MOSQUITTO_SETUP.md`), flash ESP32 via Arduino IDE, and stream hardware telemetry over MQTT to the backend.

### Quick Start Commands

```bash
# 1. Install workspace dependencies
npm install

# 2. Build shared package
npm run build:shared

# 3. Launch Backend (Port 3001) & Frontend (Port 3000)
npm start

# 4. Run automated test suite (28/28 tests passing)
npm test
```
