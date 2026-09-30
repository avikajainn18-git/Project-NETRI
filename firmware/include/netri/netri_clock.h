// NETRI — Arduino clock adapter for the trigger FSM (host-test seam).
#ifndef NETRI_CLOCK_H
#define NETRI_CLOCK_H

#include <Arduino.h>

#include "netri_trigger.h"

namespace netri {

class ArduinoClock : public IClock {
public:
  uint32_t millis() const override { return ::millis(); }
};

} // namespace netri

#endif // NETRI_CLOCK_H
