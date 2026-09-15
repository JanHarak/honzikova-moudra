# Diagnostika denních notifikací

Úvodní dialog zapíná nově publikovaná moudra i denní webové notifikace.
Použije uložený čas připomínky, případně výchozích 08:00.
Pokud jsi upozornění povolil ve starší verzi, zapni denní připomínku
v **Nastavení → Moudro dne** a nastav čas.
Nativní iOS aplikace plánuje denní připomínku lokálně; Supabase ji neposílá.
Tlačítko testovacího upozornění zobrazuje lokální notifikaci a neověřuje cron,
serverovou registraci ani odesílání přes Web Push.

## Nasazení opravy

1. Nasaď `supabase functions deploy hm-push-worker` v příslušném projektu.
2. Aplikuj migraci `202609150001_recover_daily_notifications.sql` běžným
   migračním postupem. Obnoví dnešní předčasně dokončenou nebo selhanou úlohu.
   Existující záznamy úspěšných doručení zabrání opakovanému odeslání.
3. Aplikuj migraci `202609150002_notification_cron_every_minute.sql`.
   Nastaví vytváření denní notifikace i spouštění workeru na každou minutu.
4. Nasaď frontend běžným postupem, aby dialog zobrazoval chyby registrace
   a zapínal také denní připomínku.

Opravený worker drží denní úlohu v `pending` až do dalšího pražského dne,
kdy ji označí `cancelled`. Úspěch jednotlivých doručení sleduj v deliveries,
nikoli podle stavu celé denní úlohy. Počet skutečných pokusů na jeden endpoint
je omezen na deset. Worker také vytváří dnešní úlohu sám, takže není závislý
na pořadí spuštění dvou cronů.

## Read-only kontrola v Supabase SQL editoru

Následující dotazy nevypisují push tokeny ani tajné klíče.

```sql
select jobname, schedule, active
from cron.job
where jobname in ('hm-daily-notification', 'hm-push-worker');

select j.jobname, d.start_time, d.status, d.return_message
from cron.job_run_details d
join cron.job j using (jobid)
where j.jobname in ('hm-daily-notification', 'hm-push-worker')
order by d.start_time desc limit 20;

-- Úspěšný cron sám o sobě nepotvrzuje úspěšnou HTTP odpověď workeru.
select id, status_code, timed_out, error_msg, created
from net._http_response
order by created desc limit 20;

select event_id, daily_date, status, attempts, next_attempt_at, last_error
from public.hm_notification_outbox
where notification_type = 'daily'
order by daily_date desc limit 5;

select p.installation_id, p.daily_enabled, p.daily_time, p.permission,
       i.timezone, e.provider, e.id is not null as has_endpoint
from public.hm_notification_preferences p
join public.hm_installations i on i.id = p.installation_id
left join public.hm_push_endpoints e on e.installation_id = p.installation_id;

select d.event_id, d.endpoint_id, d.status, d.attempts
from public.hm_notification_deliveries d
join public.hm_notification_outbox o using (event_id)
where o.daily_date = (now() at time zone 'Europe/Prague')::date;
```

Webová instalace musí mít `daily_enabled = true`, `permission = granted`
a endpoint s providerem `webpush`. Cron `hm-push-worker` má běžet každou minutu.
Při HTTP 403 ověř shodu Vault `hm_worker_secret` s Edge Function `WORKER_SECRET`.
Při problému s odesíláním ověř existenci `VAPID_SUBJECT`, `VAPID_PUBLIC_KEY`
a `VAPID_PRIVATE_KEY` v Edge Function a shodu veřejného klíče s frontendovým
`VITE_VAPID_PUBLIC_KEY`. Hodnoty tajných klíčů nesdílej v diagnostickém výstupu.
