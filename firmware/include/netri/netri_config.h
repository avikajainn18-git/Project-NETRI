// NETRI — device configuration (compile-time constants).
//
// Approval status of each value follows RULES.md (§8 Hardware/BOM, §14 Decisions):
//   - BUTTON_HOLD_MS 2000 is APPROVED (owner task: "Button hold duration: 2 seconds").
//   - BLINK_*_MS and DEBOUNCE_MS are PROPOSED tuning parameters, finalized during Phase 1.
//   - The predefined device-ID table is the APPROVED D6 mechanism (boot-time selectable,
//     no provisioning system).
#ifndef NETRI_CONFIG_H
#define NETRI_CONFIG_H

#include <stdint.h>

namespace netri {
namespace config {

// --- Trigger (APPROVED) ------------------------------------------------------
// The button must be held continuously for this long to trigger an emergency.
constexpr uint32_t BUTTON_HOLD_MS = 2000;

// --- Timing tuning (PROPOSED, finalized in Phase 1) ---------------------------
// Raw button level must be stable for this long before it is believed.
// Suppresses contact-bounce false positives on both press and release.
constexpr uint32_t DEBOUNCE_MS = 40;

// Status-LED blink cadence (see RULES.md §8 draft LED state machine, PROPOSED).
constexpr uint32_t BLINK_INTERVAL_MS = 500;

// --- Device identity (APPROVED, D6) -------------------------------------------
// Boot-time selectable predefined IDs. The firmware counts which identity pins
// are pulled LOW (see netri_pins.h) and uses the matching entry; out-of-range
// counts fall back to the first entry. Intentionally simple: no provisioning
// system, no persistent storage.
constexpr const char *DEVICE_IDS[] = {
    "NETRI-001",
    "NETRI-002",
    "NETRI-003",
};
constexpr uint8_t DEVICE_ID_COUNT = 3;

} // namespace config
} // namespace netri

#endif // NETRI_CONFIG_H
