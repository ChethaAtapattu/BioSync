# BioSync Planner — Tester Setup and Demonstration Guide

This guide runs the physical ESP32 prototype with a local MQTT broker and dashboard. Allow time for first-time software installation. For a prepared demonstration, start at section 2.

## 1. What the tester needs

- The assembled ESP32-WROOM-32, MAX30102 and MPU6050 prototype with soldered headers.
- A working USB data cable; a USB-C to USB-A data adapter if required.
- A computer with Node.js/npm and Mosquitto. The Mac instructions below use Homebrew.
- A normal 2.4 GHz Wi-Fi network shared by the computer and ESP32. Guest networks, captive-portal university Wi-Fi and networks with client isolation may prevent communication.
- The BioSync repository. Arduino IDE is needed only to install or change firmware, not for normal evaluator setup.

The prototype uses finger contact. It is not a completed wrist-worn device. Its score is an experimental heuristic, not a validated measurement of concentration or a medical result.

### Wiring reference

Disconnect USB before changing wires. Both sensors share the bus in parallel; the MPU does not relay MAX30102 data.

| ESP32 | MPU6050 | MAX30102 MH-ET LIVE breakout |
|---|---|---|
| 3V3 | VCC | VIN |
| GND | GND | GND beside SCL |
| GPIO21 / D21 | SDA | SDA |
| GPIO22 / D22 | SCL | SCL |

Leave the unused sensor pins disconnected. Do not use MPU XDA/XCL. Breadboard connections must occupy the same numbered row on the same side of the centre gap. Confirm the MAX breakout supply and 3V3/1V8 selector configuration; do not bridge selector pads or substitute 5 V by guessing.

## 2. Start the MQTT broker

On macOS, install once:

```bash
brew install mosquitto
```

If Homebrew is unavailable, install it from https://brew.sh first. Windows/Linux users can install Mosquitto from https://mosquitto.org/download/ and use the same broker configuration below.

Create a dedicated local demonstration configuration:

```bash
cat > ~/biosync-mosquitto.conf <<'CONF'
listener 1883
allow_anonymous true
CONF
```

Run in Terminal A on an Apple Silicon Mac:

```bash
/opt/homebrew/opt/mosquitto/sbin/mosquitto -c ~/biosync-mosquitto.conf -v
```

On other installations, use the installed executable, for example:

```bash
mosquitto -c /path/to/biosync-mosquitto.conf -v
```

Leave this terminal open. The broker keeps running; scrolling messages do not mean installation is unfinished. Do not also start a second broker on port 1883. If it reports “Address already in use”, identify the existing broker before starting another.

This demonstration configuration permits unauthenticated MQTT clients on reachable interfaces. Use it only on a trusted local demonstration network, do not expose/forward port 1883 to the internet, and stop it when finished. An authenticated deployment needs matching credential support in the device and backend.

## 3. Start the web application

In Terminal B, change to the repository root (the folder containing the root package.json):

```bash
cd /path/to/BioSync
npm install
npm run build:shared
npm start
```

The configured addresses are:

| Service | Address |
|---|---|
| Dashboard | http://localhost:3000 |
| Backend / Socket.io | http://localhost:3001 |
| Backend MQTT connection | mqtt://localhost:1883 |

Use the frontend URL printed by Vite if port 3000 is occupied. Keep this terminal open too.

The default backend settings work when Mosquitto runs on the same computer. For custom settings, copy backend/.env.example to backend/.env if that file does not already exist, and set MQTT_BROKER_URL=mqtt://localhost:1883. The standard npm start command launches the backend through its package script, which runs in the backend directory. Check any existing environment configuration for broker URL overrides. SQLite is the MVP database; MongoDB and an Anthropic API key are not required for this demonstration.

## 4. Configure the ESP32 without editing code

### Find the computer's address

On macOS, open System Settings → Wi-Fi → Details → TCP/IP and note the computer's IPv4 address. The computer must be on the same network as the ESP32.

Enter the **computer's address** as the MQTT host, not the ESP32's address, router address, localhost or the example 192.168.1.100. The demonstrated computer address was 192.168.8.116; this is an example only and may change.

### First-time setup or a different evaluator network

1. Power the already-programmed ESP32 through USB.
2. On first boot without stored settings, its setup Wi-Fi should appear automatically.
3. To reopen setup on a configured device, hold **BOOT for three seconds while the firmware is already running**, then release. This clears saved Wi-Fi and MQTT settings. Do not hold BOOT while resetting/powering on: the classic ESP32 may enter flashing mode.
4. Connect a phone or laptop to **BioSync-Setup**. The repository's default setup password is **biosyncsetup**; use the project's changed password if one was set.
5. Stay connected despite “No internet”. Open **http://192.168.4.1** explicitly using HTTP.
6. Enter the actual 2.4 GHz Wi-Fi name (SSID), Wi-Fi password, computer's MQTT host address and port **1883**.
7. Click **Save & Connect**. A connection-reset page can occur because saving immediately reconnects Wi-Fi. Check serial status or reopen the portal to verify the saved result rather than assuming failure.
8. Reconnect the laptop to the normal Wi-Fi network.

The ESP32 saves settings across power cycles. On the same network, the evaluator normally only needs to power it and start the broker/application.

### Access after Wi-Fi connection

The ESP32 prints its current address in Serial Monitor:

```text
[WiFi] ESP32 Local IP Address: <device-IP>
```

Open **http://<device-IP>** from the same network to edit settings. The demonstrated address was 192.168.8.144; do not assume it stays fixed. The address 192.168.4.1 is for setup access-point mode.

When changing only the MQTT host, leave the Wi-Fi password field blank to retain the stored password. Never include passwords in screenshots or the submitted report. The portal uses HTTP; the setup AP has password protection but the shared default password is not a production security design.

## 5. Verify communication and sensor detection

Arduino Serial Monitor is optional for normal use, but useful for verification. Select the actual /dev/cu.usbserial… port (Mac) or COM port (Windows), and set **115200 baud**. debug-console and Bluetooth ports are not the ESP32 USB connection.

Look for:

```text
[OK] MAX30102 initialized successfully!
[OK] MPU6050 initialized successfully!
[WiFi] Connected successfully!
[MQTT] Connecting to broker <computer-IP>:1883... CONNECTED!
[MQTT PUBLISH SUCCESS] ...
```

The demonstration firmware was also given a temporary repeating diagnostic:

```text
[I2C CHECK] 0x57: DETECTED
[I2C CHECK] 0x68: DETECTED
```

These lines appear only if that diagnostic is included in the uploaded firmware. Address 0x57 is MAX30102; 0x68 is MPU6050. Detection confirms an I²C response, not measurement accuracy.

In the broker terminal, “Received PUBLISH from ESP32-HW-001” confirms receipt. “Sending PUBLISH” shows forwarding to a subscribed client. Keep the broker running and select **Hardware** in the dashboard. A live stream containing null values is communication success, not a successful pulse measurement.

## 6. Perform the physical demonstration

1. Put the sensor boards on a stable, nonconductive surface.
2. Select **Hardware** in the dashboard. Create tasks of different difficulties/deadlines if required; start a study session to demonstrate session timing.
3. Gently cover the MAX30102 optical window with the soft pad of an index fingertip. Do not use the MPU6050 as the contact sensor.
4. Rest the hand and keep contact steady without pressing hard for **60–90 seconds**. Firmware publishes summaries about every five seconds.
5. Verify that hrBpm and pulseRmssdMs become numeric and quality becomes good before interpreting the calculated score.
6. Save a dashboard screenshot and one actual MQTT payload. Do not substitute the simulator's readings for hardware evidence.

The system may withhold both pulse fields until its quality criteria are satisfied. Waiting longer is not a remedy for a sensor that is not detected or does not produce samples.

### Test record

Record observed outcomes; the following are expected behaviours, not prefilled successful results.

| Test | Physical action | Expected observation | Evidence to record |
|---|---|---|---|
| Detection | Power the wired prototype | Both sensors initialize/respond | Startup log or I²C diagnostic |
| Stable contact | Keep fingertip still for 60–90 seconds | Numeric pulse fields with good quality if signal criteria are met | Payload and dashboard screenshot |
| No contact | Remove finger and wait for updates | No-contact/invalid status; score unavailable | Payload after removal |
| Movement | Gently move MPU with steady finger contact; avoid pulling wires | Motion changes; sufficiently high motion gates score | Motion/quality payload |
| Stale data | Disconnect ESP32 power, leaving broker/app running | Hardware status becomes stale after approximately 15 seconds | Timestamped screenshot |
| Recovery | Restore power and finger contact | New boot ID, telemetry resumes and metrics warm up again | Recovery payload |
| Persistence | Power cycle on the same network | Stored settings reconnect without re-entering credentials | Wi-Fi/MQTT connection log |
| Task planning | Add tasks with distinct deadlines/difficulties | Ranking reflects valid context and deadline urgency | Task-list screenshot |

If the score is unavailable but the explanation still quotes an old numerical score, refresh recommendations and record the inconsistency if it persists. Do not report the old explanation as a current sensor measurement.

## 7. Troubleshooting

| Symptom | Next action |
|---|---|
| USB power LED on, no upload port | Check a known working data cable/adapter; power alone does not confirm data. Close competing serial tools. |
| Port disappears or “Device not configured” | Reseat or replace cable/adapter. With power disconnected, isolate the ESP32 from sensor wiring and retry. BOOT does not restore USB enumeration. |
| Upload stalls at “Connecting…” with a valid stable port | Hold BOOT until writing starts, then release. |
| Repeated reboot / xQueueSemaphoreTake assertion | Check that WebPortalManager::begin() calls server.begin() **after** startAPMode()/connectWiFi(). The demonstrated firmware required this startup-order correction. |
| Setup page will not load | In AP mode join BioSync-Setup first; in station mode use the current ESP32 IP. Use HTTP, and stay connected despite the no-internet warning. |
| Save page connection reset | Wait, reopen the root page without /save, and verify the stored host/current IP. |
| MQTT rc=-2 | Confirm the computer's actual IP, broker running on 1883 with a network listener, same network and firewall access. Do not disable the entire firewall. |
| 0x57 NOT DETECTED | Unplug power. Check MAX VIN/GND/SDA/SCL, breadboard continuity, jumpers and solder joints. Isolate MAX directly on the ESP32. Confirm the module selector before changing it. |
| 0x68 NOT DETECTED | Check MPU VCC/GND/SDA/SCL; an intentionally disconnected MPU is expected to be absent. |
| Detection alternates | Inspect/rework intermittent solder joints or replace jumpers with power off. Detection alone does not establish a short circuit. |
| warming_up indefinitely | Verify initialization and fresh samples first; confirm contact and inspect serial quality. MQTT success alone does not prove acquisition. |
| Dashboard does not reflect hardware | Select Hardware; check backend broker connection, topic and frontend connection. Confirm the payload source is hardware. |

During development, unstable USB communication, a portal startup crash, broker configuration and MAX header solder connections were investigated. Both I²C addresses were subsequently reported detected and the student reported a successful live demonstration. Include the actual captured measurements when presenting evaluation evidence; this guide does not independently certify accuracy.

## 8. Optional firmware installation and developer checks

Skip upload if the prototype already has the working firmware. Uploading is needed only after source changes or for a replacement board.

1. Install the ESP32 board package by Espressif Systems in Arduino IDE; select **ESP32 Dev Module**.
2. Install PubSubClient, ArduinoJson **6.x**, SparkFun MAX3010x Sensor Library, Adafruit MPU6050 and Adafruit Unified Sensor. Accept required Adafruit dependencies, including BusIO.
3. Open **firmware/BioSync/BioSync.ino** with all sibling files together, including web_portal.cpp/.h, config.h and both processor implementations.
4. Before uploading, confirm the web-server startup-order correction described above is present. The successful device had a local correction; do not overwrite it with an uncorrected repository copy.
5. Select the detected USB port, upload and confirm verification succeeds. Wi-Fi credentials are entered in the portal, not hardcoded.
6. Set Serial Monitor to 115200 baud. EN resets the program; BOOT has different setup/flashing roles. If pressing EN disrupts USB, capture startup after reconnecting instead.

The firmware's Wi-Fi setup and synchronous MQTT connection calls can interrupt acquisition. Comments describing all acquisition as nonblocking do not establish timing guarantees.

Software-only checks from the repository root:

```bash
npm test
npm run build
```

Record actual results. Automated software tests do not replace sensor, network or physical acceptance tests. Simulated mode can demonstrate application behaviour when hardware is unavailable, but must be labelled simulated.

## 9. Finish the demonstration

Save evidence first. Stop the application with Control+C in Terminal B and the broker with Control+C in Terminal A. Unplug ESP32 power before packing or rewiring. Keep stored Wi-Fi credentials private; clear them through the portal if the device is being handed to a different person.

References: repository source/configuration; observed development logs; Mosquitto listener guidance (https://mosquitto.org/documentation/migrating-to-2-0/); Homebrew Mosquitto formula (https://formulae.brew.sh/formula/mosquitto); Espressif Arduino documentation (https://docs.espressif.com/projects/arduino-esp32/en/latest/).
