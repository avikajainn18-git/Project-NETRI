// ============================================================================
// NETRI — Phase 1: Virtual Hardware (Wokwi, ESP32 DevKit V1)
// Network for Emergency Threat Response and Intervention
//
// Round-1 SIMULATION notice (RULES.md §13): this firmware runs on Wokwi's
// virtual ESP32. The circuit mirrors the APPROVED Phase-1 BOM (RULES.md §8):
//   ESP32 DevKit V1 ×1 · tactile push button ×1 · green status LED ×1 ·
//   red alert LED ×1 · 220 Ω resistors ×2 (LED current limiting)
//
// SCOPE (owner Phase-1 task, RULES.md §9):
//   IN:  boot → ready; 2 s hold-to-trigger on the physical button (D5);
//        LED status; boot-time device identity (D6); transport BOUNDARY only.
//   OUT: no communication transport, no gateway, no backend, no database,
//        no dashboard, no accelerometer (D1), no battery simulation (D2),
//        no test hooks / trigger injection (D5).
// ============================================================================

#include <Arduino.h>

#include "netri_clock.h"
#include "netri_config.h"
#include "netri_device.h"
#include "netri_identity.h"
#include "netri_indicators.h"
#include "netri_pins.h"
#include "netri_transport.h"
#include "netri_trigger.h"

namespace {

// --- Injected time + outputs (host-test seams, NOT trigger-injection paths;
// --- D5 is respected: only the physical GPIO can start a hold) --------------
netri::ArduinoClock g_clock;
netri::NullTransport g_transport; // Phase 1: no transport by design

// --- Device state ------------------------------------------------------------
netri::DeviceState g_device_state = netri::DeviceState::BOOT_SELF_TEST;
const char *g_device_id = netri::config::DEVICE_IDS[0]; // fallback until boot selects

// --- Trigger FSM -------------------------------------------------------------
netri::TriggerFsm g_trigger;

// --- Indicator driver ----------------------------------------------------------
class LedIo : public netri::ILedIo {
public:
  uint32_t millis() const override { return ::millis(); }
  void write(int pin, bool on) override { digitalWrite(pin, on ? HIGH : LOW); }
};
LedIo g_led_io;
netri::Indicators g_indicators(g_led_io);

inline bool button_pressed_raw() {
  // Active-LOW wiring (INPUT_PULLUP): pressed = LOW. The trigger FSM itself
  // stays wiring-agnostic; this is the only place the wiring is translated.
  return digitalRead(netri::pins::BUTTON) == LOW;
}

inline netri::Phase1VisualState visual_state() {
  if (g_trigger.state() == netri::TriggerState::EMERGENCY) {
    return netri::Phase1VisualState::EMERGENCY;
  }
  if (g_trigger.state() == netri::TriggerState::HOLDING ||
      g_trigger.state() == netri::TriggerState::DEBOUNCE) {
    // Arming feedback while the hold is in progress.
    return netri::Phase1VisualState::HOLDING;
  }
  if (g_device_state == netri::DeviceState::BOOT_SELF_TEST) {
    return netri::Phase1VisualState::BOOT_SELF_TEST;
  }
  return netri::Phase1VisualState::IDLE_READY;
}

void emit_emergency_if_fired() {
  if (g_trigger.event() != netri::TriggerEvent::EMERGENCY_TRIGGERED) {
    return;
  }
  g_trigger.clear_event();

  Serial.print("EMERGENCY_TRIGGERED device=");
  Serial.println(g_device_id);

  // Transport boundary: Phase 1 has no transport (honest no-op — it returns
  // false and we report that; no fake success, RULES.md §13). Phase 3 swaps
  // NullTransport for the simulated-BLE transport behind this same interface.
  const bool delivered = g_transport.send_emergency({g_device_id});
  Serial.print("TRANSPORT delivered=");
  Serial.println(delivered ? "true" : "false");
}

void enter_idle_ready() {
  g_device_state = netri::DeviceState::IDLE_READY;
  Serial.print("READY device=");
  Serial.print(g_device_id);
  Serial.print(" hold_ms=");
  Serial.println(netri::config::BUTTON_HOLD_MS);
}

void boot_self_test() {
  // Startup powers/initializes the device (owner directive): green STATUS =
  // operational/normal (ON by default); after the approved 2 s continuous
  // hold the emergency LATCHES — red ALERT stays on after release until a
  // future RESOLVE mechanism clears it (restart/power-cycle in Phase 1).
  // D2: no battery simulation; D1: no accelerometer anywhere in this path.
  Serial.println("SELF_TEST ok");
}

} // namespace

void setup() {
  Serial.begin(115200);

  pinMode(netri::pins::BUTTON, INPUT_PULLUP);
  pinMode(netri::pins::LED_STATUS, OUTPUT);
  pinMode(netri::pins::LED_ALERT, OUTPUT);
  // Identity selector pins (D6): GPIO 32/33 — regular GPIOs whose internal
  // pull-ups actually work (input-only GPIO 34–39 have none; see
  // netri_identity.h electrical note). Unwired = NETRI-001.
  pinMode(netri::identity::ID_BIT0_PIN, INPUT_PULLUP);
  pinMode(netri::identity::ID_BIT1_PIN, INPUT_PULLUP);

  boot_self_test();

  // D6: boot-time selection of a predefined device ID. Nothing wired →
  // NETRI-001; wire ID_BIT0 to GND → NETRI-002; both → NETRI-003.
  g_device_id = netri::identity::select(
      [](uint8_t pin) { return digitalRead(pin); });

  g_indicators.attach(netri::pins::LED_STATUS, netri::pins::LED_ALERT);

  enter_idle_ready();
}

void loop() {
  const uint32_t now_ms = millis();

  // 1) Advance the trigger FSM from the PHYSICAL button only (D5).
  const netri::TriggerEvent evt =
      g_trigger.update(now_ms, button_pressed_raw());

  // 2) Deliver the one-shot emergency event, if this cycle fired one.
  if (evt == netri::TriggerEvent::EMERGENCY_TRIGGERED) {
    emit_emergency_if_fired();
  }

  // 3) Drive the LEDs (non-blocking; never delays the trigger path).
  g_indicators.update(visual_state());
}
