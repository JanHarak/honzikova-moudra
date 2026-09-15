import { describe, expect, it } from 'vitest';
import { eventOutcome, shouldSkipDelivery } from './scheduling';

describe('daily notification lifecycle', () => {
  it('keeps checking every minute through the night without exhausting attempts', () => {
    let attempts = 0;
    let now = Date.UTC(2026, 8, 15);
    for (let minute = 0; minute < 24 * 60; minute++) {
      const next = eventOutcome('daily', attempts + 1, true, now);
      expect(next.status).toBe('pending');
      expect(Date.parse(next.next_attempt_at) - now).toBe(60000);
      attempts = next.attempts;
      now = Date.parse(next.next_attempt_at);
    }
    expect(attempts).toBe(0);
  });

  it('remains available after delivery or when no subscriptions exist yet', () => {
    expect(eventOutcome('daily', 1, false).status).toBe('pending');
    expect(shouldSkipDelivery('daily', { status: 'sent', attempts: 1 })).toBe(true);
    expect(shouldSkipDelivery('daily', null)).toBe(false);
  });

  it('limits actual provider failures per endpoint without blocking other recipients', () => {
    expect(shouldSkipDelivery('daily', { status: 'retry', attempts: 10 })).toBe(true);
    expect(shouldSkipDelivery('daily', { status: 'retry', attempts: 9 })).toBe(false);
    expect(shouldSkipDelivery('daily', { status: 'invalid', attempts: 1 })).toBe(true);
    expect(shouldSkipDelivery('daily', null)).toBe(false);
  });

  it('preserves completion and retry limits for new quote notifications', () => {
    expect(eventOutcome('new_quotes', 1, false).status).toBe('sent');
    expect(eventOutcome('new_quotes', 9, true).status).toBe('pending');
    expect(eventOutcome('new_quotes', 10, true).status).toBe('failed');
  });
});
