// NETRI — device lifecycle states (Phase 1).
//
// Implements the first two rows of the draft LED state machine (RULES.md §8,
// PROPOSED): boot/self-test, then idle-ready. Transitions out of IDLE_READY
// belong to later phases (Phase 3+ link state; the emergency alert state is
// handled by Triggers on acceptance).
#ifndef NETRI_DEVICE_H
#define NETRI_DEVICE_H

#include <stdint.h>

namespace netri {

enum class DeviceState : uint8_t {
  BOOT_SELF_TEST = 0, // boot / self-test
  IDLE_READY,         // normal / ready (green status LED active)
};

// IDLE_READY is the settled Phase-1 state; BOOT_SELF_TEST lasts a fixed,
// deterministic interval. Everything in this header is Phase-1 behavior that
// never blocks the trigger path (§13 Engineering rules: no blocking flows).
constexpr uint32_t BOOT_SELF_TEST_MS = 2000;

} // namespace netri

#endif // NETRI_DEVICE_H
