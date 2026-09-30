// NETRI — hold-to-trigger finite state machine (pure logic, no hardware).
//
// APPROVED behavior (owner Phase-1 task + RULES.md §8/§14):
//   - The physical button is the ONLY trigger (D5). This module contains no
//     test hooks and no injection mechanisms.
//   - A press held CONTINUOUSLY for 2 s (BUTTON_HOLD_MS, measured from the
//     start of the press) triggers an emergency event. A press shorter than
//     2 s never triggers. The debounce window only rejects contact bounce;
//     it does not extend the threshold.
//   - Parameterized millis() via IClock so the identical FSM is unit-tested
//     on the host (see firmware/test/test_trigger_fsm.cpp) and runs unchanged
//     on the ESP32/Wokwi. This is a testing seam, NOT a trigger-injection
//     mechanism: no code path outside the physical GPIO can create a press.
//
// Dependency-free: plain C++, no Arduino headers.
#ifndef NETRI_TRIGGER_H
#define NETRI_TRIGGER_H

#include <stdint.h>

#include "netri_config.h"

namespace netri {

// Minimal time source. The firmware provides the Arduino millis() adapter.
class IClock {
public:
  virtual ~IClock() {}
  virtual uint32_t millis() const = 0;
};

enum class TriggerState : uint8_t {
  IDLE = 0,   // button up, armed (no emergency has fired yet)
  DEBOUNCE,   // press level seen; waiting for it to stabilize
  HOLDING,    // press stable; hold clock running from press start
  EMERGENCY,  // 2 s continuous hold completed — LATCHED emergency active;
              // terminal for Phase 1 (no resolve mechanism yet, RULES.md
              // §14 D5 scope). Release does NOT re-arm; restart/power-cycle
              // resets the latch.
};

struct TriggerConfig {
  uint32_t hold_ms = config::BUTTON_HOLD_MS; // APPROVED: 2000
  uint32_t debounce_ms = config::DEBOUNCE_MS;
};

// Event emitted when the hold threshold completes.
enum class TriggerEvent : uint8_t {
  NONE = 0,
  EMERGENCY_TRIGGERED,
};

class TriggerFsm {
public:
  explicit TriggerFsm(const TriggerConfig &cfg = TriggerConfig())
      : cfg_(cfg) {}

  // Advance the FSM to the given time with the given raw button level.
  // pressed: true = button pressed (active-LOW wiring is translated at the
  // pin boundary in sketch.ino; this module stays wiring-agnostic).
  //
  // Returns the event fired by THIS update (NONE if none). An event remains
  // readable via event() until clear_event() is called, so the caller must
  // consume + clear it exactly once (sketch.ino clears it immediately).
  TriggerEvent update(uint32_t now_ms, bool pressed) {
    switch (state_) {
    case TriggerState::IDLE:
      if (pressed) {
        state_ = TriggerState::DEBOUNCE;
        press_started_at_ms_ = now_ms; // hold clock is anchored HERE
      }
      break;

    case TriggerState::DEBOUNCE:
      if (!pressed) {
        // Bounce or a too-short blip: wait for the next stable press.
        state_ = TriggerState::IDLE;
      } else if (now_ms - press_started_at_ms_ >= cfg_.debounce_ms) {
        // Level stable long enough to be a real press; the hold clock keeps
        // running from press start, so debounce never extends the threshold.
        state_ = TriggerState::HOLDING;
      }
      break;

    case TriggerState::HOLDING:
      if (!pressed) {
        // Released before the 2 s threshold: no emergency, back to IDLE.
        state_ = TriggerState::IDLE;
      } else if (now_ms - press_started_at_ms_ >= cfg_.hold_ms) {
        // Continuous press reached the threshold: fire exactly once.
        state_ = TriggerState::EMERGENCY;
        event_ = TriggerEvent::EMERGENCY_TRIGGERED;
      }
      break;

    case TriggerState::EMERGENCY:
      // Latched: stays active regardless of button level until a future
      // RESOLVE mechanism clears it (Phase 2+). Releasing the SOS button
      // must NOT return the device to the armed/idle indication; restart
      // or power-cycle is the only Phase-1 way out.
      break;
    }
    return event_;
  }

  TriggerEvent event() const { return event_; }
  void clear_event() { event_ = TriggerEvent::NONE; }
  TriggerState state() const { return state_; }

private:
  TriggerConfig cfg_;
  TriggerState state_ = TriggerState::IDLE;
  TriggerEvent event_ = TriggerEvent::NONE;
  uint32_t press_started_at_ms_ = 0; // anchor of the 2 s hold clock
};

} // namespace netri

#endif // NETRI_TRIGGER_H
