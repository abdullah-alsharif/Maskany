import { env } from '../config/env.js';

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
  if (entry.failures < env.cbThreshold) return true;
  if (Date.now() - entry.lastFailure > env.cbResetMs) {
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
