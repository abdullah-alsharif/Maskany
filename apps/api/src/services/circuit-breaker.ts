const DEFAULT_THRESHOLD = 20;
const DEFAULT_RESET_MS = 120_000;

interface CircuitState {
  failures: number;
  lastFailure: number;
}

const state = new Map<string, CircuitState>();

export function isCircuitOpen(providerLabel: string): boolean {
  return !isCircuitClosed(providerLabel);
}

export function isCircuitClosed(providerLabel: string): boolean {
  const entry = state.get(providerLabel);
  if (!entry) return true;
  if (entry.failures < DEFAULT_THRESHOLD) return true;
  if (Date.now() - entry.lastFailure > DEFAULT_RESET_MS) {
    state.delete(providerLabel);
    return true;
  }
  return false;
}

export function recordSuccess(providerLabel: string): void {
  state.delete(providerLabel);
}

export function recordFailure(providerLabel: string): void {
  const entry = state.get(providerLabel) ?? { failures: 0, lastFailure: 0 };
  entry.failures++;
  entry.lastFailure = Date.now();
  state.set(providerLabel, entry);
}
