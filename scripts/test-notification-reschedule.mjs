import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

export async function testNotificationReschedule(db) {
  await db.exec(await fs.readFile('supabase/migrations/202609140009_web_push.sql', 'utf8'));
  // pg_cron is not available in PGlite; apply the real schema/RPC portion.
  const daily = await fs.readFile('supabase/migrations/202609140011_daily_time_and_faster_worker.sql', 'utf8');
  await db.exec(daily.split('\ndo $$')[0]);
  await db.exec(await fs.readFile('supabase/migrations/202609150003_reschedule_daily_notification.sql', 'utf8'));

  await db.exec('begin');
  try {
    // Keep local time between 09:00 and 12:00 regardless of when CI runs.
    const zone = (await db.query(`select name from pg_timezone_names
      where (now() at time zone name)::time between '09:00'::time and '12:00'::time limit 1`)).rows[0].name;
    const installations = [];
    const endpoints = [];
    for (let i = 0; i < 2; i++) {
      const installation = (await db.query(`insert into hm_installations(credential_hash,timezone)
        values('test-hash',$1) returning id`, [zone])).rows[0].id;
      installations.push(installation);
      endpoints.push((await db.query(`insert into hm_push_endpoints(installation_id,token,provider)
        values($1,$2,'webpush') returning id`, [installation, `test-${i}`])).rows[0].id);
      await db.query(`select hm_set_daily_notification($1,'test-hash',true,'08:00')`, [installation]);
    }
    const today = (await db.query(`insert into hm_notification_outbox(notification_type,daily_date,status)
      values('daily',(now() at time zone 'Europe/Prague')::date,'sent') returning event_id`)).rows[0].event_id;
    const yesterday = (await db.query(`insert into hm_notification_outbox(notification_type,daily_date,status)
      values('daily',(now() at time zone 'Europe/Prague')::date-1,'sent') returning event_id`)).rows[0].event_id;
    for (const event of [today, yesterday]) {
      for (const endpoint of endpoints) {
        await db.query(`insert into hm_notification_deliveries(event_id,endpoint_id,status,attempts)
          values($1,$2,'sent',1)`, [event, endpoint]);
      }
    }
    const setTime = (time, enabled = true, hash = 'test-hash') =>
      db.query(`select hm_set_daily_notification($1,$2,$3,$4)`, [installations[0], hash, enabled, time]);
    const status = async (event = today, endpoint = endpoints[0]) =>
      (await db.query('select status from hm_notification_deliveries where event_id=$1 and endpoint_id=$2', [event, endpoint])).rows[0].status;

    await setTime('14:00');
    assert.equal(await status(), 'pending', '08:00 -> 14:00 schedules another delivery');
    assert.equal(await status(today, endpoints[1]), 'sent', 'other installation stays delivered');
    assert.equal(await status(yesterday), 'sent', 'history stays delivered');
    assert.equal((await db.query('select status from hm_notification_outbox where event_id=$1', [today])).rows[0].status, 'pending');

    await db.query(`update hm_notification_deliveries set status='sent' where event_id=$1 and endpoint_id=$2`, [today, endpoints[0]]);
    await setTime('14:00');
    assert.equal(await status(), 'sent', 'saving the same time is idempotent');
    await setTime('07:00');
    assert.equal(await status(), 'sent', 'past time does not resend today');
    await setTime('15:00', false);
    assert.equal(await status(), 'sent', 'disabled reminder does not resend');
    await setTime('16:00');
    assert.equal(await status(), 'pending', 'another future time can rearm delivery');

    await db.exec('savepoint invalid_credential');
    await assert.rejects(() => setTime('17:00', true, 'wrong'), /FORBIDDEN/);
    await db.exec('rollback to savepoint invalid_credential');
    await db.exec('savepoint invalid_time');
    await assert.rejects(() => setTime('25:00'), /INVALID_TIME/);
    await db.exec('rollback to savepoint invalid_time');
    console.log('PASS: daily rescheduling, same-time idempotency, past/disabled times, recipient isolation and credentials.');
  } finally {
    await db.exec('rollback');
  }
}
