#include "web_portal.h"

WebPortalManager webPortal;

WebPortalManager::WebPortalManager()
    : server(80), inApMode(false), lastWifiAttemptMs(0) {
    memset(&currentConfig, 0, sizeof(currentConfig));
    currentConfig.mqttPort = DEFAULT_MQTT_PORT;
    strncpy(currentConfig.mqttHost, DEFAULT_MQTT_HOST, sizeof(currentConfig.mqttHost) - 1);
}

void WebPortalManager::begin() {
    prefs.begin(PREFS_NAMESPACE, false);
    loadConfig(currentConfig);

    setupRoutes();
    server.begin();

    if (!currentConfig.configured || strlen(currentConfig.wifiSsid) == 0) {
        Serial.println("[NVS] No saved Wi-Fi configuration found. Starting Access Point mode...");
        startAPMode();
    } else {
        Serial.println("[NVS] Loaded stored settings from Preferences NVS:");
        Serial.print("  Wi-Fi SSID: "); Serial.println(currentConfig.wifiSsid);
        Serial.print("  MQTT Host:  "); Serial.print(currentConfig.mqttHost);
        Serial.print(":"); Serial.println(currentConfig.mqttPort);
        connectWiFi();
    }
}

bool WebPortalManager::loadConfig(BioSyncDeviceConfig &config) {
    config.configured = prefs.getBool("configured", false);
    String ssid = prefs.getString("wifi_ssid", "");
    String pass = prefs.getString("wifi_pass", "");
    String host = prefs.getString("mqtt_host", DEFAULT_MQTT_HOST);
    uint16_t port = prefs.getUShort("mqtt_port", DEFAULT_MQTT_PORT);

    strncpy(config.wifiSsid, ssid.c_str(), sizeof(config.wifiSsid) - 1);
    strncpy(config.wifiPass, pass.c_str(), sizeof(config.wifiPass) - 1);
    strncpy(config.mqttHost, host.c_str(), sizeof(config.mqttHost) - 1);
    config.mqttPort = port;

    return config.configured;
}

bool WebPortalManager::saveConfig(const BioSyncDeviceConfig &config) {
    prefs.putString("wifi_ssid", config.wifiSsid);
    prefs.putString("wifi_pass", config.wifiPass);
    prefs.putString("mqtt_host", config.mqttHost);
    prefs.putUShort("mqtt_port", config.mqttPort);
    prefs.putBool("configured", true);

    currentConfig = config;
    currentConfig.configured = true;

    Serial.println("[NVS] Successfully saved new Wi-Fi and MQTT settings to Preferences NVS!");
    return true;
}

void WebPortalManager::clearConfig() {
    prefs.clear();
    memset(&currentConfig, 0, sizeof(currentConfig));
    currentConfig.mqttPort = DEFAULT_MQTT_PORT;
    strncpy(currentConfig.mqttHost, DEFAULT_MQTT_HOST, sizeof(currentConfig.mqttHost) - 1);
    currentConfig.configured = false;
    Serial.println("[NVS] Erased stored Wi-Fi and MQTT settings from Preferences NVS.");
}

void WebPortalManager::startAPMode() {
    inApMode = true;
    WiFi.mode(WIFI_AP_STA);
    WiFi.softAP(AP_SSID, AP_PASSWORD);

    IPAddress apIp(192, 168, 4, 1);
    IPAddress netmask(255, 255, 255, 0);
    WiFi.softAPConfig(apIp, apIp, netmask);

    dnsServer.start(53, "*", apIp);

    Serial.println("\n==================================================");
    Serial.println("[SETUP PORTAL ACTIVE]");
    Serial.print("  Access Point SSID: "); Serial.println(AP_SSID);
    Serial.print("  WPA2 Password:     "); Serial.println(AP_PASSWORD);
    Serial.println("  Setup Web Page:    http://192.168.4.1");
    Serial.println("==================================================\n");
}

void WebPortalManager::connectWiFi() {
    inApMode = false;
    WiFi.mode(WIFI_STA);
    WiFi.begin(currentConfig.wifiSsid, currentConfig.wifiPass);
    lastWifiAttemptMs = millis();

    Serial.print("[WiFi] Connecting to network SSID: ");
    Serial.println(currentConfig.wifiSsid);

    uint8_t attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 15) {
        delay(200);
        Serial.print(".");
        attempts++;
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("\n[WiFi] Connected successfully!");
        Serial.print("[WiFi] ESP32 Local IP Address: ");
        Serial.println(WiFi.localIP());
    } else {
        Serial.println("\n[WiFi] Initial connection timeout. Non-blocking retry active in loop().");
    }
}

void WebPortalManager::triggerReconfiguration() {
    clearConfig();
    startAPMode();
}

void WebPortalManager::handleClient() {
    server.handleClient();

    if (inApMode) {
        dnsServer.processNextRequest();
    } else if (currentConfig.configured && WiFi.status() != WL_CONNECTED) {
        // Non-blocking WiFi reconnect attempt every 10 seconds
        uint32_t nowMs = millis();
        if (nowMs - lastWifiAttemptMs > 10000) {
            lastWifiAttemptMs = nowMs;
            Serial.print("[WiFi] Non-blocking reconnecting to ");
            Serial.println(currentConfig.wifiSsid);
            WiFi.begin(currentConfig.wifiSsid, currentConfig.wifiPass);
        }
    }
}

void WebPortalManager::setupRoutes() {
    server.on("/", [this]() { handleRoot(); });
    server.on("/save", HTTP_POST, [this]() { handleSave(); });
    server.on("/reset", HTTP_POST, [this]() { handleReset(); });
    server.on("/reboot", HTTP_POST, [this]() { handleReboot(); });
    server.onNotFound([this]() { handleNotFound(); });
}

void WebPortalManager::handleRoot() {
    String html = buildHtmlPage();
    server.send(200, "text/html", html);
}

void WebPortalManager::handleSave() {
    BioSyncDeviceConfig newConfig;
    memset(&newConfig, 0, sizeof(newConfig));

    String ssid = server.arg("wifiSsid");
    String pass = server.arg("wifiPass");
    String host = server.arg("mqttHost");
    String portStr = server.arg("mqttPort");

    ssid.trim();
    pass.trim();
    host.trim();
    portStr.trim();

    if (ssid.length() == 0) {
        server.send(400, "text/html", buildHtmlPage("Error: Wi-Fi SSID cannot be empty!"));
        return;
    }

    strncpy(newConfig.wifiSsid, ssid.c_str(), sizeof(newConfig.wifiSsid) - 1);

    // Retain existing password if field left empty
    if (pass.length() == 0 && strlen(currentConfig.wifiPass) > 0) {
        strncpy(newConfig.wifiPass, currentConfig.wifiPass, sizeof(newConfig.wifiPass) - 1);
    } else {
        strncpy(newConfig.wifiPass, pass.c_str(), sizeof(newConfig.wifiPass) - 1);
    }

    if (host.length() > 0) {
        strncpy(newConfig.mqttHost, host.c_str(), sizeof(newConfig.mqttHost) - 1);
    } else {
        strncpy(newConfig.mqttHost, DEFAULT_MQTT_HOST, sizeof(newConfig.mqttHost) - 1);
    }

    newConfig.mqttPort = portStr.length() > 0 ? (uint16_t)portStr.toInt() : DEFAULT_MQTT_PORT;
    newConfig.configured = true;

    saveConfig(newConfig);

    String successMsg = "Settings Saved Successfully! ESP32 is connecting to Wi-Fi network '";
    successMsg += newConfig.wifiSsid;
    successMsg += "'...";

    server.send(200, "text/html", buildHtmlPage(successMsg));

    connectWiFi();
}

void WebPortalManager::handleReset() {
    clearConfig();
    startAPMode();
    server.send(200, "text/html", buildHtmlPage("Configuration cleared! Access Point active at 'BioSync-Setup' (http://192.168.4.1)."));
}

void WebPortalManager::handleReboot() {
    server.send(200, "text/html", "<html><body style='font-family:sans-serif;padding:40px;text-align:center;'><h2>Rebooting ESP32...</h2><p>Please wait 10 seconds and reconnect.</p></body></html>");
    delay(500);
    ESP.restart();
}

void WebPortalManager::handleNotFound() {
    if (inApMode) {
        // Redirect captive portal requests to root /
        server.sendHeader("Location", "http://192.168.4.1/", true);
        server.send(302, "text/plain", "");
    } else {
        server.send(404, "text/plain", "404: Not Found");
    }
}

String WebPortalManager::buildHtmlPage(const String &noticeMessage) {
    String html = R"rawliteral(<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BioSync Setup Portal</title>
    <style>
        :root { --bg: #0f172a; --card: #1e293b; --accent: #3b82f6; --text: #f8fafc; --muted: #94a3b8; --border: #334155; --success: #22c55e; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: var(--bg); color: var(--text); margin: 0; padding: 20px; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
        .card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 28px; width: 100%; max-width: 440px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
        h1 { margin-top: 0; font-size: 1.5rem; text-align: center; color: #60a5fa; }
        .subtitle { text-align: center; color: var(--muted); font-size: 0.875rem; margin-bottom: 20px; }
        .status-box { background: #090d16; border-radius: 8px; padding: 14px; margin-bottom: 20px; font-size: 0.85rem; border: 1px solid var(--border); }
        .status-row { display: flex; justify-content: space-between; margin-bottom: 6px; }
        .status-row:last-child { margin-bottom: 0; }
        .label { color: var(--muted); }
        .val { font-weight: 600; }
        .badge { padding: 2px 8px; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; display: inline-block; }
        .badge-green { background: #14532d; color: #4ade80; }
        .badge-amber { background: #78350f; color: #fde047; }
        .badge-blue { background: #1e3a8a; color: #93c5fd; }
        .notice { background: #1e3a8a; color: #bfdbfe; padding: 10px 14px; border-radius: 8px; margin-bottom: 16px; font-size: 0.85rem; text-align: center; }
        .form-group { margin-bottom: 16px; }
        label { display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 6px; color: var(--muted); }
        input[type="text"], input[type="password"], input[type="number"] { width: 100%; padding: 10px 12px; border-radius: 6px; border: 1px solid var(--border); background: #0f172a; color: #fff; box-sizing: border-box; font-size: 0.95rem; }
        input:focus { outline: none; border-color: var(--accent); }
        .btn { width: 100%; padding: 12px; border-radius: 6px; border: none; font-weight: 600; font-size: 0.95rem; cursor: pointer; margin-top: 8px; transition: background 0.2s; }
        .btn-primary { background: #2563eb; color: #fff; }
        .btn-primary:hover { background: #1d4ed8; }
        .btn-danger { background: #991b1b; color: #fca5a5; margin-top: 12px; }
        .btn-danger:hover { background: #7f1d1d; }
        .btn-secondary { background: #334155; color: #cbd5e1; margin-top: 8px; }
        .footer-note { font-size: 0.75rem; color: var(--muted); text-align: center; margin-top: 20px; line-height: 1.4; }
    </style>
</head>
<body>
    <div class="card">
        <h1>BioSync Setup Portal</h1>
        <div class="subtitle">ESP32 Hardware & Telemetry Configuration</div>
)rawliteral";

    if (noticeMessage.length() > 0) {
        html += "<div class='notice'>" + noticeMessage + "</div>";
    }

    html += "<div class='status-box'>";
    html += "<div class='status-row'><span class='label'>Operating Mode:</span><span class='val'>";
    if (inApMode) {
        html += "<span class='badge badge-blue'>Access Point Mode</span>";
    } else {
        html += "<span class='badge badge-green'>Station Mode</span>";
    }
    html += "</span></div>";

    html += "<div class='status-row'><span class='label'>Wi-Fi Status:</span><span class='val'>";
    if (WiFi.status() == WL_CONNECTED) {
        html += "<span class='badge badge-green'>Connected (" + WiFi.localIP().toString() + ")</span>";
    } else if (inApMode) {
        html += "<span class='badge badge-blue'>AP Active (192.168.4.1)</span>";
    } else {
        html += "<span class='badge badge-amber'>Connecting / Offline</span>";
    }
    html += "</span></div>";

    html += "<div class='status-row'><span class='label'>Configured SSID:</span><span class='val'>";
    html += (strlen(currentConfig.wifiSsid) > 0 ? currentConfig.wifiSsid : "None");
    html += "</span></div>";

    html += "<div class='status-row'><span class='label'>MQTT Broker:</span><span class='val'>";
    html += String(currentConfig.mqttHost) + ":" + String(currentConfig.mqttPort);
    html += "</span></div>";
    html += "</div>";

    html += R"rawliteral(
        <form action="/save" method="POST">
            <div class="form-group">
                <label for="wifiSsid">Wi-Fi Network SSID</label>
                <input type="text" id="wifiSsid" name="wifiSsid" value=")rawliteral";
    html += String(currentConfig.wifiSsid);
    html += R"rawliteral(" placeholder="Your Wi-Fi SSID" required>
            </div>
            <div class="form-group">
                <label for="wifiPass">Wi-Fi Password</label>
                <input type="password" id="wifiPass" name="wifiPass" placeholder="Enter Wi-Fi password (leave blank to keep stored)">
            </div>
            <div class="form-group">
                <label for="mqttHost">MQTT Broker IP / Host</label>
                <input type="text" id="mqttHost" name="mqttHost" value=")rawliteral";
    html += String(currentConfig.mqttHost);
    html += R"rawliteral(" placeholder="e.g. 192.168.1.100" required>
            </div>
            <div class="form-group">
                <label for="mqttPort">MQTT Broker Port</label>
                <input type="number" id="mqttPort" name="mqttPort" value=")rawliteral";
    html += String(currentConfig.mqttPort);
    html += R"rawliteral(" required>
            </div>
            <button type="submit" class="btn btn-primary">Save & Connect</button>
        </form>

        <form action="/reset" method="POST" onsubmit="return confirm('Clear saved Wi-Fi and MQTT credentials and re-open setup AP?');">
            <button type="submit" class="btn btn-danger">Clear Stored Credentials</button>
        </form>

        <form action="/reboot" method="POST">
            <button type="submit" class="btn btn-secondary">Reboot ESP32</button>
        </form>

        <div class="footer-note">
            To re-open this setup portal later, hold the <b>BOOT button (GPIO 0)</b> at startup or type <b>'C'</b> in the Serial Monitor (115200 baud).
        </div>
    </div>
</body>
</html>)rawliteral";

    return html;
}
