// Host-side tests for the LED indicator logic (RULES.md §8 draft LED state
// machine, rows implemented in Phase 1). The Indicators class is the exact
// module the sketch drives; only the Arduino HAL is doubled here.
#include <cstdio>
#include <initializer_list>

#include "fake_clock.h"
#include "netri_indicators.h"

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

constexpr int GREEN = 26; // netri::pins::LED_STATUS
constexpr int RED = 27;   // netri::pins::LED_ALERT

} // namespace

int main() {
  using netri::IndicatorConfig;
  using netri::Indicators;
  using netri::Phase1VisualState;
  using netri::test::FakeLedIo;

  // --- Boot / startup: green solid (operational), red off ------------------
  {
    FakeLedIo io;
    IndicatorConfig cfg;
    cfg.slow_blink_ms = 100;
    cfg.fast_blink_ms = 50;
    Indicators leds(io, cfg);
    leds.attach(GREEN, RED);

    for (uint32_t t : {0u, 7u, 100u, 1000u}) { // any time during boot
      io.clock.set(t);
      leds.update(Phase1VisualState::BOOT_SELF_TEST);
      CHECK(io.level(GREEN));
      CHECK(!io.level(RED));
    }
  }

  // --- Idle/ready: green solid (operational), red off (re-armed state) -----
  {
    FakeLedIo io;
    IndicatorConfig cfg;
    cfg.slow_blink_ms = 100;
    cfg.fast_blink_ms = 50;
    Indicators leds(io, cfg);
    leds.attach(GREEN, RED);

    for (uint32_t t : {0u, 50u, 100u, 150u, 200u, 997u}) {
      io.clock.set(t);
      leds.update(Phase1VisualState::IDLE_READY);
      CHECK(io.level(GREEN)); // steady operational indication
      CHECK(!io.level(RED));
    }
  }

  // --- Arming (hold in progress): green fast blink, red off ----------------
  {
    FakeLedIo io;
    IndicatorConfig cfg;
    cfg.slow_blink_ms = 1000;
    cfg.fast_blink_ms = 40;
    Indicators leds(io, cfg);
    leds.attach(GREEN, RED);

    io.clock.set(0);
    leds.update(Phase1VisualState::HOLDING);
    CHECK(io.level(GREEN));

    io.clock.set(20);
    leds.update(Phase1VisualState::HOLDING);
    CHECK(io.level(GREEN)); // still the first ON window

    io.clock.set(40);
    leds.update(Phase1VisualState::HOLDING);
    CHECK(!io.level(GREEN)); // already OFF here — an IDLE (slow) blink would still be ON

    io.clock.set(80);
    leds.update(Phase1VisualState::HOLDING);
    CHECK(io.level(GREEN));
    CHECK(!io.level(RED));
  }

  // --- Emergency: red solid, green off, regardless of time -----------------
  {
    FakeLedIo io;
    IndicatorConfig cfg;
    cfg.slow_blink_ms = 100;
    cfg.fast_blink_ms = 50;
    Indicators leds(io, cfg);
    leds.attach(GREEN, RED);

    for (uint32_t t : {0u, 25u, 50u, 99u}) {
      io.clock.set(t);
      leds.update(Phase1VisualState::EMERGENCY);
      CHECK(io.level(RED));
      CHECK(!io.level(GREEN));
    }
  }

  std::printf("%d checks, %d failures\n", checks, failures);
  return failures == 0 ? 0 : 1;
}
