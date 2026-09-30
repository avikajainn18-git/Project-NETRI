// NETRI — boot-time device identity (APPROVED, D6).
//
// Selects one of the predefined IDs (netri_config.h) at boot from two
// selector pins. Intentionally simple: no provisioning system, no persistent
// storage, no runtime re-selection.
//
// ELECTRICAL NOTE (corrective review; verified against Espressif ESP-IDF GPIO
// docs: "Only pins that support both input & output have integrated pull-up
// and pull-down resistors. Input-only GPIOs 34-39 do not."):
//   The original implementation used GPIO 34/35 with INPUT_PULLUP. That pull-
//   up request is silently ignored on those input-only pins, leaving the
//   selectors floating and the unwired default unreliable. The selector now
//   uses GPIO 32/33 — regular GPIOs with working internal pull-ups — so the
//   APPROVED BOM is unchanged (the pull-ups live inside the ESP32).
//
// Mapping (ESP32 DevKit V1; Wokwi pins "32"/"33"):
//   both selectors open (unwired)          → NETRI-001 (default)
//   GPIO 32 tied to GND                    → NETRI-002
//   GPIO 32 and GPIO 33 both tied to GND   → NETRI-003
//
// Tie a selector to 3V3 instead and it reads HIGH (never counted), so any
// wiring mistake still lands on a valid predefined ID; both-tied-to-3V3 is
// electrically identical to unwired → NETRI-001. No external resistors are
// required: the ESP32's internal pull-ups are the only bias.
#ifndef NETRI_IDENTITY_H
#define NETRI_IDENTITY_H

#include "netri_pins.h"

namespace netri {
namespace identity {

constexpr int ID_BIT0_PIN = 32; // regular GPIO: internal pull-up works
constexpr int ID_BIT1_PIN = 33; // regular GPIO: internal pull-up works

// select() counts the selector pins that are grounded at boot and returns the
// matching predefined ID. read_pin must return the raw digital level for a
// pin number, using the Arduino convention LOW == 0 (digitalRead does).
// GROUNDED_LEVEL is spelled out so this header stays Arduino-free and
// host-testable while remaining exactly equivalent on the ESP32.
template <typename ReadPinFn>
const char *select(ReadPinFn read_pin) {
  constexpr int GROUNDED_LEVEL = 0; // Arduino LOW

  const uint8_t grounded_count =
      (read_pin(ID_BIT0_PIN) == GROUNDED_LEVEL ? 1u : 0u) +
      (read_pin(ID_BIT1_PIN) == GROUNDED_LEVEL ? 1u : 0u);

  // Grounded-count → index: 0 → NETRI-001, 1 → NETRI-002, 2 → NETRI-003.
  // The guard is a compile-time honest bound (count can never exceed the pin
  // count); any future table smaller than the pin count stays safe.
  return (grounded_count < config::DEVICE_ID_COUNT)
             ? config::DEVICE_IDS[grounded_count]
             : config::DEVICE_IDS[0];
}

} // namespace identity
} // namespace netri

#endif // NETRI_IDENTITY_H
