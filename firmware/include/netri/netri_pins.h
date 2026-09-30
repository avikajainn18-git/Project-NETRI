// NETRI — ESP32 GPIO assignment for the APPROVED Phase-1 BOM (RULES.md §8).
//
// Exactly the approved five components: ESP32 DevKit V1, one tactile push
// button, green status LED, red alert LED, two 220 Ω resistors (wired to the
// LEDs, see diagram.json). No other hardware is allowed (D1, D2, §15).
//
// Button: INPUT_PULLUP, active-LOW (pressed = LOW). Uses the ESP32's internal
// pull-up — no external resistor needed, so the BOM stays exactly as approved.
#ifndef NETRI_PINS_H
#define NETRI_PINS_H

#include <stdint.h>

namespace netri {
namespace pins {

constexpr int BUTTON = 25;  // to GND; pressed = LOW (internal pull-up)
constexpr int LED_STATUS = 26; // green — normal/ready state
constexpr int LED_ALERT = 27;  // red — emergency-alert state

} // namespace pins
} // namespace netri

#endif // NETRI_PINS_H
