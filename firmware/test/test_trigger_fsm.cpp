// Host-side unit tests for the NETRI trigger FSM — the EXACT module the
// ESP32 firmware runs (no hardware needed). These tests verify the APPROVED
// owner requirements:
//   - press held 2 s continuously → EMERGENCY_TRIGGERED fires exactly once
//   - press shorter than 2 s → never fires
//   - contact bounce / unstable level → never fires
//   - emergency LATCHES: release does not re-arm; state stays EMERGENCY
//     until reset (no RESOLVE mechanism exists in Phase 1)
// No alternate trigger mechanism exists here: tests drive the same pure FSM
// with simulated button levels, nothing more (D5 respected).
#include <cstdio>

#include "fake_clock.h"
#include "netri_config.h"
#include "netri_trigger.h"

namespace {

int failures = 0;
int checks = 0;

#define CHECK(cond)                                                            \
  do {                                                                         \
    ++checks;                                                                  \
    if (!(cond)) {                                                             \
      ++failures;                                                              \
      std::printf("FAIL %s:%d  %s\n", __FILE__, __LINE__, #cond);              \
    }                                                                          \
  } while (0)

#define CHECK_EQ(a, b)                                                         \
  do {                                                                         \
    ++checks;                                                                  \
    if (!((a) == (b))) {                                                       \
      ++failures;                                                              \
      std::printf("FAIL %s:%d  %s == %s\n", __FILE__, __LINE__, #a, #b);       \
    }                                                                          \
  } while (0)

using netri::TriggerConfig;
using netri::TriggerEvent;
using netri::TriggerFsm;
using netri::TriggerState;
using netri::config::BUTTON_HOLD_MS;

// Feed a stable button level for a duration in one-ms steps.
void hold_for(TriggerFsm &fsm, netri::test::FakeClock &clk, uint32_t duration,
              bool pressed) {
  for (uint32_t i = 0; i < duration; ++i) {
    clk.advance(1);
    const TriggerEvent e = fsm.update(clk.millis(), pressed);
    if (e == TriggerEvent::EMERGENCY_TRIGGERED) {
      fsm.clear_event();
    }
  }
}

bool fired_during(TriggerFsm &fsm, netri::test::FakeClock &clk, uint32_t steps,
                  bool pressed) {
  bool fired = false;
  for (uint32_t i = 0; i < steps; ++i) {
    clk.advance(1);
    if (fsm.update(clk.millis(), pressed) ==
        TriggerEvent::EMERGENCY_TRIGGERED) {
      fired = true;
      fsm.clear_event();
    }
  }
  return fired;
}

} // namespace

int main() {
  // --- 1. Exact threshold: no fire before 2000 ms, fire at 2000 ms ----------
  {
    netri::test::FakeClock clk;
    TriggerFsm fsm;
    CHECK_EQ(fsm.state(), TriggerState::IDLE);

    hold_for(fsm, clk, 150, true); // includes 40 ms debounce window
    CHECK_EQ(fsm.state(), TriggerState::HOLDING);

    CHECK(!fired_during(fsm, clk, BUTTON_HOLD_MS - 151, true)); // 1999 ms total
    CHECK_EQ(fsm.state(), TriggerState::HOLDING);

    CHECK(fired_during(fsm, clk, 2, true)); // 2 s after the press was first observed
    CHECK_EQ(fsm.state(), TriggerState::EMERGENCY);
  }

  // --- 2. Short press never triggers (spec: < 2 s must not fire) ------------
  {
    netri::test::FakeClock clk;
    TriggerFsm fsm;

    hold_for(fsm, clk, 300, true); // ~0.3 s press
    CHECK(!fired_during(fsm, clk, 1, false));
    CHECK_EQ(fsm.state(), TriggerState::IDLE);

    hold_for(fsm, clk, 1999, true); // just under the threshold
    CHECK(!fired_during(fsm, clk, 1, false));
    CHECK_EQ(fsm.state(), TriggerState::IDLE);
  }

  // --- 3. One-shot: no duplicate events while the button stays held ---------
  {
    netri::test::FakeClock clk;
    TriggerFsm fsm;

    CHECK(fired_during(fsm, clk, BUTTON_HOLD_MS + 150, true));
    CHECK(!fired_during(fsm, clk, 3000, true)); // held 3 more seconds
    CHECK_EQ(fsm.state(), TriggerState::EMERGENCY);
  }

  // --- 4. Emergency LATCHES: release must not re-arm (owner directive) -----
  {
    netri::test::FakeClock clk;
    TriggerFsm fsm;

    CHECK(fired_during(fsm, clk, BUTTON_HOLD_MS + 150, true));
    CHECK_EQ(fsm.state(), TriggerState::EMERGENCY);

    CHECK(!fired_during(fsm, clk, 1, false)); // release observed
    CHECK_EQ(fsm.state(), TriggerState::EMERGENCY); // latched, NOT re-armed
    hold_for(fsm, clk, 5000, false); // released indefinitely
    CHECK_EQ(fsm.state(), TriggerState::EMERGENCY); // still latched
    CHECK(!fired_during(fsm, clk, 1, true)); // re-press must not re-fire
    CHECK_EQ(fsm.state(), TriggerState::EMERGENCY); // no exit path exists
  }

  // --- 5. Latch is total: fresh hold after release cannot re-trigger --------
  {
    netri::test::FakeClock clk;
    TriggerFsm fsm;

    CHECK(fired_during(fsm, clk, BUTTON_HOLD_MS + 150, true));
    hold_for(fsm, clk, 1000, false); // long release
    CHECK_EQ(fsm.state(), TriggerState::EMERGENCY); // still latched

    CHECK(!fired_during(fsm, clk, BUTTON_HOLD_MS + 150, true)); // no new event
    CHECK_EQ(fsm.state(), TriggerState::EMERGENCY);
  }

  // --- 6. Contact bounce: unstable level never reaches an emergency ---------
  {
    netri::test::FakeClock clk;
    TriggerFsm fsm;

    for (int i = 0; i < 500; ++i) { // 5 s of electrical noise
      clk.advance(1);
      const bool pressed = (i % 4) < 2;
      if (fsm.update(clk.millis(), pressed) ==
          TriggerEvent::EMERGENCY_TRIGGERED) {
        fsm.clear_event();
        CHECK(false); // noise must never trigger
      }
    }
    CHECK_EQ(fsm.state(), TriggerState::IDLE);
  }

  // --- 7. Debounce consumed inside the 2 s window (no hidden extension) -----
  {
    netri::test::FakeClock clk;
    TriggerFsm fsm;

    hold_for(fsm, clk, 41, true); // one step past the debounce window
    CHECK_EQ(fsm.state(), TriggerState::HOLDING);
    CHECK(fired_during(fsm, clk, BUTTON_HOLD_MS, true)); // threshold on top
    CHECK_EQ(fsm.state(), TriggerState::EMERGENCY);
  }

  // --- 8. Held past threshold then released: exactly one event, latch holds -
  {
    netri::test::FakeClock clk;
    TriggerFsm fsm;

    int fires = 0;
    for (uint32_t i = 0; i < 5000; ++i) { // 2 s held + 3 s released
      clk.advance(1);
      const bool pressed = i < 2500;
      if (fsm.update(clk.millis(), pressed) ==
          TriggerEvent::EMERGENCY_TRIGGERED) {
        ++fires;
        fsm.clear_event();
      }
    }
    CHECK_EQ(fires, 1);
    CHECK_EQ(fsm.state(), TriggerState::EMERGENCY); // latched, not reset
  }

  std::printf("%d checks, %d failures\n", checks, failures);
  return failures == 0 ? 0 : 1;
}
