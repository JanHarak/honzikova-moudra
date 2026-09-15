-- Recover today's event after deploying the corrected hm-push-worker.
-- Existing per-endpoint delivery records prevent sending successful deliveries again.
update public.hm_notification_outbox
set status = 'pending', attempts = 0, next_attempt_at = now(), last_error = null
where notification_type = 'daily'
  and daily_date = (now() at time zone 'Europe/Prague')::date
  and status in ('failed', 'sent');
