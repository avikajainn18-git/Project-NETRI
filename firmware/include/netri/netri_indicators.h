// NETRI — LED indicators (non-blocking; no delay() calls).
//
// Maps device lifecycle + emergency state onto the two APPROVED LEDs
// (RULES.md §8 draft LED state machine, PROPOSED — finalized at Phase 1):
//
//   State                        | Status LED (green) | Alert LED (red)
//   -----------------------------+--------------------+------------------
//   Boot / startup               | solid (on)         | off
//   Idle / ready (operational)   | solid (on)         | off
//   Hold in progress (arming)    | fast blink         | off
//   Emergency (hold completed)   | off                | solid
//
// Owner-directed Phase-1 indication: GREEN = device operational/normal, ON
// by default; RED = active emergency, OFF normally. Holding SOS >= 2 s (D5)
// turns GREEN OFF and RED ON, and the emergency LATCHES: RED stays on after
// the button is released until a future RESOLVE mechanism clears it (Phase 1
// exit is restart/power-cycle only).
//
// (Awaiting-ack / acknowledged / fault rows need link state — Phase 3+.)
// Pure timing math on top of a tiny Arduino-compatible surface, so the blink
// logic itself can be exercised in host tests via test doubles.
#ifndef NETRI_INDICATORS_H
#define NETRI_INDICATORS_H

#include <stdint.h>

namespace netri {

// The Arduino surface used by indicators, injectable for host tests.
struct ILedIo {
  virtual ~ILedIo() {}
  virtual void write(int pin, bool on) = 0;      // set LED pin level
  virtual uint32_t millis() const = 0;           // time source
};

struct IndicatorConfig {
  uint32_t slow_blink_ms = 500;  // reserved (idle is solid per owner direction)
  uint32_t fast_blink_ms = 120;  // arming cadence during button hold
};

enum class Phase1VisualState : uint8_t {
  BOOT_SELF_TEST = 0, // green solid (operational)
  IDLE_READY,         // green solid (operational)
  HOLDING,            // green fast blink (arming feedback)
  EMERGENCY,          // red solid
};

class Indicators {
public:
  explicit Indicators(ILedIo &io, const IndicatorConfig &cfg = IndicatorConfig())
      : io_(io), cfg_(cfg) {}

  // Call every loop with the current visual state. Never blocks.
  void update(Phase1VisualState s) {
    const uint32_t now = io_.millis();
    switch (s) {
    case Phase1VisualState::BOOT_SELF_TEST:
    case Phase1VisualState::IDLE_READY:
      // Owner-directed: green = operational/normal (ON by default); red off.
      write(status_pin_, true);
      write(alert_pin_, false);
      solid_ = true;
      break;

    case Phase1VisualState::HOLDING:
      blink(status_pin_, now, cfg_.fast_blink_ms);
      write(alert_pin_, false);
      solid_ = false;
      break;

    case Phase1VisualState::EMERGENCY:
      write(status_pin_, false);
      write(alert_pin_, true);
      solid_ = true;
      break;
    }
  }

  void attach(int status_pin, int alert_pin) {
    status_pin_ = status_pin;
    alert_pin_ = alert_pin;
    solid_ = false;
  }

  // True while the last update() held a static level (vs. blinking).
  bool solid() const { return solid_; }

private:
  void blink(int pin, uint32_t now, uint32_t interval) {
    solid_ = false;
    const bool on = ((now / interval) % 2) == 0;
    write(pin, on);
  }

  void write(int pin, bool on) {
    io_.write(pin, on);
    last_levels_[pin == status_pin_ ? 0 : 1] = on;
  }

  ILedIo &io_;
  IndicatorConfig cfg_;
  int status_pin_ = -1;
  int alert_pin_ = -1;
  bool last_levels_[2] = {false, false};
  bool solid_ = false;
};

} // namespace netri

#endif // NETRI_INDICATORS_H
