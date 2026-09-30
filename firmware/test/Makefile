# NETRI Phase 1 — host-side verification of the pure firmware modules.
# No external dependencies: plain g++ against the ESP32-independent headers.
CXX ?= g++
CXXFLAGS ?= -std=c++17 -Wall -Wextra -Werror -I../include -I../include/netri -I.

TESTS = test_trigger_fsm test_indicators

all: $(TESTS)

%: %.cpp
	$(CXX) $(CXXFLAGS) -o $@ $<

test: $(TESTS)
	@for t in $(TESTS); do ./$$t || exit 1; done

clean:
	rm -f $(TESTS)

.PHONY: all test clean
