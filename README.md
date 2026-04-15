# BART Real-Time Display System (ESP32 + OLED)

## Table of Contents

* [Overview](#overview)
* [Project Structure](#project-structure)
* [Acknowledgments](#acknowledgments)
* [My Contributions](#my-contributions)
* [Server Modifications](#server-modifications)
* [Embedded System (ESP32)](#embedded-system-esp32)
* [Display Driver](#display-driver)
* [Dependencies](#dependencies)
* [Configuration](#configuration)
* [Setup Instructions](#setup-instructions)
* [Usage](#usage)
* [Notes](#notes)
* [Future Work](#future-work)
* [Summary](#summary)

---

## Overview

This project implements a real-time Bay Area Rapid Transit (BART) arrival display using an ESP32 microcontroller and a 20x4 OLED display. A Node.js server processes GTFS real-time transit data and exposes a simplified API consumed by the embedded device.

The system is composed of two components:

* A backend server that aggregates and processes real-time BART data
* An embedded firmware layer that renders arrival information on a physical display

---

## Project Structure

```text
bart-proxy/
├── index.js
├── src/
├── gtfs-static-data/
├── Arduino/
│   └── bart/
│       ├── bart.ino
│       ├── er_oled.cpp
│       ├── er_oled.h
│       └── config.example.h
├── package.json
├── Dockerfile
└── README.md
```

---

## Acknowledgments

This project is based on the following repository:

https://github.com/filbot/bart-proxy/tree/main?tab=readme-ov-file

The original project provides a robust GTFS real-time proxy server for BART. This work extends that system to support embedded display hardware and additional real-time data features.

---

## My Contributions

This project extends the original repository into a complete hardware-integrated system. The primary contributions include:

* Integration of a physical display system using ESP32
* Reconstruction and implementation of missing display driver components
* Development of embedded firmware for real-time rendering
* Modification of the server API for embedded-friendly consumption
* Addition of car count estimation using the BART legacy API
* Implementation of station selection and normalization logic

---

## Server Modifications

The server entry point (`index.js`) was modified to support hardware integration and improved usability.

Key additions include:

* A simplified `/next` endpoint returning only essential fields for embedded use
* Destination parsing improvements for clearer display formatting
* Arrival status normalization (e.g., "arriving" vs "scheduled")
* Station selection system with presets and normalization
* Integration with the BART legacy API to estimate train car counts
* Background polling and caching for car count data

The modified endpoint structure enables efficient parsing by constrained devices.

See the updated server implementation: 
Original server reference: 

---

## Embedded System (ESP32)

The firmware located in `Arduino/bart/` implements the display logic.

Features include:

* WiFi connection and automatic reconnection handling
* HTTP polling of the backend server
* JSON parsing using ArduinoJson
* Multiple display modes:

  * Clock display
  * Arrival board
  * Arrival alert state for incoming trains
* Optimized rendering to minimize flicker and unnecessary updates

The firmware is designed for reliability under intermittent network conditions and limited hardware resources.

---

## Display Driver

The OLED driver (`er_oled.cpp` and `er_oled.h`) was reconstructed to enable operation of the 20x4 SPI OLED display.

This includes:

* Low-level SPI communication handling
* Text rendering utilities
* Cursor positioning and display formatting helpers

These files were necessary to make the display functional, as they were not included in the original repository.

---

## Dependencies

### Server

* Node.js
* Express
* GTFS processing libraries included in the original project

### Arduino

Install via Arduino Library Manager:

* ArduinoJson
* U8g2 (if applicable depending on display configuration)

---

## Configuration

Sensitive configuration is separated from the main codebase.

### Arduino Configuration

1. Copy:

```text
Arduino/bart/config.example.h → config.h
```

2. Edit `config.h`:

```cpp
#define WIFI_SSID     "YOUR_WIFI_NAME"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"
#define BART_URL      "http://YOUR_SERVER_IP:3001/next?limit=4"
```

This file is excluded from version control.

---

## Setup Instructions

### Server

```bash
npm install
npm start
```

The server will run on:

```text
http://localhost:3001
```

---

### Arduino

1. Open `Arduino/bart/bart.ino` in the Arduino IDE
2. Install required libraries
3. Create and configure `config.h`
4. Upload to ESP32

---

## Usage

Once both components are running:

* The ESP32 connects to WiFi
* It polls the `/next` endpoint
* Real-time arrival data is rendered on the OLED display

---

## Notes

* The file `config.h` is intentionally excluded from the repository
* The system assumes a local network connection between ESP32 and server
* Car count estimation requires a valid BART API key
* The repository retains the original server structure to preserve compatibility with upstream updates

---


## Summary

This project demonstrates:

* Integration of backend systems with embedded hardware
* Real-time data processing and visualization
* Extension of an existing open-source system into a complete application
* Practical engineering considerations for reliability and usability

---
