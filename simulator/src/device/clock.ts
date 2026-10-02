// NETRI — device clock (injectable time source, mirrors Phase 1 IClock).
export interface IClock {
  nowMs(): number;
}

export class SystemClock implements IClock {
  nowMs(): number {
    return Date.now();
  }
}
