#ifndef CONFIG_H
#define CONFIG_H

// ---- WiFi & Server Config ----
#define WIFI_SSID     "YOUR_WIFI_NAME"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"
#define BART_URL      "http://YOUR_SERVER_IP:3001/next?limit=4"

// ---- Time Config ----
#define NTP_SERVER "pool.ntp.org"
#define GMT_OFFSET_SEC (-8 * 3600)   // adjust for timezone
#define DAYLIGHT_OFFSET_SEC 3600

#endif