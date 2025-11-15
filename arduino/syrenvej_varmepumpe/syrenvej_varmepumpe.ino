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
const char* WIFI_SSID = "Syrenvej_6";
const char* WIFI_PASSWORD = "Andreas97";

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
const unsigned long POLL_INTERVAL = 60000;  // Poll every 1 minute (checks commands + sends status)

// Watchdog timer configuration
const int WDT_TIMEOUT = 60;  // Watchdog timeout in seconds (1 minute - will reboot if loop stuck)

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
unsigned long lastCountdownPrint = 0;   // Track countdown display
unsigned long lastWifiCheck = 0;        // Track WiFi reconnection attempts
int consecutiveHttpErrors = 0;
int consecutiveWifiFailures = 0;        // Track WiFi reconnection failures

// LED toggle variables
bool ledState = false;  // Track LED on/off state
unsigned long lastLedToggle = 0;
const unsigned long LED_TOGGLE_INTERVAL = 1000;  // Toggle every 1 second

// NTP Configuration
const char* NTP_SERVER = "pool.ntp.org";
// Timezone for Copenhagen, Denmark (CET/CEST with automatic DST)
// CET-1CEST: CET is UTC+1, CEST is UTC+2
// M3.5.0: DST starts last Sunday of March at 02:00
// M10.5.0/3: DST ends last Sunday of October at 03:00
const char* TIMEZONE = "CET-1CEST,M3.5.0,M10.5.0/3";

// ============================================
// Function Declarations
// ============================================
void reportStatus();
void printCountdown();

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
    
    // Configure watchdog timer (1 minute timeout)
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
    
    // Connect to WiFi - retry up to 5 times before rebooting
    int wifiRetries = 0;
    const int MAX_WIFI_RETRIES = 5;
    
    connectWiFi();
    while (WiFi.status() != WL_CONNECTED) {
        wifiRetries++;
        
        // Turn LED red during WiFi retry
        setLEDRed();
        
        if (wifiRetries >= MAX_WIFI_RETRIES) {
            logError("Failed to connect to WiFi after 5 attempts - rebooting");
            Serial.println("Failed to connect to WiFi after 5 attempts.");
            Serial.println("Rebooting in 5 seconds...");
            delay(5000);
            ESP.restart(); // Reboot the ESP32
        }
        
        Serial.print("Retrying WiFi connection (attempt ");
        Serial.print(wifiRetries + 1);
        Serial.println("/5) in 5 seconds...");
        
        // Log the retry
        char errorMsg[ERROR_MESSAGE_LENGTH];
        snprintf(errorMsg, ERROR_MESSAGE_LENGTH, "WiFi connection failed (attempt %d/5)", wifiRetries);
        logError(errorMsg);
        
        // Properly shutdown WiFi before retry
        Serial.println("Shutting down WiFi radio...");
        WiFi.disconnect(true, true);  // Disconnect and erase credentials from memory
        WiFi.mode(WIFI_OFF);          // Turn off WiFi radio completely
        delay(2000);                  // Wait for radio to fully shutdown
        
        Serial.println("Waiting before retry...");
        delay(3000);
        connectWiFi();
    }

    setLEDYellow();  // Yellow after WiFi connected
    
    // Wait for network stack to fully initialize after WiFi connection
    Serial.println("Waiting for network stack to initialize...");
    delay(2000);
    
    // Initialize time with automatic DST handling
    configTzTime(TIMEZONE, NTP_SERVER);
    Serial.println("Waiting for time sync with timezone: CET/CEST...");
    while (time(nullptr) < 100000) {
        delay(100);
    }
    
    // Print current time to verify DST is working
    time_t now = time(nullptr);
    struct tm* timeinfo = localtime(&now);
    Serial.printf("Time synchronized! Current time: %04d-%02d-%02d %02d:%02d:%02d %s\n",
                  timeinfo->tm_year + 1900, timeinfo->tm_mon + 1, timeinfo->tm_mday,
                  timeinfo->tm_hour, timeinfo->tm_min, timeinfo->tm_sec,
                  timeinfo->tm_isdst ? "CEST (DST active)" : "CET");
    Serial.println("DST will automatically adjust on last Sunday of March and October");
    
    setLEDGreen();  // Green after time synced - normal operation
    
    // Do initial poll to sync with server and get any pending commands
    // This also sends our current status to the UI
    Serial.println("Performing initial poll to sync with server...");
    pollForCommands();
    
    // Initialize timer after initial poll
    unsigned long setupTime = millis();
    lastPoll = setupTime;                    // Next poll in 60 seconds
    lastCountdownPrint = setupTime;          // Start countdown display immediately
    
    Serial.println("\nSetup complete. Starting main loop...");
    Serial.println("Timer initialized: Next poll in 60 seconds");
    
    // LED will toggle to show loop is running
}

void loop() {
    unsigned long now = millis();
    
    // Reset watchdog timer - proves loop is running
    esp_task_wdt_reset();
    
    // Toggle LED to show loop is running
    toggleLED();
    
    // Check WiFi connection periodically (every 10 seconds) instead of every loop iteration
    // This prevents blocking the loop with frequent reconnection attempts
    if (now - lastWifiCheck >= 10000) {
        lastWifiCheck = now;
        
        if (WiFi.status() != WL_CONNECTED) {
            consecutiveWifiFailures++;
            
            // Turn LED red during WiFi error
            setLEDRed();
            
            Serial.print("WiFi disconnected. Reconnecting (attempt ");
            Serial.print(consecutiveWifiFailures);
            Serial.println("/5)...");
            
            // Log the error (only on first attempt to avoid EEPROM spam)
            if (consecutiveWifiFailures == 1) {
                logError("WiFi disconnected - attempting reconnection");
            }
            
            // Properly shutdown WiFi before retry
            Serial.println("Shutting down WiFi radio...");
            WiFi.disconnect(true, true);  // Disconnect and erase credentials from memory
            WiFi.mode(WIFI_OFF);          // Turn off WiFi radio completely
            delay(2000);                  // Wait for radio to fully shutdown
            
            Serial.println("Attempting reconnection...");
            delay(1000);
            connectWiFi();
            
            // If still not connected after 5 attempts, reboot
            if (WiFi.status() != WL_CONNECTED && consecutiveWifiFailures >= 5) {
                logError("Failed to reconnect WiFi after 5 attempts - rebooting");
                Serial.println("Failed to reconnect WiFi after 5 attempts.");
                Serial.println("Rebooting in 5 seconds...");
                delay(5000);
                ESP.restart();
            }
        } else {
            // Reset counter when connected
            if (consecutiveWifiFailures > 0) {
                Serial.println("WiFi reconnected successfully!");
                logError("WiFi reconnected successfully");
            }
            consecutiveWifiFailures = 0;
        }
    }
    
    // Only poll if WiFi is connected (skip if reconnecting)
    // Each poll checks for commands AND sends status update
    if (WiFi.status() == WL_CONNECTED) {
        if (now - lastPoll >= POLL_INTERVAL) {
            lastPoll = now;
            pollForCommands();  // This also sends status after checking commands
            
            // Add small delay after HTTP requests to let connections fully close
            delay(100);
        }
    }
    
    // Print countdown every 10 seconds (only show if WiFi connected)
    if (WiFi.status() == WL_CONNECTED && now - lastCountdownPrint >= 10000) {
        lastCountdownPrint = now;
        printCountdown();
    }
    
    // Check if scheduled action needs to be executed
    checkSchedule();
    
    // Small delay to prevent CPU hogging (1ms allows fast LED updates)
    delay(1);
}

void printCountdown() {
    unsigned long now = millis();
    unsigned long timeUntilPoll = POLL_INTERVAL - (now - lastPoll);
    int pollSecondsLeft = timeUntilPoll / 1000;
    
    Serial.print("[POLL] Next poll in ");
    Serial.print(pollSecondsLeft);
    Serial.println("s (will check for commands and send status)");
}

void connectWiFi() {
    Serial.print("Connecting to WiFi: ");
    Serial.println(WIFI_SSID);
    
    // Configure WiFi for stability
    WiFi.mode(WIFI_STA);
    WiFi.setAutoReconnect(false);  // Disable auto-reconnect, we handle it manually
    WiFi.persistent(false);        // Don't save WiFi config to flash (reduces wear)
    
    // Set power management to maximum performance (no sleep)
    WiFi.setSleep(false);
    
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
        Serial.print("Signal strength (RSSI): ");
        Serial.print(WiFi.RSSI());
        Serial.println(" dBm");
    } else {
        Serial.println("\nWiFi connection failed!");
    }
}

void pollForCommands() {
    if (WiFi.status() != WL_CONNECTED) return;
    
    // Create fresh HTTPClient for each request to avoid connection state issues
    HTTPClient http;
    
    String url = String(API_HOST) + COMMAND_ENDPOINT;
    
    http.begin(url);
    http.setTimeout(10000);  // 10 seconds timeout - watchdog will catch if this hangs
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
                // Status will be sent at end of poll
                
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
                // Status will be sent at end of poll
                
            } else if (strcmp(type, "clear_schedule") == 0) {
                Serial.println("Clear schedule command received");
                currentSchedule.active = false;
                currentSchedule.executed = false;  // Clear executed flag when manually cancelled
                saveSchedule();
                // Status will be sent at end of poll
                
            } else if (strcmp(type, "clear_errors") == 0) {
                Serial.println("Clear errors command received");
                clearErrorLog();
            }
        }
    } else if (httpCode < 0) {
        // Negative HTTP codes indicate connection issues
        consecutiveHttpErrors++;
        
        Serial.print("Poll HTTP error: ");
        Serial.println(httpCode);
        
        // Only log error on first occurrence to reduce EEPROM wear
        if (consecutiveHttpErrors == 1) {
            char errorMsg[ERROR_MESSAGE_LENGTH];
            snprintf(errorMsg, ERROR_MESSAGE_LENGTH, "Poll HTTP error: %d", httpCode);
            logError(errorMsg);
        }
        
        // If we get multiple HTTP errors, force WiFi reconnection
        if (consecutiveHttpErrors >= 3) {
            // Turn LED red during HTTP error recovery
            setLEDRed();
            
            logError("Multiple HTTP errors (3+) - reconnecting WiFi");
            Serial.println("Multiple HTTP errors detected (3+). Reconnecting WiFi...");
            
            // Properly shutdown WiFi before reconnection
            WiFi.disconnect(true, true);  // Disconnect and erase credentials from memory
            WiFi.mode(WIFI_OFF);          // Turn off WiFi radio completely
            delay(2000);                  // Wait for radio to fully shutdown
            
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
    
    // Always send status update after checking for commands
    // This keeps the UI in sync every poll cycle
    Serial.println("Sending status update to UI...");
    reportStatus();
}

void reportStatus() {
    if (WiFi.status() != WL_CONNECTED) return;
    
    // Create fresh HTTPClient for each request to avoid connection state issues
    HTTPClient http;
    
    String url = String(API_HOST) + STATUS_ENDPOINT;
    
    // Larger buffer to accommodate error log
    DynamicJsonDocument doc(4096);
    doc["relayState"] = relayState ? "on" : "off";
    
    // Always send schedule if it exists (active or recently executed)
    // Send null only if schedule was never set or was manually cleared
    if (currentSchedule.active || currentSchedule.executed) {
        JsonObject schedule = doc.createNestedObject("schedule");
        schedule["active"] = currentSchedule.active;
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
    http.setTimeout(10000);  // 10 seconds timeout - watchdog will catch if this hangs
    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-API-Key", API_KEY);
    
    int httpCode = http.POST(jsonString);
    
    if (httpCode == HTTP_CODE_OK) {
        Serial.println("[OK] Status update sent successfully");
        
        // Force countdown to print on next loop iteration
        lastCountdownPrint = millis() - 10000;
        
        // Reset error counter on success
        if (consecutiveHttpErrors > 0) {
            consecutiveHttpErrors = 0;
        }
    } else {
        Serial.print("Failed to report status. HTTP code: ");
        Serial.println(httpCode);
        consecutiveHttpErrors++;
        
        // Only log error on first occurrence to reduce EEPROM wear
        if (consecutiveHttpErrors == 1) {
            char errorMsg[ERROR_MESSAGE_LENGTH];
            snprintf(errorMsg, ERROR_MESSAGE_LENGTH, "Status report HTTP error: %d", httpCode);
            logError(errorMsg);
        }
        
        // If we get multiple HTTP errors, force WiFi reconnection
        if (consecutiveHttpErrors >= 3) {
            // Turn LED red during HTTP error recovery
            setLEDRed();
            
            logError("Multiple status HTTP errors (3+) - reconnecting WiFi");
            Serial.println("Multiple HTTP errors detected (3+). Reconnecting WiFi...");
            
            // Properly shutdown WiFi before reconnection
            WiFi.disconnect(true, true);  // Disconnect and erase credentials from memory
            WiFi.mode(WIFI_OFF);          // Turn off WiFi radio completely
            delay(2000);                  // Wait for radio to fully shutdown
            
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
        
        // Mark schedule as executed (keep data for stats tracking)
        currentSchedule.active = false;
        currentSchedule.executed = true;  // Mark as executed for detection
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

