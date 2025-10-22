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
 * - Choose LED type: RGB_LED or STATIC_LED
 * - All other settings are pre-configured for production
 * 
 * LED Status:
 * RGB_LED (WS2812):
 *   - PURPLE (solid): Starting up
 *   - YELLOW (solid): WiFi connected, waiting for time sync
 *   - GREEN (blinking): Normal operation - loop is running
 *   - RED (solid): Error/retry state - WiFi or HTTP errors
 * 
 * STATIC_LED (Built-in LED):
 *   - BLINKING FAST (100ms): Starting up / Error/retry state
 *   - BLINKING SLOW (1000ms): Normal operation
 */

// ============================================
// LED Type Configuration - Choose one:
// ============================================
#define RGB_LED      // Comment this out to use STATIC_LED instead
// #define STATIC_LED   // Uncomment this to use built-in LED

#include <WiFi.h>
#include <HTTPClient.h>
#include <EEPROM.h>
#include <ArduinoJson.h>
#include <time.h>
#include <Relay-SOLDERED.h>
#include <esp_task_wdt.h>  // Watchdog timer

// Include WS2812 library only for RGB_LED
#ifdef RGB_LED
#include <WS2812-SOLDERED.h>
#endif

// WiFi Configuration
const char* WIFI_SSID = "dezign";
const char* WIFI_PASSWORD = "torvelink";

// API Configuration
const char* API_HOST = "https://syrenvej-varmepumpe.vercel.app";
const char* COMMAND_ENDPOINT = "/api/command.js";
const char* STATUS_ENDPOINT = "/api/status.js";
const char* API_KEY = "a3bad1660cef3fd1bb3e9573711dd36f3fa8c5a1dd61d1d0e3cb991e330b1fa4";

// LED Configuration
#ifdef RGB_LED
WS2812 pixels(1, LEDWS_BUILTIN);
#endif

// Relay Configuration
CH_Relay Relay;

// Polling interval (milliseconds)
const unsigned long POLL_INTERVAL = 60000;  // Poll every 1 minute (reduced traffic)
const unsigned long STATUS_REPORT_INTERVAL = 60000;  // Report status every 1 minute (reduced traffic)

// Watchdog timer configuration
const int WDT_TIMEOUT = 120;  // Watchdog timeout in seconds (2 minutes)

// EEPROM addresses
const int EEPROM_SIZE = 2048;  // Increased for error log storage
const int ADDR_RELAY_STATE = 0;
const int ADDR_SCHEDULE_START = 10;
const int ADDR_ERROR_LOG_START = 100;  // Error log starts at byte 100

// Error log configuration
const int MAX_ERROR_LOGS = 10;
const int ERROR_MESSAGE_LENGTH = 80;

// State structures
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

struct ErrorLog {
    unsigned long timestamp;  // Unix timestamp (4 bytes)
    char message[ERROR_MESSAGE_LENGTH];  // Error message (80 bytes)
    bool valid;  // Flag to indicate if this entry is valid (1 byte)
};

// Circular buffer for error logs
struct ErrorLogBuffer {
    int nextIndex;  // Next position to write (circular buffer)
    ErrorLog logs[MAX_ERROR_LOGS];
};

bool relayState = false;
Schedule currentSchedule;
ErrorLogBuffer errorLogBuffer;  // Error log storage

unsigned long lastPoll = 0;
unsigned long lastStatusReport = 0;
unsigned long lastImmediateReport = 0;  // Track immediate reports
unsigned long lastCountdownPrint = 0;   // Track countdown display
int consecutiveHttpErrors = 0;
int consecutiveWifiFailures = 0;        // Track WiFi reconnection failures

// LED toggle variables
bool ledState = false;  // Track LED on/off state
unsigned long lastLedToggle = 0;
const unsigned long LED_TOGGLE_INTERVAL = 1000;  // Toggle every 1 second

HTTPClient http;

// NTP Configuration
const char* NTP_SERVER = "pool.ntp.org";
const long GMT_OFFSET_SEC = 3600;  // Adjust for your timezone (1 hour = 3600 seconds)
const int DAYLIGHT_OFFSET_SEC = 3600;  // Adjust for daylight saving

// ============================================
// LED Control Functions
// ============================================

#ifdef RGB_LED
// WS2812 RGB LED implementation

void initLED() {
    pixels.begin();
    pixels.clear();
    pixels.show();
}

void setLED(uint8_t r, uint8_t g, uint8_t b) {
    pixels.setPixelColor(0, pixels.Color(r, g, b));
    pixels.show();
}

void setLEDPurple() {
    setLED(80, 0, 80);
}

void setLEDYellow() {
    setLED(80, 80, 0);
}

void setLEDGreen() {
    setLED(0, 80, 0);
}

void setLEDRed() {
    setLED(80, 0, 0);
}

void setLEDBlue() {
    setLED(0, 0, 80);
}

void toggleLED() {
    unsigned long now = millis();
    
    // Toggle LED every second to show loop is running
    if (now - lastLedToggle >= LED_TOGGLE_INTERVAL) {
        lastLedToggle = now;
        ledState = !ledState;
        
        if (ledState) {
            setLEDGreen();  // On = green
        } else {
            pixels.clear();  // Off
            pixels.show();
        }
    }
}

#else // STATIC_LED
// Built-in LED implementation

enum LEDMode {
    LED_NORMAL,     // Slow blink (1000ms) - normal operation
    LED_ERROR       // Fast blink (100ms) - startup/error
};

LEDMode currentLEDMode = LED_NORMAL;

void initLED() {
    pinMode(LED_BUILTIN, OUTPUT);
    digitalWrite(LED_BUILTIN, LOW);
}

void setLEDPurple() {
    currentLEDMode = LED_ERROR;  // Fast blink for startup
}

void setLEDYellow() {
    currentLEDMode = LED_NORMAL;  // Slow blink after WiFi
}

void setLEDGreen() {
    currentLEDMode = LED_NORMAL;  // Slow blink for normal operation
}

void setLEDRed() {
    currentLEDMode = LED_ERROR;  // Fast blink for errors
}

void setLEDBlue() {
    currentLEDMode = LED_NORMAL;  // Slow blink
}

void toggleLED() {
    unsigned long now = millis();
    unsigned long interval = (currentLEDMode == LED_ERROR) ? 100 : LED_TOGGLE_INTERVAL;
    
    // Toggle LED at different speeds based on mode
    if (now - lastLedToggle >= interval) {
        lastLedToggle = now;
        ledState = !ledState;
        digitalWrite(LED_BUILTIN, ledState ? HIGH : LOW);
    }
}

#endif

// ============================================
// Setup
// ============================================

void setup() {
    initLED();
    setLEDPurple();  // Purple during startup

    Serial.begin(115200);
    Serial.println("\n\nSyrenvej6 Varmepumpe Controller");
    Serial.println("================================");
    
    // Configure watchdog timer (2 minutes timeout)
    // If loop() doesn't run or gets stuck, Arduino will auto-reboot
    Serial.print("Configuring watchdog timer (");
    Serial.print(WDT_TIMEOUT);
    Serial.println(" seconds timeout)...");
    esp_task_wdt_init(WDT_TIMEOUT, true);  // Enable panic so ESP32 restarts
    esp_task_wdt_add(NULL);  // Add current thread to watchdog
    Serial.println("Watchdog timer enabled!");
    
    //init relay
    Relay.begin(0x30);

    // Initialize EEPROM
    EEPROM.begin(EEPROM_SIZE);
    
    // Load state from EEPROM
    loadState();
    
    // Apply loaded relay state IMMEDIATELY after loading from EEPROM
    // This ensures relay is in correct state even before WiFi connects
    Serial.println("Restoring relay to saved state...");
    setRelay(relayState);
    
    // Connect to WiFi - retry up to 3 times before rebooting
    int wifiRetries = 0;
    const int MAX_WIFI_RETRIES = 3;
    
    connectWiFi();
    while (WiFi.status() != WL_CONNECTED) {
        wifiRetries++;
        
        // Turn LED red during WiFi retry
        setLEDRed();
        
        if (wifiRetries >= MAX_WIFI_RETRIES) {
            logError("Failed to connect to WiFi after 3 attempts - rebooting");
            Serial.println("Failed to connect to WiFi after 3 attempts.");
            Serial.println("Rebooting in 5 seconds...");
            delay(5000);
            ESP.restart(); // Reboot the ESP32
        }
        
        Serial.print("Retrying WiFi connection (attempt ");
        Serial.print(wifiRetries + 1);
        Serial.println("/3) in 5 seconds...");
        
        // Log the retry
        char errorMsg[ERROR_MESSAGE_LENGTH];
        snprintf(errorMsg, ERROR_MESSAGE_LENGTH, "WiFi connection failed (attempt %d/3)", wifiRetries);
        logError(errorMsg);
        
        delay(5000);
        connectWiFi();
    }

    setLEDYellow();  // Yellow after WiFi connected
    
    // Wait for network stack to fully initialize after WiFi connection
    Serial.println("Waiting for network stack to initialize...");
    delay(2000);
    
    // Initialize time
    configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, NTP_SERVER);
    Serial.println("Waiting for time sync...");
    while (time(nullptr) < 100000) {
        delay(100);
    }
    Serial.println("Time synchronized!");
    
    setLEDGreen();  // Green after time synced - normal operation
    
    // Send immediate heartbeat after startup with restored relay state
    // This ensures UI shows correct state immediately after reboot
    Serial.println("Sending initial heartbeat with restored state...");
    
    // Retry heartbeat up to 3 times if it fails
    int heartbeatRetries = 0;
    while (heartbeatRetries < 3) {
        reportStatus();
        delay(2000);  // Wait to see if it succeeded
        
        if (consecutiveHttpErrors == 0) {
            Serial.println("Initial heartbeat sent successfully!");
            break;  // Success!
        } else {
            heartbeatRetries++;
            
            // Turn LED red during heartbeat retry
            setLEDRed();
            
            if (heartbeatRetries < 3) {
                Serial.print("Retrying initial heartbeat (attempt ");
                Serial.print(heartbeatRetries + 1);
                Serial.println("/3)...");
                
                // Log the retry
                char errorMsg[ERROR_MESSAGE_LENGTH];
                snprintf(errorMsg, ERROR_MESSAGE_LENGTH, "Initial heartbeat failed (attempt %d/3)", heartbeatRetries);
                logError(errorMsg);
                
                delay(3000);
            } else {
                logError("Initial heartbeat failed after 3 attempts");
                Serial.println("Initial heartbeat failed after 3 attempts. Will retry in main loop.");
            }
        }
    }
    
    Serial.println("Setup complete. Starting main loop...\n");
    
    // LED will toggle to show loop is running
}

void loop() {
    unsigned long now = millis();
    
    // Reset watchdog timer - proves loop is running
    esp_task_wdt_reset();
    
    // Toggle LED to show loop is running
    toggleLED();
    
    // Check WiFi connection
    if (WiFi.status() != WL_CONNECTED) {
        consecutiveWifiFailures++;
        
        // Turn LED red during WiFi error
        setLEDRed();
        
        Serial.print("WiFi disconnected. Reconnecting (attempt ");
        Serial.print(consecutiveWifiFailures);
        Serial.println("/3)...");
        
        // Log the error
        char errorMsg[ERROR_MESSAGE_LENGTH];
        snprintf(errorMsg, ERROR_MESSAGE_LENGTH, "WiFi disconnected (attempt %d/3)", consecutiveWifiFailures);
        logError(errorMsg);
        
        WiFi.disconnect();
        delay(1000);
        connectWiFi();
        
        // If still not connected after 3 attempts, reboot
        if (WiFi.status() != WL_CONNECTED && consecutiveWifiFailures >= 3) {
            logError("Failed to reconnect WiFi after 3 attempts - rebooting");
            Serial.println("Failed to reconnect WiFi after 3 attempts.");
            Serial.println("Rebooting in 5 seconds...");
            delay(5000);
            ESP.restart();
        }
    } else {
        // Reset counter when connected
        if (consecutiveWifiFailures > 0) {
            Serial.println("WiFi reconnected successfully!");
        }
        consecutiveWifiFailures = 0;
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
    
    // Print countdown every 10 seconds
    if (now - lastCountdownPrint >= 10000) {
        lastCountdownPrint = now;
        unsigned long timeUntilReport = STATUS_REPORT_INTERVAL - (now - lastStatusReport);
        int secondsLeft = timeUntilReport / 1000;
        Serial.print("Next status report in: ");
        Serial.print(secondsLeft);
        Serial.println(" seconds");
    }
    
    // Check if scheduled action needs to be executed
    checkSchedule();
    
    // Small delay to prevent CPU hogging (1ms allows fast LED updates)
    delay(1);
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
                
            } else if (strcmp(type, "clear_errors") == 0) {
                Serial.println("Clear errors command received");
                clearErrorLog();
            }
        }
    } else if (httpCode < 0) {
        // Negative HTTP codes indicate connection issues
        consecutiveHttpErrors++;
        
        // Log the error
        char errorMsg[ERROR_MESSAGE_LENGTH];
        snprintf(errorMsg, ERROR_MESSAGE_LENGTH, "Poll HTTP error: %d", httpCode);
        logError(errorMsg);
        
        Serial.print("HTTP error: ");
        Serial.println(httpCode);
        
        // If we get multiple HTTP errors, force WiFi reconnection
        if (consecutiveHttpErrors >= 3) {
            // Turn LED red during HTTP error recovery
            setLEDRed();
            
            logError("Multiple HTTP errors - reconnecting WiFi");
            Serial.println("Multiple HTTP errors detected. Reconnecting WiFi...");
            WiFi.disconnect();
            delay(1000);
            connectWiFi();
            
            // If WiFi reconnection failed, reboot
            if (WiFi.status() != WL_CONNECTED) {
                logError("WiFi reconnection failed - rebooting");
                Serial.println("WiFi reconnection failed after HTTP errors.");
                Serial.println("Rebooting in 5 seconds...");
                delay(5000);
                ESP.restart();
            }
            
            consecutiveHttpErrors = 0;
        }
    } else {
        // Reset error counter for any successful response
        if (consecutiveHttpErrors > 0) {
            consecutiveHttpErrors = 0;
        }
    }
    
    http.end();
}

void reportStatus() {
    if (WiFi.status() != WL_CONNECTED) return;
    
    // Throttle rapid successive calls to prevent HTTP errors
    // Allow immediate reports max once per 2 seconds
    unsigned long now = millis();
    if (now - lastImmediateReport < 2000 && lastImmediateReport != 0) {
        Serial.println("Throttling: Skipping report (too soon after last one)");
        return;
    }
    lastImmediateReport = now;
    
    String url = String(API_HOST) + STATUS_ENDPOINT;
    
    // Larger buffer to accommodate error log
    DynamicJsonDocument doc(4096);
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
    
    // Include error log in every heartbeat
    JsonArray errors = doc.createNestedArray("errors");
    for (int i = 0; i < MAX_ERROR_LOGS; i++) {
        // Read logs in chronological order (oldest to newest)
        int index = (errorLogBuffer.nextIndex + i) % MAX_ERROR_LOGS;
        
        if (errorLogBuffer.logs[index].valid && errorLogBuffer.logs[index].timestamp > 0) {
            JsonObject error = errors.createNestedObject();
            error["timestamp"] = errorLogBuffer.logs[index].timestamp;
            error["message"] = errorLogBuffer.logs[index].message;
        }
    }
    
    String jsonString;
    serializeJson(doc, jsonString);
    
    http.begin(url);
    http.setTimeout(10000);  // Increase timeout to 10 seconds
    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-API-Key", API_KEY);
    
    int httpCode = http.POST(jsonString);
    
    if (httpCode == HTTP_CODE_OK) {
        Serial.println("Status reported successfully");
        
        // Reset error counter on success
        if (consecutiveHttpErrors > 0) {
            consecutiveHttpErrors = 0;
        }
    } else {
        Serial.print("Failed to report status. HTTP code: ");
        Serial.println(httpCode);
        consecutiveHttpErrors++;
        
        // Log the error
        char errorMsg[ERROR_MESSAGE_LENGTH];
        snprintf(errorMsg, ERROR_MESSAGE_LENGTH, "Status report HTTP error: %d", httpCode);
        logError(errorMsg);
        
        // If we get multiple HTTP errors, force WiFi reconnection
        if (consecutiveHttpErrors >= 3) {
            // Turn LED red during HTTP error recovery
            setLEDRed();
            
            logError("Multiple status HTTP errors - reconnecting WiFi");
            Serial.println("Multiple HTTP errors detected. Reconnecting WiFi...");
            WiFi.disconnect();
            delay(1000);
            connectWiFi();
            
            // If WiFi reconnection failed, reboot
            if (WiFi.status() != WL_CONNECTED) {
                logError("WiFi reconnection failed after status errors - rebooting");
                Serial.println("WiFi reconnection failed after HTTP errors.");
                Serial.println("Rebooting in 5 seconds...");
                delay(5000);
                ESP.restart();
            }
            
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

void saveErrorLog() {
    EEPROM.put(ADDR_ERROR_LOG_START, errorLogBuffer);
    EEPROM.commit();
}

void loadErrorLog() {
    EEPROM.get(ADDR_ERROR_LOG_START, errorLogBuffer);
    
    // Initialize if not valid (first boot or corrupted)
    if (errorLogBuffer.nextIndex < 0 || errorLogBuffer.nextIndex >= MAX_ERROR_LOGS) {
        Serial.println("Initializing error log buffer...");
        errorLogBuffer.nextIndex = 0;
        for (int i = 0; i < MAX_ERROR_LOGS; i++) {
            errorLogBuffer.logs[i].valid = false;
            errorLogBuffer.logs[i].timestamp = 0;
            errorLogBuffer.logs[i].message[0] = '\0';
        }
        saveErrorLog();
    } else {
        Serial.print("Loaded error log buffer. Next index: ");
        Serial.println(errorLogBuffer.nextIndex);
    }
}

void logError(const char* errorMessage) {
    // Get current time
    time_t now;
    time(&now);
    
    // Store error in circular buffer
    int index = errorLogBuffer.nextIndex;
    errorLogBuffer.logs[index].timestamp = now;
    errorLogBuffer.logs[index].valid = true;
    strncpy(errorLogBuffer.logs[index].message, errorMessage, ERROR_MESSAGE_LENGTH - 1);
    errorLogBuffer.logs[index].message[ERROR_MESSAGE_LENGTH - 1] = '\0';  // Ensure null termination
    
    // Move to next index (circular)
    errorLogBuffer.nextIndex = (errorLogBuffer.nextIndex + 1) % MAX_ERROR_LOGS;
    
    // Save to EEPROM
    saveErrorLog();
    
    Serial.print("Error logged: ");
    Serial.println(errorMessage);
}

void clearErrorLog() {
    Serial.println("Clearing error log...");
    
    // Reset buffer to empty state
    errorLogBuffer.nextIndex = 0;
    for (int i = 0; i < MAX_ERROR_LOGS; i++) {
        errorLogBuffer.logs[i].valid = false;
        errorLogBuffer.logs[i].timestamp = 0;
        errorLogBuffer.logs[i].message[0] = '\0';
    }
    
    // Save cleared state to EEPROM
    saveErrorLog();
    
    Serial.println("Error log cleared from EEPROM");
    
    // Send immediate heartbeat to update server
    reportStatus();
}

void loadState() {
    Serial.println("Loading state from EEPROM...");
    
    // Load relay state
    byte relayByte = EEPROM.read(ADDR_RELAY_STATE);
    relayState = (relayByte == 1);
    
    // Load schedule
    EEPROM.get(ADDR_SCHEDULE_START, currentSchedule);
    
    // Load error log
    loadErrorLog();
    
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

