-- Apply to existing projects as well as fresh installations.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'hm-daily-notification') then
    perform cron.unschedule('hm-daily-notification');
  end if;
  perform cron.schedule('hm-daily-notification', '* * * * *',
    'select public.hm_enqueue_daily_notification()');

  if exists (select 1 from cron.job where jobname = 'hm-push-worker') then
    perform cron.unschedule('hm-push-worker');
  end if;
  perform cron.schedule('hm-push-worker', '* * * * *',
    'select public.hm_trigger_push_worker()');
end;
$$;
