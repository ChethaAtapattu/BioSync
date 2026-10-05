# Local Mosquitto MQTT Broker Setup & Network Configuration Guide

This guide details installing, configuring, and verifying the **Eclipse Mosquitto MQTT Broker** on your development laptop to ingest physical ESP32 hardware telemetry.

---

## 1. Mosquitto Installation

### macOS (via Homebrew)
```bash
brew install mosquitto
```

### Linux (Ubuntu / Debian)
```bash
sudo apt update
sudo apt install -y mosquitto mosquitto-clients
```

---

## 2. LAN Listener Configuration

By default, Mosquitto 2.0+ binds strictly to `127.0.0.1` (localhost) and rejects external connections from ESP32 micro-controllers on your LAN.

### Config File Location
- **macOS (Homebrew)**: `/usr/local/etc/mosquitto/mosquitto.conf` (or `/opt/homebrew/etc/mosquitto/mosquitto.conf` on Apple Silicon)
- **Linux**: `/etc/mosquitto/mosquitto.conf` (or `/etc/mosquitto/conf.d/local.conf`)

### Configuration Lines Required
Open or edit the config file and add these two directives:

```ini
# Listen on port 1883 across all network interfaces (0.0.0.0)
listener 1883 0.0.0.0

# Allow unauthenticated local connections from ESP32
allow_anonymous true
```

### Starting the Broker

```bash
# macOS (Homebrew service)
brew services restart mosquitto

# Linux (systemd service)
sudo systemctl restart mosquitto
```

---

## 3. Finding Laptop LAN IP Address

Your ESP32 micro-controller must connect to your laptop's local IP address on port 1883.

### macOS Command
```bash
ipconfig getifaddr en0
# Example output: 192.168.1.100
```

### Linux Command
```bash
hostname -I | awk '{print $1}'
```

Set this IP address in `firmware/BioSync/config.h`:
```cpp
#define MQTT_BROKER_HOST "192.168.1.100" // Replace with your laptop IP
```

---

## 4. Firewall Setup

Ensure your laptop's firewall allows inbound TCP traffic on port `1883`.

### macOS Application Firewall
1. Open **System Settings -> Network -> Firewall**.
2. Click **Options...** and ensure Mosquitto is allowed for incoming connections.
3. Alternatively via terminal:
   ```bash
   sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /opt/homebrew/opt/mosquitto/sbin/mosquitto
   sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp /opt/homebrew/opt/mosquitto/sbin/mosquitto
   ```

### Linux (ufw)
```bash
sudo ufw allow 1883/tcp
sudo ufw reload
```

---

## 5. Verification & Testing Tools

### Test 1: Subscribe to Telemetry Stream
In a terminal window on your laptop, subscribe to the `biosync/+/vitals` topic:

```bash
mosquitto_sub -h localhost -t "biosync/+/vitals" -v
```

### Test 2: Publish Simulated Payload via MQTT CLI
In a second terminal window, publish a test contract payload:

```bash
mosquitto_pub -h localhost -t "biosync/ESP32-HW-001/vitals" -m '{
  "deviceId": "ESP32-HW-001",
  "sequence": 1,
  "uptimeMs": 10000,
  "bootId": "BOOT-CLI-01",
  "source": "hardware",
  "hrBpm": 72.0,
  "pulseRmssdMs": 48.0,
  "motion": 0.04,
  "quality": "good"
}'
```

If the setup is correct, `mosquitto_sub` will print the message, and the BioSync backend will receive and broadcast the vitals to the dashboard!
