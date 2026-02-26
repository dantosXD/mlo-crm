import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SESSION_TIMEOUT_MINUTES,
  MAX_SESSION_TIMEOUT_MINUTES,
  MIN_SESSION_TIMEOUT_MINUTES,
  resolveSessionTimeoutMinutes,
} from './sessionTimeout';

describe('resolveSessionTimeoutMinutes', () => {
  it('returns default timeout for undefined or invalid values', () => {
    expect(resolveSessionTimeoutMinutes(undefined)).toBe(DEFAULT_SESSION_TIMEOUT_MINUTES);
    expect(resolveSessionTimeoutMinutes('not-a-number')).toBe(DEFAULT_SESSION_TIMEOUT_MINUTES);
  });

  it('returns default timeout when value is below minimum guardrail', () => {
    expect(resolveSessionTimeoutMinutes(String(MIN_SESSION_TIMEOUT_MINUTES - 1))).toBe(DEFAULT_SESSION_TIMEOUT_MINUTES);
  });

  it('returns default timeout when value is above maximum guardrail', () => {
    expect(resolveSessionTimeoutMinutes(String(MAX_SESSION_TIMEOUT_MINUTES + 1))).toBe(DEFAULT_SESSION_TIMEOUT_MINUTES);
  });

  it('returns parsed timeout when value is within guardrails', () => {
    expect(resolveSessionTimeoutMinutes('30')).toBe(30);
    expect(resolveSessionTimeoutMinutes(String(MIN_SESSION_TIMEOUT_MINUTES))).toBe(MIN_SESSION_TIMEOUT_MINUTES);
    expect(resolveSessionTimeoutMinutes(String(MAX_SESSION_TIMEOUT_MINUTES))).toBe(MAX_SESSION_TIMEOUT_MINUTES);
  });
});
