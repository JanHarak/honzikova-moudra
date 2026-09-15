// A daily event must remain available all day: installations can have different
// reminder times, and new subscriptions can arrive after the first worker run.
export function eventOutcome(type: string, attempts: number, retry: boolean, now = Date.now()) {
  if (type === 'daily') {
    return { status: 'pending', attempts: 0, next_attempt_at: new Date(now + 60000).toISOString() };
  }
  return {
    status: retry ? (attempts >= 10 ? 'failed' : 'pending') : 'sent',
    attempts,
    next_attempt_at: new Date(now + Math.min(3600000, 2 ** attempts * 30000)).toISOString(),
  };
}

export function shouldSkipDelivery(type: string, delivery: { status: string; attempts: number } | null) {
  return delivery?.status === 'sent' || delivery?.status === 'invalid' ||
    (type === 'daily' && (delivery?.attempts || 0) >= 10);
}
