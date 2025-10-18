/*
 * Syrenvej6 Varmepumpe Controller
 * 
 * This sketch controls a relay based on commands from a cloud service.
 * All state is stored locally in EEPROM.
 * 
 * Hardware:
 * - ESP32
 * - Relay module connected to I2C address 0x30
 * 
 * Configuration:
 * - Update WIFI_SSID and WIFI_PASSWORD
 * - All other settings are pre-configured for production
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <EEPROM.h>
#include <ArduinoJson.h>
#include <time.h>
#include <Relay-SOLDERED.h>

// WiFi Configuration
const char* WIFI_SSID = "dezign";
const char* WIFI_PASSWORD = "torvelink";

// API Configuration
const char* API_HOST = "https://syrenvej-varmepumpe.vercel.app";
const char* COMMAND_ENDPOINT = "/api/command.js";
const char* STATUS_ENDPOINT = "/api/status.js";
const char* API_KEY = "a3bad1660cef3fd1bb3e9573711dd36f3fa8c5a1dd61d1d0e3cb991e330b1fa4";


// Relay Configuration
CH_Relay Relay;

// Polling interval (milliseconds)
const unsigned long POLL_INTERVAL = 3000;  // Poll every 3 seconds
const unsigned long STATUS_REPORT_INTERVAL = 5000;  // Report status every 5 seconds

// EEPROM addresses
const int EEPROM_SIZE = 512;
const int ADDR_RELAY_STATE = 0;
const int ADDR_SCHEDULE_START = 10;

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
};

bool relayState = false;
Schedule currentSchedule;

unsigned long lastPoll = 0;
unsigned long lastStatusReport = 0;
int consecutiveHttpErrors = 0;

HTTPClient http;

// NTP Configuration
const char* NTP_SERVER = "pool.ntp.org";
const long GMT_OFFSET_SEC = 3600;  // Adjust for your timezone (1 hour = 3600 seconds)
const int DAYLIGHT_OFFSET_SEC = 3600;  // Adjust for daylight saving

void setup() {
    Serial.begin(115200);
    Serial.println("\n\nSyrenvej6 Varmepumpe Controller");
    Serial.println("================================");
    
    //init relay
    Relay.begin(0x30);

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
    
    // Apply loaded relay state
    setRelay(relayState);
    
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
    
    // Check if scheduled action needs to be executed
    checkSchedule();
    
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
    
    http.begin(url);
    http.setTimeout(5000);
    http.addHeader("X-API-Key", API_KEY);
    
    int httpCode = http.GET();
    
    if (httpCode == HTTP_CODE_OK) {
        consecutiveHttpErrors = 0; // Reset error counter on success
        String payload = http.getString();
        
        DynamicJsonDocument doc(1024);
        DeserializationError error = deserializeJson(doc, payload);
        
        if (!error) {
            const char* type = doc["type"];
            
            if (strcmp(type, "manual") == 0) {
                const char* action = doc["action"];
                Serial.print("Manual command received: ");
                Serial.println(action);
                
                bool newState = (strcmp(action, "on") == 0);
                setRelay(newState);
                saveRelayState();
                
                // Send immediate heartbeat after relay change
                reportStatus();
                
            } else if (strcmp(type, "schedule") == 0) {
                Serial.println("Schedule command received");
                
                currentSchedule.active = true;
                currentSchedule.year = doc["year"];
                currentSchedule.month = doc["month"];
                currentSchedule.day = doc["day"];
                currentSchedule.hour = doc["hour"];
                currentSchedule.minute = doc["minute"];
                strcpy(currentSchedule.action, doc["action"]);
                currentSchedule.executed = false;
                
                saveSchedule();
                printSchedule();
                
                // Send immediate heartbeat after schedule change
                reportStatus();
                
            } else if (strcmp(type, "clear_schedule") == 0) {
                Serial.println("Clear schedule command received");
                currentSchedule.active = false;
                saveSchedule();
                
                // Send immediate heartbeat after clearing schedule
                reportStatus();
            }
        }
    } else if (httpCode < 0) {
        // Negative HTTP codes indicate connection issues
        consecutiveHttpErrors++;
        Serial.print("HTTP error: ");
        Serial.println(httpCode);
        
        // If we get multiple HTTP errors, force WiFi reconnection
        if (consecutiveHttpErrors >= 3) {
            Serial.println("Multiple HTTP errors detected. Reconnecting WiFi...");
            WiFi.disconnect();
            delay(1000);
            connectWiFi();
            consecutiveHttpErrors = 0;
        }
    }
    
    http.end();
}

void reportStatus() {
    if (WiFi.status() != WL_CONNECTED) return;
    
    String url = String(API_HOST) + STATUS_ENDPOINT;
    
    DynamicJsonDocument doc(1024);
    doc["relayState"] = relayState ? "on" : "off";
    
    if (currentSchedule.active) {
        JsonObject schedule = doc.createNestedObject("schedule");
        schedule["year"] = currentSchedule.year;
        schedule["month"] = currentSchedule.month;
        schedule["day"] = currentSchedule.day;
        schedule["hour"] = currentSchedule.hour;
        schedule["minute"] = currentSchedule.minute;
        schedule["action"] = currentSchedule.action;
        schedule["executed"] = currentSchedule.executed;
    } else {
        doc["schedule"] = nullptr;
    }
    
    String jsonString;
    serializeJson(doc, jsonString);
    
    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-API-Key", API_KEY);
    
    int httpCode = http.POST(jsonString);
    
    if (httpCode == HTTP_CODE_OK) {
        Serial.println("Status reported successfully");
        consecutiveHttpErrors = 0; // Reset error counter on success
    } else {
        Serial.print("Failed to report status. HTTP code: ");
        Serial.println(httpCode);
        consecutiveHttpErrors++;
        
        // If we get multiple HTTP errors, force WiFi reconnection
        if (consecutiveHttpErrors >= 3) {
            Serial.println("Multiple HTTP errors detected. Reconnecting WiFi...");
            WiFi.disconnect();
            delay(1000);
            connectWiFi();
            consecutiveHttpErrors = 0;
        }
    }
    
    http.end();
}

void checkSchedule() {
    if (!currentSchedule.active || currentSchedule.executed) return;
    
    time_t now = time(nullptr);
    struct tm* timeinfo = localtime(&now);
    
    // Check if scheduled time has arrived
    if (timeinfo->tm_year + 1900 == currentSchedule.year &&
        timeinfo->tm_mon + 1 == currentSchedule.month &&
        timeinfo->tm_mday == currentSchedule.day &&
        timeinfo->tm_hour == currentSchedule.hour &&
        timeinfo->tm_min == currentSchedule.minute) {
        
        Serial.println("Executing scheduled action!");
        
        bool newState = (strcmp(currentSchedule.action, "on") == 0);
        setRelay(newState);
        saveRelayState();
        
        // Clear schedule after execution
        currentSchedule.active = false;
        currentSchedule.executed = false;
        saveSchedule();
        
        // Send immediate heartbeat after scheduled execution
        reportStatus();
        
        Serial.println("Schedule executed and cleared");
    }
}

void setRelay(bool state) {
    relayState = state;
    Relay.relayControl(0, relayState ? HIGH : LOW); // Channel 0 (0-based indexing)
    Serial.print("Relay turned ");
    Serial.println(state ? "ON" : "OFF");
}

void saveRelayState() {
    EEPROM.write(ADDR_RELAY_STATE, relayState ? 1 : 0);
    EEPROM.commit();
    Serial.println("Relay state saved to EEPROM");
}

void saveSchedule() {
    EEPROM.put(ADDR_SCHEDULE_START, currentSchedule);
    EEPROM.commit();
    Serial.println("Schedule saved to EEPROM");
}

void loadState() {
    Serial.println("Loading state from EEPROM...");
    
    // Load relay state
    byte relayByte = EEPROM.read(ADDR_RELAY_STATE);
    relayState = (relayByte == 1);
    
    // Load schedule
    EEPROM.get(ADDR_SCHEDULE_START, currentSchedule);
    
    // Validate loaded data
    if (currentSchedule.year < 2020 || currentSchedule.year > 2100) {
        Serial.println("Invalid schedule data, initializing...");
        currentSchedule.active = false;
        currentSchedule.executed = false;
        saveSchedule();
    }
    
    Serial.print("Loaded relay state: ");
    Serial.println(relayState ? "ON" : "OFF");
    
    if (currentSchedule.active) {
        Serial.println("Loaded schedule:");
        printSchedule();
    } else {
        Serial.println("No active schedule");
    }
}

void printSchedule() {
    Serial.printf("  Date: %04d-%02d-%02d %02d:%02d\n",
                  currentSchedule.year,
                  currentSchedule.month,
                  currentSchedule.day,
                  currentSchedule.hour,
                  currentSchedule.minute);
    Serial.printf("  Action: %s\n", currentSchedule.action);
    Serial.printf("  Executed: %s\n", currentSchedule.executed ? "Yes" : "No");
}

