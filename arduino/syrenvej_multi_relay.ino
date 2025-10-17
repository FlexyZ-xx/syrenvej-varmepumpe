/*
 * Syrenvej6 Multi-Relay Controller
 * 
 * This sketch controls multiple relays based on commands from a cloud service.
 * All state is stored locally in EEPROM.
 * 
 * Hardware:
 * - ESP8266 or ESP32
 * - 4-channel relay module
 * 
 * Configuration:
 * - Update WIFI_SSID and WIFI_PASSWORD
 * - Update API_HOST with your Vercel deployment URL
 * - Update API_KEY with your generated key
 */

#include <ESP8266WiFi.h>  // For ESP8266. Use <WiFi.h> for ESP32
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>
#include <EEPROM.h>
#include <ArduinoJson.h>
#include <time.h>

// WiFi Configuration
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// API Configuration
const char* API_HOST = "https://syrenvej-varmepumpe.vercel.app";
const char* COMMAND_ENDPOINT = "/api/command.js";
const char* STATUS_ENDPOINT = "/api/status.js";
const char* API_KEY = "a3bad1660cef3fd1bb3e9573711dd36f3fa8c5a1dd61d1d0e3cb991e330b1fa4";

// Hardware Configuration - Multiple Relays
const int NUM_RELAYS = 4;
const int RELAY_PINS[NUM_RELAYS] = {D1, D2, D5, D6};  // GPIO5, GPIO4, GPIO14, GPIO12
const char* RELAY_NAMES[NUM_RELAYS] = {
    "Heat Pump",
    "Circulation Pump",
    "Spare 1",
    "Spare 2"
};

// Polling interval (milliseconds)
const unsigned long POLL_INTERVAL = 5000;
const unsigned long STATUS_REPORT_INTERVAL = 10000;

// EEPROM addresses
const int EEPROM_SIZE = 512;
const int ADDR_RELAY_STATES = 0;        // 4 bytes for relay states
const int ADDR_SCHEDULES_START = 10;    // Multiple schedules

// State structure
struct Schedule {
    bool active;
    int year;
    int month;
    int day;
    int hour;
    int minute;
    char action[4];  // "on" or "off"
    bool executed;
    int relayIndex;  // Which relay this schedule controls
};

bool relayStates[NUM_RELAYS] = {false, false, false, false};
Schedule schedules[NUM_RELAYS];  // One schedule per relay

unsigned long lastPoll = 0;
unsigned long lastStatusReport = 0;

WiFiClient wifiClient;
HTTPClient http;

// NTP Configuration
const char* NTP_SERVER = "pool.ntp.org";
const long GMT_OFFSET_SEC = 3600;
const int DAYLIGHT_OFFSET_SEC = 3600;

void setup() {
    Serial.begin(115200);
    Serial.println("\n\nSyrenvej6 Multi-Relay Controller");
    Serial.println("==================================");
    
    // Initialize hardware
    for (int i = 0; i < NUM_RELAYS; i++) {
        pinMode(RELAY_PINS[i], OUTPUT);
        digitalWrite(RELAY_PINS[i], LOW);
    }
    
    // Initialize EEPROM
    EEPROM.begin(EEPROM_SIZE);
    
    // Load state from EEPROM
    loadState();
    
    // Connect to WiFi
    connectWiFi();
    
    // Initialize time
    configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, NTP_SERVER);
    Serial.println("Waiting for time sync...");
    while (time(nullptr) < 100000) {
        delay(100);
    }
    Serial.println("Time synchronized!");
    
    // Apply loaded relay states
    for (int i = 0; i < NUM_RELAYS; i++) {
        setRelay(i, relayStates[i]);
    }
    
    Serial.println("Setup complete. Starting main loop...\n");
}

void loop() {
    unsigned long now = millis();
    
    // Check WiFi connection
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("WiFi disconnected. Reconnecting...");
        connectWiFi();
    }
    
    // Poll for commands
    if (now - lastPoll >= POLL_INTERVAL) {
        lastPoll = now;
        pollForCommands();
    }
    
    // Report status
    if (now - lastStatusReport >= STATUS_REPORT_INTERVAL) {
        lastStatusReport = now;
        reportStatus();
    }
    
    // Check all schedules
    checkSchedules();
    
    delay(100);
}

void connectWiFi() {
    Serial.print("Connecting to WiFi: ");
    Serial.println(WIFI_SSID);
    
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 30) {
        delay(500);
        Serial.print(".");
        attempts++;
    }
    
    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("\nWiFi connected!");
        Serial.print("IP address: ");
        Serial.println(WiFi.localIP());
    } else {
        Serial.println("\nWiFi connection failed!");
    }
}

void pollForCommands() {
    if (WiFi.status() != WL_CONNECTED) return;
    
    String url = String(API_HOST) + COMMAND_ENDPOINT;
    
    http.begin(wifiClient, url);
    http.setTimeout(5000);
    http.addHeader("X-API-Key", API_KEY);
    
    int httpCode = http.GET();
    
    if (httpCode == HTTP_CODE_OK) {
        String payload = http.getString();
        
        DynamicJsonDocument doc(1024);
        DeserializationError error = deserializeJson(doc, payload);
        
        if (!error) {
            const char* type = doc["type"];
            
            if (strcmp(type, "manual") == 0) {
                const char* action = doc["action"];
                int relayIndex = doc["relayIndex"] | 0;  // Default to relay 0
                
                Serial.print("Manual command received: ");
                Serial.print(RELAY_NAMES[relayIndex]);
                Serial.print(" -> ");
                Serial.println(action);
                
                bool newState = (strcmp(action, "on") == 0);
                setRelay(relayIndex, newState);
                saveRelayStates();
                
            } else if (strcmp(type, "schedule") == 0) {
                int relayIndex = doc["relayIndex"] | 0;
                Serial.print("Schedule command received for ");
                Serial.println(RELAY_NAMES[relayIndex]);
                
                schedules[relayIndex].active = true;
                schedules[relayIndex].year = doc["year"];
                schedules[relayIndex].month = doc["month"];
                schedules[relayIndex].day = doc["day"];
                schedules[relayIndex].hour = doc["hour"];
                schedules[relayIndex].minute = doc["minute"];
                strcpy(schedules[relayIndex].action, doc["action"]);
                schedules[relayIndex].executed = false;
                schedules[relayIndex].relayIndex = relayIndex;
                
                saveSchedules();
                printSchedule(relayIndex);
                
            } else if (strcmp(type, "clear_schedule") == 0) {
                int relayIndex = doc["relayIndex"] | 0;
                Serial.print("Clear schedule command for ");
                Serial.println(RELAY_NAMES[relayIndex]);
                schedules[relayIndex].active = false;
                saveSchedules();
            }
        }
    }
    
    http.end();
}

void reportStatus() {
    if (WiFi.status() != WL_CONNECTED) return;
    
    String url = String(API_HOST) + STATUS_ENDPOINT;
    
    DynamicJsonDocument doc(2048);
    
    // Report all relay states
    JsonArray relays = doc.createNestedArray("relays");
    for (int i = 0; i < NUM_RELAYS; i++) {
        JsonObject relay = relays.createNestedObject();
        relay["index"] = i;
        relay["name"] = RELAY_NAMES[i];
        relay["state"] = relayStates[i] ? "on" : "off";
        
        if (schedules[i].active) {
            JsonObject schedule = relay.createNestedObject("schedule");
            schedule["year"] = schedules[i].year;
            schedule["month"] = schedules[i].month;
            schedule["day"] = schedules[i].day;
            schedule["hour"] = schedules[i].hour;
            schedule["minute"] = schedules[i].minute;
            schedule["action"] = schedules[i].action;
            schedule["executed"] = schedules[i].executed;
        }
    }
    
    // Keep backward compatibility for single relay interface
    doc["relayState"] = relayStates[0] ? "on" : "off";
    if (schedules[0].active) {
        JsonObject schedule = doc.createNestedObject("schedule");
        schedule["year"] = schedules[0].year;
        schedule["month"] = schedules[0].month;
        schedule["day"] = schedules[0].day;
        schedule["hour"] = schedules[0].hour;
        schedule["minute"] = schedules[0].minute;
        schedule["action"] = schedules[0].action;
        schedule["executed"] = schedules[0].executed;
    } else {
        doc["schedule"] = nullptr;
    }
    
    String jsonString;
    serializeJson(doc, jsonString);
    
    http.begin(wifiClient, url);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-API-Key", API_KEY);
    
    int httpCode = http.POST(jsonString);
    
    if (httpCode == HTTP_CODE_OK) {
        Serial.println("Status reported successfully");
    } else {
        Serial.print("Failed to report status. HTTP code: ");
        Serial.println(httpCode);
    }
    
    http.end();
}

void checkSchedules() {
    time_t now = time(nullptr);
    struct tm* timeinfo = localtime(&now);
    
    for (int i = 0; i < NUM_RELAYS; i++) {
        if (!schedules[i].active || schedules[i].executed) continue;
        
        // Check if scheduled time has arrived
        if (timeinfo->tm_year + 1900 == schedules[i].year &&
            timeinfo->tm_mon + 1 == schedules[i].month &&
            timeinfo->tm_mday == schedules[i].day &&
            timeinfo->tm_hour == schedules[i].hour &&
            timeinfo->tm_min == schedules[i].minute) {
            
            Serial.print("Executing scheduled action for ");
            Serial.println(RELAY_NAMES[i]);
            
            bool newState = (strcmp(schedules[i].action, "on") == 0);
            setRelay(i, newState);
            saveRelayStates();
            
            schedules[i].executed = true;
            saveSchedules();
            
            Serial.println("Schedule executed and marked as complete");
        }
    }
}

void setRelay(int index, bool state) {
    if (index < 0 || index >= NUM_RELAYS) return;
    
    relayStates[index] = state;
    digitalWrite(RELAY_PINS[index], state ? HIGH : LOW);
    
    Serial.print(RELAY_NAMES[index]);
    Serial.print(" turned ");
    Serial.println(state ? "ON" : "OFF");
}

void saveRelayStates() {
    for (int i = 0; i < NUM_RELAYS; i++) {
        EEPROM.write(ADDR_RELAY_STATES + i, relayStates[i] ? 1 : 0);
    }
    EEPROM.commit();
    Serial.println("Relay states saved to EEPROM");
}

void saveSchedules() {
    int addr = ADDR_SCHEDULES_START;
    for (int i = 0; i < NUM_RELAYS; i++) {
        EEPROM.put(addr, schedules[i]);
        addr += sizeof(Schedule);
    }
    EEPROM.commit();
    Serial.println("Schedules saved to EEPROM");
}

void loadState() {
    Serial.println("Loading state from EEPROM...");
    
    // Load relay states
    for (int i = 0; i < NUM_RELAYS; i++) {
        byte relayByte = EEPROM.read(ADDR_RELAY_STATES + i);
        relayStates[i] = (relayByte == 1);
    }
    
    // Load schedules
    int addr = ADDR_SCHEDULES_START;
    for (int i = 0; i < NUM_RELAYS; i++) {
        EEPROM.get(addr, schedules[i]);
        addr += sizeof(Schedule);
        
        // Validate loaded data
        if (schedules[i].year < 2020 || schedules[i].year > 2100) {
            schedules[i].active = false;
            schedules[i].executed = false;
            schedules[i].relayIndex = i;
        }
    }
    
    Serial.println("Loaded relay states:");
    for (int i = 0; i < NUM_RELAYS; i++) {
        Serial.print("  ");
        Serial.print(RELAY_NAMES[i]);
        Serial.print(": ");
        Serial.println(relayStates[i] ? "ON" : "OFF");
        
        if (schedules[i].active) {
            Serial.print("    Schedule: ");
            printSchedule(i);
        }
    }
}

void printSchedule(int index) {
    Serial.printf("  %s - Date: %04d-%02d-%02d %02d:%02d, Action: %s, Executed: %s\n",
                  RELAY_NAMES[index],
                  schedules[index].year,
                  schedules[index].month,
                  schedules[index].day,
                  schedules[index].hour,
                  schedules[index].minute,
                  schedules[index].action,
                  schedules[index].executed ? "Yes" : "No");
}

