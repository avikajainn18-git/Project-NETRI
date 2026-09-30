// Host-side tests for the D6 boot-time device-identity selector
// (corrective review of the GPIO 34/35 pull-up defect).
//
// These tests exercise the exact template the sketch instantiates with
// digitalRead; the fake read function only maps pin numbers to levels that a
// wired/unwired selector would present. No trigger path is touched.
//
// Electrical facts under test (Espressif ESP-IDF GPIO docs): input-only
// GPIOs 34-39 have no internal pull-ups; GPIO 32/33 do. The pin-constant
// checks below exist to fail loudly if anyone regresses the selector back to
// input-only pins.
#include <cstdio>
#include <cstring>

#include "netri_config.h"
#include "netri_identity.h"

namespace {

// Compare C strings by value (the selector returns const char* pointers;
// direct == against literals would compare addresses, not content).
bool str_eq(const char *a, const char *b) { return std::strcmp(a, b) == 0; }

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

using netri::identity::ID_BIT0_PIN;
using netri::identity::ID_BIT1_PIN;

// Fake pin reader: test sets the level of each selector pin directly.
struct FakePins {
  int bit0 = 1; // 1 = HIGH (pulled up / tied to 3V3), 0 = LOW (grounded)
  int bit1 = 1;

  int read(int pin) const {
    if (pin == ID_BIT0_PIN) return bit0;
    if (pin == ID_BIT1_PIN) return bit1;
    return -1; // unexpected pin: make the test fail loudly downstream
  }
};

} // namespace

int main() {
  // --- 0. Regression guard: selector pins must NOT be input-only 34-39 -----
  // Espressif: input-only GPIOs 34-39 have no internal pull-up/down. The
  // original defect lived exactly here.
  {
    CHECK(ID_BIT0_PIN != 34 && ID_BIT0_PIN != 35 && ID_BIT0_PIN != 36 &&
          ID_BIT0_PIN != 39);
    CHECK(ID_BIT1_PIN != 34 && ID_BIT1_PIN != 35 && ID_BIT1_PIN != 36 &&
          ID_BIT1_PIN != 39);
    CHECK(ID_BIT0_PIN == 32); // corrected mapping
    CHECK(ID_BIT1_PIN == 33); // corrected mapping
  }

  // --- 1. Unwired default: both pulled HIGH → NETRI-001 ---------------------
  {
    FakePins pins; // nothing wired
    CHECK(str_eq(netri::identity::select([&pins](int p) { return pins.read(p); }),
                 netri::config::DEVICE_IDS[0]));
  }

  // --- 2. Both tied to 3V3 reads like unwired → NETRI-001 -------------------
  {
    FakePins pins; // HIGH is already the tied-to-3V3 state
    CHECK(str_eq(netri::identity::select([&pins](int p) { return pins.read(p); }),
                 "NETRI-001"));
  }

  // --- 3. GPIO 32 grounded → NETRI-002 --------------------------------------
  {
    FakePins pins;
    pins.bit0 = 0;
    CHECK(str_eq(netri::identity::select([&pins](int p) { return pins.read(p); }),
                 "NETRI-002"));
  }

  // --- 4. GPIO 32 + 33 grounded → NETRI-003 ---------------------------------
  {
    FakePins pins;
    pins.bit0 = 0;
    pins.bit1 = 0;
    CHECK(str_eq(netri::identity::select([&pins](int p) { return pins.read(p); }),
                 "NETRI-003"));
  }

  // --- 5. Only GPIO 33 grounded is NOT a defined combination ----------------
  // D6 defines three identities; count 1 (whatever the wiring) selects
  // NETRI-002. Ordering is documented in netri_identity.h.
  {
    FakePins pins;
    pins.bit1 = 0;
    CHECK(str_eq(netri::identity::select([&pins](int p) { return pins.read(p); }),
                 "NETRI-002"));
  }

  // --- 6. Table sanity: exactly the three approved predefined IDs -----------
  {
    CHECK(netri::config::DEVICE_ID_COUNT == 3);
    CHECK(netri::config::DEVICE_IDS[0] != 0 &&
          netri::config::DEVICE_IDS[1] != 0 &&
          netri::config::DEVICE_IDS[2] != 0);
  }

  std::printf("%d checks, %d failures\n", checks, failures);
  return failures == 0 ? 0 : 1;
}
