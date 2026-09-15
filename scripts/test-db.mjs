import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { testNotificationReschedule } from "./test-notification-reschedule.mjs";
const db = new PGlite();
await db.exec(
  `create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key,email_confirmed_at timestamptz); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated; create schema storage; create table storage.objects(bucket_id text,name text); create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); grant usage on schema storage to anon,authenticated,service_role; grant select on storage.objects to anon,authenticated;`,
);
let sql = await fs.readFile(
  "supabase/migrations/202609140001_core.sql",
  "utf8",
);
sql = sql.replace("create extension if not exists pgcrypto;", "");
await db.exec(sql);
await db.exec(
  await fs.readFile(
    "supabase/migrations/202609140002_integrations.sql",
    "utf8",
  ),
);
const alice = "10000000-0000-4000-8000-000000000001",
  bob = "10000000-0000-4000-8000-000000000002",
  admin = "10000000-0000-4000-8000-000000000003",
  unverified = "10000000-0000-4000-8000-000000000004";
await db.exec(
  `insert into auth.users values('${alice}',now()),('${bob}',now()),('${admin}',now()),('${unverified}',null);insert into public.hm_user_roles values('${admin}','admin');`,
);
async function as(role, id, fn) {
  await db.exec(
    `set role ${role};select set_config('request.jwt.claim.sub','${id || ""}',false);`,
  );
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}
async function fails(fn, pattern) {
  await assert.rejects(fn, pattern);
}
const req = "20000000-0000-4000-8000-000000000001";
let id;
await as("anon", "", async () => {
  await fails(
    () => db.query(`select public.hm_submit_quote('x','${req}')`),
    /permission denied/,
  );
  await fails(() => db.query("select * from hm_quotes"), /permission denied/);
});
await as("authenticated", unverified, () =>
  fails(
    () => db.query(`select public.hm_submit_quote('x','${req}')`),
    /EMAIL_REQUIRED/,
  ),
);
await as("authenticated", alice, async () => {
  id = (
    await db.query(
      `select public.hm_submit_quote('Víc je víc než míň.','${req}') id`,
    )
  ).rows[0].id;
  assert.equal(
    (
      await db.query(
        `select public.hm_submit_quote('Víc je víc než míň.','${req}') id`,
      )
    ).rows[0].id,
    id,
  );
  await fails(
    () => db.query(`select public.hm_submit_quote('different','${req}')`),
    /REQUEST_CONFLICT/,
  );
  await fails(
    () =>
      db.query(
        `insert into hm_quotes(text,status,submitted_by) values('hack','approved','${bob}')`,
      ),
    /permission denied/,
  );
  await fails(
    () => db.query(`update hm_quotes set text='hack' where id='${id}'`),
    /permission denied/,
  );
  await fails(
    () => db.query(`delete from hm_quotes where id='${id}'`),
    /permission denied/,
  );
  await fails(
    () => db.query(`insert into hm_user_roles values('${alice}','admin')`),
    /permission denied/,
  );
  await fails(
    () =>
      db.query(
        `select hm_moderate_quotes(array['${id}'::uuid],'approve',array[1])`,
      ),
    /FORBIDDEN/,
  );
  await fails(
    () =>
      db.query(
        `select hm_update_installation(gen_random_uuid(),'hash',true,'granted','Europe\/Prague',null)`,
      ),
    /permission denied/,
  );
  assert.equal(
    (await db.query("select * from hm_list_own_submissions()")).rows.length,
    1,
  );
  for (let i = 2; i <= 5; i++)
    await db.query(
      `select hm_submit_quote('moudro ${i}','20000000-0000-4000-8000-${String(i).padStart(12, "0")}')`,
    );
  await fails(
    () =>
      db.query(
        `select hm_submit_quote('sixth','20000000-0000-4000-8000-000000000006')`,
      ),
    /RATE_LIMIT/,
  );
});
await as("authenticated", bob, async () => {
  assert.equal(
    (await db.query("select * from hm_list_own_submissions()")).rows.length,
    0,
  );
  assert.equal(
    (await db.query("select * from hm_list_published_quotes()")).rows.length,
    0,
  );
});
await db.query(
  `update public.hm_quotes set image_path='pending/image.webp' where id='${id}'`,
);
await as("authenticated", admin, () =>
  fails(
    () =>
      db.query(
        `select hm_moderate_quotes(array['${id}'::uuid],'approve',array[1])`,
      ),
    /IMAGE_ALT_REQUIRED/,
  ),
);
await db.query(`update public.hm_quotes set image_path=null where id='${id}'`);
await as("authenticated", admin, async () => {
  await db.query(
    `select hm_moderate_quotes(array['${id}'::uuid],'approve',array[1])`,
  );
  await fails(
    () => db.query(`select hm_edit_quote('${id}','stale','',1)`),
    /VERSION_CONFLICT/,
  );
  await db.query(`select hm_edit_quote('${id}','Víc je víc než míň.','',2)`);
  await db.query(
    `select hm_moderate_quotes(array['${id}'::uuid],'approve',array[3])`,
  );
});
assert.equal(
  (await db.query("select * from hm_notification_outbox")).rows.length,
  1,
);
assert.equal((await db.query("select * from hm_daily_quotes")).rows.length, 7);
await as("anon", "", async () => {
  const publicRows = (await db.query("select * from hm_list_published_quotes()"))
    .rows;
  assert.equal(publicRows.length, 1);
  assert.equal("submitted_by" in publicRows[0], false);
  assert.equal(
    (
      await db.query(
        `select * from hm_get_daily_plan((now() at time zone 'Europe/Prague')::date,100)`,
      )
    ).rows.length,
    7,
  );
  await fails(
    () => db.query("select * from hm_notification_outbox"),
    /permission denied/,
  );
});
await as("authenticated", admin, () =>
  db.query(`select hm_moderate_quotes(array['${id}'::uuid],'hide',array[3])`),
);
await as("anon", "", async () => {
  assert.equal(
    (await db.query(`select * from hm_get_published_quote('${id}')`)).rows.length,
    0,
  );
  assert.equal(
    (await db.query(`select * from hm_get_daily_plan(current_date,7)`)).rows
      .length,
    0,
  );
});
await as("authenticated", admin, () =>
  db.query(`select hm_moderate_quotes(array['${id}'::uuid],'approve',array[4])`),
);
assert.equal(
  (await db.query("select * from hm_notification_outbox")).rows.length,
  1,
);
await as("anon", "", async () =>
  assert.equal(
    (await db.query(`select hm_get_media_path(null)`)).rows[0].hm_get_media_path,
    false,
  ),
);
console.log(
  "PASS: anonymous/unverified/owner/foreign/admin permissions, immutable submissions, rate limit, idempotency, private installation APIs, publication deduplication, seven-day plan, hidden content and private fields.",
);
await testNotificationReschedule(db);
await db.close();
