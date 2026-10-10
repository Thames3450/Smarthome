#pragma once
// Verify the exact ESP32-C6-Zero board PINOUT before connecting the module.
// GPIO4/GPIO5 support UART routing on Waveshare ESP32-C6-Zero.
#define PZEM_RX_GPIO 4 // ESP32 RX <- conditioned/isolated PZEM TX
#define PZEM_TX_GPIO 5 // ESP32 TX -> conditioned/isolated PZEM RX

// The default firmware is ENERGY MONITOR ONLY. No mains switching.
// Main-panel energy meter is ALWAYS read-only. Build a separate firmware for
// smart switches rather than using the main electricity meter to switch mains.
#define ENABLE_RELAY_OUTPUT 0
#define RELAY_GPIO 7
#define RELAY_ACTIVE_HIGH 1

#define TELEMETRY_INTERVAL_MS 10000UL
#define RECONNECT_INTERVAL_MS 10000UL
// Waveshare ESP32-C6-Zero BOOT button = GPIO9 (also bootstrapping pin).
// Use only as a long-press key AFTER the board has booted.
#define WIFI_SETUP_BUTTON_GPIO 9
#define WIFI_BUTTON_HOLD_MS 5000UL
#define WIFI_AUTO_SETUP_AFTER_MS 90000UL
#define FIRMWARE_VERSION "2.8.0"
