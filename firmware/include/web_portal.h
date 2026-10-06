#ifndef WEB_PORTAL_H
#define WEB_PORTAL_H

#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include <Preferences.h>
#include <DNSServer.h>
#include "config.h"

struct BioSyncDeviceConfig {
    char wifiSsid[64];
    char wifiPass[64];
    char mqttHost[64];
    uint16_t mqttPort;
    bool configured;
};

class WebPortalManager {
public:
    WebPortalManager();
    void begin();
    
    // NVS Preferences
    bool loadConfig(BioSyncDeviceConfig &config);
    bool saveConfig(const BioSyncDeviceConfig &config);
    void clearConfig();
    
    // Portal & Network Management
    void startAPMode();
    void connectWiFi();
    void handleClient();
    
    // Status Accessors
    bool isApMode() const { return inApMode; }
    bool isConfigured() const { return currentConfig.configured; }
    const BioSyncDeviceConfig& getConfig() const { return currentConfig; }
    
    // Action to Reopen Setup
    void triggerReconfiguration();

private:
    BioSyncDeviceConfig currentConfig;
    WebServer server;
    DNSServer dnsServer;
    Preferences prefs;
    bool inApMode;
    uint32_t lastWifiAttemptMs;
    
    void setupRoutes();
    void handleRoot();
    void handleSave();
    void handleReset();
    void handleReboot();
    void handleNotFound();
    
    String buildHtmlPage(const String &noticeMessage = "");
};

extern WebPortalManager webPortal;

#endif // WEB_PORTAL_H
