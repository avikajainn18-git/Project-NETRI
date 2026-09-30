// NETRI — transport boundary (Phase 1: deliberately NOT implemented).
//
// RULES.md §9 Phase 1 scope: "Do not implement communication transport yet."
// This header exists ONLY to define the clear boundary required by the owner
// task and §6 (firmware keeps its transport behind a single abstraction so
// swapping simulated BLE for real BLE later touches one module).
//
// Phase 3 will implement this interface over the simulated BLE transport
// (labeled as a Round-1 simulation per §13). Phase 1 ships the no-op below.
#ifndef NETRI_TRANSPORT_H
#define NETRI_TRANSPORT_H

#include <stdint.h>

namespace netri {

// The single emergency event Phase 1 can produce. Field set deliberately
// minimal; later phases extend this without changing the trigger path.
struct EmergencyEvent {
  const char *device_id; // predefined ID selected at boot (D6)
};

// Phase-1 transport boundary. The trigger path calls send_emergency() and
// proceeds regardless of the result — there is intentionally no transport,
// no queue, no retry, and no network code in Phase 1.
class ITransport {
public:
  virtual ~ITransport() {}
  // Attempt to deliver an emergency event. Returns false in Phase 1
  // (no transport exists yet). Real semantics arrive with Phase 3.
  virtual bool send_emergency(const EmergencyEvent &event) = 0;
};

// Phase-1 no-op transport: logs delivery failure via the loop's serial
// reporting (main.cpp), never blocks, never fakes success (§13).
class NullTransport : public ITransport {
public:
  bool send_emergency(const EmergencyEvent & /*event*/) override {
    return false; // honest by design: nothing is transmitted in Phase 1
  }
};

} // namespace netri

#endif // NETRI_TRANSPORT_H
