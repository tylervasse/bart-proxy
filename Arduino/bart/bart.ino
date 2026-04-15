#include <Arduino.h>
#include <SPI.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "er_oled.h"
#include "config.h"

unsigned long arrivingModeStart = 0;
bool arrivingLockoutUntilClear = false;

const unsigned long SCREEN_DWELL_ARRIVING_MAX = 15000UL; // 15 s max arriving screen

// ---- Display Modes ----
enum DisplayMode {
  MODE_CLOCK,         // Shows current time + station name
  MODE_BOARD,         // Normal arrival board (3 rows)
  MODE_ARRIVING       // Full-screen alert for an imminent train
};

// ---- Data ----
struct Arrival {
  String destination;
  int    minutes;
  String status;
  String vehicle;    // e.g. "3-door" or "4-door"
  int    cars;       // actual number of cars; -1 if unknown
  int    occupancy;  // -1 = unknown; 0-5 occupancy enum from GTFS
};

Arrival arrivals[4];
int     arrivalCount = 0;
String  stationName  = "";
String  errorMsg     = "";

// ---- Timing ----
unsigned long lastFetch        = 0;
unsigned long lastScreenChange = 0;
unsigned long lastClockDraw    = 0;

const unsigned long FETCH_INTERVAL        = 30000UL;  // 30 s between API calls
const unsigned long SCREEN_DWELL_BOARD    = 8000UL;   // 8 s on board view
const unsigned long SCREEN_DWELL_CLOCK    = 5000UL;   // 5 s on clock view
const unsigned long SCREEN_DWELL_ARRIVING = 5000UL;   // 5 s on arriving alert
const unsigned long CLOCK_REDRAW_INTERVAL = 1000UL;   // redraw clock every 1 s
const unsigned long ARRIVING_BLINK_ON_MS  = 1500UL;
const unsigned long ARRIVING_BLINK_OFF_MS = 250UL;

bool lastArrivingVisible = true;
int lastArrivingIdx = -1;
String lastClockRow0 = "";
String lastClockRow1 = "";
String lastClockRow2 = "";
String lastClockRow3 = "";
bool clockScreenInitialized = false;

DisplayMode currentMode = MODE_CLOCK;

// ---- Helpers ----
String padTo(String s, int len) {
  while ((int)s.length() < len) s += ' ';
  if ((int)s.length() > len) s = s.substring(0, len);
  return s;
}

void oledString(uint8_t col, uint8_t row, String s) {
  er_oled_string(col, row, s.c_str(), 0);
}

// Return occupancy as a short human-readable tag (fits 4-5 chars)
String occupancyTag(int occ) {
  switch (occ) {
    case 0: return "EMTY";
    case 1: return "MANY";
    case 2: return "FULL";
    default: return "";
  }
}


// ---- Fetch BART data ----
bool fetchArrivals() {
  if (WiFi.status() != WL_CONNECTED) {
    errorMsg = "WiFi disconnected";
    return false;
  }

  HTTPClient http;
  http.begin(BART_URL);
  http.setTimeout(8000);
  int code = http.GET();

  if (code != 200) {
    errorMsg = "HTTP " + String(code);
    http.end();
    return false;
  }

  String body = http.getString();
  http.end();

  StaticJsonDocument<2048> doc;
  DeserializationError err = deserializeJson(doc, body);
  if (err) {
    errorMsg = "JSON parse error";
    return false;
  }

  stationName  = doc["station"].as<String>();
  arrivalCount = 0;
  errorMsg     = "";

  JsonArray arr = doc["nextArrivals"].as<JsonArray>();
  for (JsonObject item : arr) {
    if (arrivalCount >= 4) break;
    arrivals[arrivalCount].destination = item["destination"].as<String>();
    arrivals[arrivalCount].minutes     = item["minutesUntilArrival"].as<int>();
    arrivals[arrivalCount].status      = item["status"].as<String>();

    // vehicle label from GTFS, e.g. "3-door" or "4-door"
    arrivals[arrivalCount].vehicle = item.containsKey("vehicle")
        ? item["vehicle"].as<String>() : "";

    // actual number of cars from your updated server
    arrivals[arrivalCount].cars = item.containsKey("cars")
        ? item["cars"].as<int>() : -1;

    // occupancy (GTFS enum 0=empty,1=many seats,2=full,etc.)
    arrivals[arrivalCount].occupancy = item.containsKey("occupancy")
        ? item["occupancy"].as<int>() : -1;

    arrivalCount++;
  }
  return true;
}

// ---- Get current time string (no seconds, 12-hour) ----
// Returns e.g. "1:42 PM"
String getTimeStringShort() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) return "--:-- --";
  char buf[10];
  strftime(buf, sizeof(buf), "%I:%M %p", &timeinfo); // e.g. "01:42 PM"
  // trim leading zero from hour
  if (buf[0] == '0') return String(buf + 1); // "1:42 PM"
  return String(buf);
}

// ---- Draw: Clock Mode ----
void drawClock(bool forceFullRedraw = false) {
  // Build exactly the same rows as before
  String row0 = padTo("", 20);

  String timeStr = "TIME  " + getTimeStringShort();
  int pad = (20 - (int)timeStr.length()) / 2;
  if (pad < 0) pad = 0;
  String timeRow = "";
  for (int i = 0; i < pad; i++) timeRow += ' ';
  timeRow += timeStr;
  String row1 = padTo(timeRow, 20);

  String row2 = padTo("", 20);
  String row3 = padTo("", 20);

  // Only clear once when first entering the clock screen
  if (forceFullRedraw || !clockScreenInitialized) {
    er_oled_clear();
    oledString(0, 0, row0);
    oledString(0, 1, row1);
    oledString(0, 2, row2);
    oledString(0, 3, row3);

    lastClockRow0 = row0;
    lastClockRow1 = row1;
    lastClockRow2 = row2;
    lastClockRow3 = row3;
    clockScreenInitialized = true;
    return;
  }

  // After that, only update rows that actually changed
  if (row0 != lastClockRow0) {
    oledString(0, 0, row0);
    lastClockRow0 = row0;
  }
  if (row1 != lastClockRow1) {
    oledString(0, 1, row1);
    lastClockRow1 = row1;
  }
  if (row2 != lastClockRow2) {
    oledString(0, 2, row2);
    lastClockRow2 = row2;
  }
  if (row3 != lastClockRow3) {
    oledString(0, 3, row3);
    lastClockRow3 = row3;
  }
}

// ---- Draw: Arrival Board Mode ----
// Row 0: station name
// Rows 1-3: next 3 arrivals (dest + minutes)
void drawBoard() {
  er_oled_clear();

  if (errorMsg.length() > 0) {
    oledString(0, 0, padTo("BART ERROR", 20));
    oledString(0, 1, padTo(errorMsg, 20));
    oledString(0, 2, padTo("Check server &", 20));
    oledString(0, 3, padTo("WiFi connection.", 20));
    return;
  }

  oledString(0, 0, padTo(stationName, 20));

  for (int i = 0; i < 3; i++) {
    if (i < arrivalCount) {
      String mins;
      if (arrivals[i].status == "arriving" || arrivals[i].minutes <= 1) {
        mins = " NOW";
      } else {
        String m = String(arrivals[i].minutes);
        mins = (m.length() < 2 ? " " + m : m) + " MIN";
      }

      int destLen = 20 - (int)mins.length() - 1;
      String line = padTo(arrivals[i].destination, destLen) + " " + mins;
      oledString(0, i + 1, padTo(line, 20));
    } else {
      oledString(0, i + 1, "--------------------");
    }
  }
}

// Helper: center a string on the 20-char display
String centerOn20(String s) {
  if ((int)s.length() >= 20) return s.substring(0, 20);
  int pad = (20 - (int)s.length()) / 2;
  String out = "";
  for (int i = 0; i < pad; i++) out += ' ';
  out += s;
  return padTo(out, 20);
}

// ---- Draw: Arriving Alert Mode ----
// Destination split across rows 0 & 1 (word-wrap at space nearest midpoint)
// Row 2: "8 CAR TRAIN" or "CAR COUNT UNKNOWN"
// Row 3: occupancy string or blank
void drawArriving(int idx, bool visible = true) {
  er_oled_clear();

  if (!visible) {
    oledString(0, 0, padTo("", 20));
    oledString(0, 1, padTo("", 20));
    oledString(0, 2, padTo("", 20));
    oledString(0, 3, padTo("", 20));
    return;
  }

  String dest = arrivals[idx].destination;
  String line1 = "";
  String line2 = "";
  bool twoLines = false;

  int mid = dest.length() / 2;
  int bestPos = -1;
  for (int i = 0; i < (int)dest.length(); i++) {
    if (dest.charAt(i) == ' ') {
      if (bestPos < 0 || abs(i - mid) < abs(bestPos - mid)) {
        bestPos = i;
      }
    }
  }

  // Only split if needed
  if ((int)dest.length() > 20 && bestPos > 0) {
    line1 = dest.substring(0, bestPos);
    line2 = dest.substring(bestPos + 1);
    twoLines = true;
  } else {
    line1 = dest;
  }

  if (twoLines) {
    // Two-line destination uses rows 0 and 1
    oledString(0, 0, centerOn20(line1));
    oledString(0, 1, centerOn20(line2));
  } else {
    // One-line destination goes on row 1
    oledString(0, 0, padTo("", 20));
    oledString(0, 1, centerOn20(line1));
  }

  // Row 2 blank
  oledString(0, 2, padTo("", 20));

  // Row 3: car/door info
  int cars = arrivals[idx].cars;
  String vehicleStr = arrivals[idx].vehicle;
  vehicleStr.toUpperCase();

  String carRow = "";
  if (cars > 0 && vehicleStr.length() > 0) {
    carRow = String(cars) + "-CAR, " + vehicleStr;
  } else if (cars > 0) {
    carRow = String(cars) + "-CAR";
  } else if (vehicleStr.length() > 0) {
    carRow = vehicleStr;
  } else {
    carRow = "UNKNOWN TRAIN";
  }

  oledString(0, 3, centerOn20(carRow));
}

// ---- Check if any train is arriving imminently ----
// Returns index of the soonest arriving train, or -1
int getArrivingIdx() {
  for (int i = 0; i < arrivalCount; i++) {
    if (arrivals[i].minutes <= 1 || arrivals[i].status == "arriving") {
      return i;
    }
  }
  return -1;
}

// ---- WiFi reconnect helper ----
void ensureWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.println("WiFi lost, reconnecting...");

  er_oled_clear();
  er_oled_string(0, 0, "WiFi reconnecting...", 0);

  WiFi.disconnect();
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    attempts++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("Reconnected: " + WiFi.localIP().toString());
  }
}

// ---- Setup ----
void setup() {
  Serial.begin(115200);
  delay(500);

  er_oled_begin();
  Serial.println("Display init done");

  er_oled_clear();
  er_oled_string(0, 0, "  BART  DISPLAY     ", 0);
  er_oled_string(0, 1, "Connecting WiFi...  ", 0);
  er_oled_string(0, 2, padTo(String(WIFI_SSID), 20).c_str(), 0);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  er_oled_clear();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi OK: " + WiFi.localIP().toString());
    er_oled_string(0, 0, "WiFi connected!     ", 0);
    er_oled_string(0, 1, padTo(WiFi.localIP().toString(), 20).c_str(), 0);
    er_oled_string(0, 2, "Syncing time (NTP)  ", 0);

    // Sync NTP time
    configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, NTP_SERVER);
    struct tm timeinfo;
    int ntpAttempts = 0;
    while (!getLocalTime(&timeinfo) && ntpAttempts < 10) {
      delay(500);
      ntpAttempts++;
    }
    if (ntpAttempts < 10) {
      Serial.println("NTP synced");
      er_oled_string(0, 3, "Time synced!        ", 0);
    } else {
      Serial.println("NTP sync failed - clock may be wrong");
      er_oled_string(0, 3, "NTP sync failed     ", 0);
    }
  } else {
    Serial.println("\nWiFi FAILED");
    er_oled_string(0, 0, "WiFi FAILED         ", 0);
    er_oled_string(0, 1, "Check SSID/password ", 0);
  }
  delay(2000);

  currentMode     = MODE_CLOCK;
  lastScreenChange = millis();
}

// ---- Loop ----
void loop() {
  ensureWiFi();

  unsigned long now = millis();

  // ---- Fetch data on schedule ----
  if (now - lastFetch >= FETCH_INTERVAL || lastFetch == 0) {
    lastFetch = now;
    Serial.println("Fetching BART data...");
    fetchArrivals();
    Serial.println("Station: " + stationName);
    for (int i = 0; i < arrivalCount; i++) {
      String extra = "";
      if (arrivals[i].cars > 0 && arrivals[i].vehicle.length() > 0) {
        extra = " [" + String(arrivals[i].cars) + " cars, " + arrivals[i].vehicle + "]";
      } else if (arrivals[i].cars > 0) {
        extra = " [" + String(arrivals[i].cars) + " cars]";
      } else if (arrivals[i].vehicle.length() > 0) {
        extra = " [" + arrivals[i].vehicle + "]";
      }

      Serial.println("  " + arrivals[i].destination +
                     " - " + arrivals[i].minutes + " min" +
                     extra);
    }
  }

// ---- Arriving train logic ----
int arrivingIdx = getArrivingIdx();

// If no imminent train anymore, allow future arriving alerts again
if (arrivingIdx < 0) {
  arrivingLockoutUntilClear = false;
}

// Enter arriving mode only if:
// 1) a train is imminent
// 2) we are not already lockout-blocked from re-entering
if (arrivingIdx >= 0 && !arrivingLockoutUntilClear) {
  if (currentMode != MODE_ARRIVING) {
    currentMode = MODE_ARRIVING;
    lastScreenChange = now;
    arrivingModeStart = now;
    lastArrivingVisible = true;
    lastArrivingIdx = -1;   // force initial draw
  }

  // Stay in arriving mode for at most 15 seconds
  if (now - arrivingModeStart < SCREEN_DWELL_ARRIVING_MAX) {
    unsigned long blinkCycle = ARRIVING_BLINK_ON_MS + ARRIVING_BLINK_OFF_MS;
    unsigned long phase = (now - arrivingModeStart) % blinkCycle;
    bool visible = (phase < ARRIVING_BLINK_ON_MS);

    // Only redraw when something actually changes
    if (visible != lastArrivingVisible || arrivingIdx != lastArrivingIdx) {
      drawArriving(arrivingIdx, visible);
      lastArrivingVisible = visible;
      lastArrivingIdx = arrivingIdx;
    }

    delay(50);
    return;
  } else {
    // 15 seconds elapsed: leave arriving mode and don't re-enter
    // until there is no imminent train, then a new imminent train later
    // can trigger it again.
    arrivingLockoutUntilClear = true;
    currentMode = MODE_BOARD;
    lastScreenChange = now;

    lastArrivingVisible = true;
    lastArrivingIdx = -1;
    clockScreenInitialized = false;

    drawBoard();
  }
}

// ---- Normal mode cycling: BOARD → CLOCK → BOARD → … ----
// If we just came off MODE_ARRIVING, drop to BOARD first
if (currentMode == MODE_ARRIVING) {
  currentMode = MODE_BOARD;
  lastScreenChange = now;

  lastArrivingVisible = true;
  lastArrivingIdx = -1;
  clockScreenInitialized = false;

  drawBoard();
}

unsigned long dwell = (currentMode == MODE_BOARD) ? SCREEN_DWELL_BOARD : SCREEN_DWELL_CLOCK;

if (now - lastScreenChange >= dwell) {
  lastScreenChange = now;
  if (currentMode == MODE_BOARD) {
    currentMode = MODE_CLOCK;
    clockScreenInitialized = false;
    drawClock(true);
    lastClockDraw = now;
  } else {
    currentMode = MODE_BOARD;
    drawBoard();
  }
}

// ---- While in clock mode, update the time every second ----
if (currentMode == MODE_CLOCK && now - lastClockDraw >= CLOCK_REDRAW_INTERVAL) {
  lastClockDraw = now;
  drawClock();
}

  delay(100);
}