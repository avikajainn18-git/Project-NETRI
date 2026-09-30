// Minimal test doubles for host-side (no-hardware) verification of the pure
// Phase-1 firmware modules. These are NOT trigger-injection mechanisms —
// they drive time and record output; only a test's simulated button level
// feeds the trigger FSM (the same pure FSM the ESP32 runs).
#ifndef NETRI_TEST_FAKE_CLOCK_H
#define NETRI_TEST_FAKE_CLOCK_H

#include "netri_indicators.h"
#include "netri_trigger.h"

namespace netri {
namespace test {

class FakeClock : public IClock {
public:
  uint32_t millis() const override { return now_ms; }
  void advance(uint32_t delta) { now_ms += delta; }
  void set(uint32_t t) { now_ms = t; }
  uint32_t now_ms = 0;
};

class FakeLedIo : public ILedIo {
public:
  uint32_t millis() const override { return clock.now_ms; }
  void write(int pin, bool on) override { levels[static_cast<size_t>(pin)] = on; }
  bool level(int pin) const { return levels[static_cast<size_t>(pin)]; }
  FakeClock clock;
  bool levels[64] = {false};
};

} // namespace test
} // namespace netri

#endif // NETRI_TEST_FAKE_CLOCK_H
