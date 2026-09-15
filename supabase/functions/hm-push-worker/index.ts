import { SignJWT, importPKCS8 } from 'npm:jose@6';
import webpush from 'npm:web-push@3.6.7';
import { admin, json, check } from '../_shared/server.ts';
import { eventOutcome, shouldSkipDelivery } from './scheduling.ts';

type Event = { event_id: string; batch_id: string | null; notification_type: string; daily_date: string | null; attempts: number };
const configured = (keys: string[]) => keys.every((key) => Deno.env.get(key));
function localDateTime(timezone: string) {
	const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
	const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
	return { date: `${values.year}-${values.month}-${values.day}`, time: `${values.hour === '24' ? '00' : values.hour}:${values.minute}` };
}

async function sendApns(endpoint: Record<string, string>, payload: Record<string, unknown>, eventId: string) {
	const key = await importPKCS8(Deno.env.get('APNS_PRIVATE_KEY')!.replace(/\\n/g, '\n'), 'ES256');
	const jwt = await new SignJWT({}).setProtectedHeader({ alg: 'ES256', kid: Deno.env.get('APNS_KEY_ID')! }).setIssuer(Deno.env.get('APNS_TEAM_ID')!).setIssuedAt().sign(key);
	const host = Deno.env.get('APNS_ENVIRONMENT') === 'production' ? 'api.push.apple.com' : 'api.sandbox.push.apple.com';
	return fetch(`https://${host}/3/device/${endpoint.token}`, { method: 'POST', headers: { authorization: `bearer ${jwt}`, 'apns-topic': Deno.env.get('APNS_TOPIC')!, 'apns-push-type': 'alert', 'apns-priority': '10', 'apns-collapse-id': eventId, 'apns-id': eventId, 'content-type': 'application/json' }, body: JSON.stringify({ aps: { alert: { title: payload.title, body: payload.body }, sound: 'default' }, path: payload.path, eventId }) });
}

async function sendWeb(endpoint: Record<string, string>, payload: Record<string, unknown>) {
	webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT')!, Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!);
	await webpush.sendNotification(JSON.parse(endpoint.token), JSON.stringify(payload));
	return { status: 201, headers: new Headers() };
}

Deno.serve(async (req) => {
	if (req.method !== 'POST' || req.headers.get('Authorization') !== `Bearer ${Deno.env.get('WORKER_SECRET')}` || !Deno.env.get('WORKER_SECRET')) return json({ error: 'FORBIDDEN' }, 403);
	try {
		check((await admin.rpc('hm_fill_daily_plan')).error);
		check((await admin.rpc('hm_enqueue_daily_notification')).error);
		const { data: events, error } = await admin.rpc('hm_claim_notification_events');
		check(error);
		for (const event of (events || []) as Event[]) {
			let retry = false;
			try {
				let payload: Record<string, unknown>;
				const preference = event.notification_type === 'daily' ? 'daily_enabled' : 'new_quotes_enabled';
				if (event.notification_type === 'daily') {
					const { data: quote, error: quoteError } = await admin.rpc('hm_get_random_notification_quote'); check(quoteError);
					if (!quote?.length) { await admin.from('hm_notification_outbox').update({ status: 'cancelled' }).eq('event_id', event.event_id); continue; }
					payload = { title: 'Moudro pro dnešek', body: quote[0].text, path: `/moudra/${quote[0].id}` };
				} else {
					const { data: quotes, error: quoteError } = await admin.rpc('hm_get_publication_batch', { p_id: event.batch_id }); check(quoteError);
					if (!quotes?.length) { await admin.from('hm_notification_outbox').update({ status: 'cancelled' }).eq('event_id', event.event_id); continue; }
					payload = { title: 'Honzíkova moudra', body: quotes.length === 1 ? 'Ve sbírce je nové moudro.' : `Ve sbírce je ${quotes.length} nových mouder.`, path: quotes.length === 1 ? `/moudra/${quotes[0].id}` : `/davky/${event.batch_id}` };
				}
				if (event.notification_type === 'daily' && event.daily_date && event.daily_date !== localDateTime('Europe/Prague').date) {
					await admin.from('hm_notification_outbox').update({ status: 'cancelled' }).eq('event_id', event.event_id);
					continue;
				}
				const { data: prefs, error: prefError } = await admin.from('hm_notification_preferences').select(`installation_id,${preference}${event.notification_type === 'daily' ? ',daily_time' : ''}`).eq(preference, true).eq('permission', 'granted'); check(prefError);
				const ids = (prefs || []).map((pref) => pref.installation_id);
				const { data: endpoints, error: endpointError } = ids.length ? await admin.from('hm_push_endpoints').select('*').in('installation_id', ids) : { data: [], error: null }; check(endpointError);
				if (ids.length > 0 && !endpoints?.length) retry = true;
				for (const endpoint of endpoints || []) {
					const { data: done, error: deliveryError } = await admin.from('hm_notification_deliveries').select('status,attempts').eq('event_id', event.event_id).eq('endpoint_id', endpoint.id).maybeSingle(); check(deliveryError);
					if (shouldSkipDelivery(event.notification_type, done)) continue;
					if (event.notification_type === 'daily') {
						const pref = (prefs || []).find((item) => item.installation_id === endpoint.installation_id);
						const { data: installation, error: installationError } = await admin.from('hm_installations').select('timezone').eq('id', endpoint.installation_id).maybeSingle(); check(installationError);
						const local = localDateTime(installation?.timezone || 'Europe/Prague');
						if (!pref || local.date !== event.daily_date || local.time < String(pref.daily_time).slice(0, 5)) continue;
					}
					try {
						let response: { ok: boolean; status: number; headers: Headers };
						if (endpoint.provider === 'webpush') {
							if (!configured(['VAPID_SUBJECT', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY'])) { retry = true; continue; }
							const result = await sendWeb(endpoint, payload); response = { ok: true, ...result };
						} else {
							if (!configured(['APNS_PRIVATE_KEY', 'APNS_KEY_ID', 'APNS_TEAM_ID', 'APNS_TOPIC'])) { retry = true; continue; }
							const result = await sendApns(endpoint, payload, event.event_id); response = { ok: result.ok, status: result.status, headers: result.headers };
						}
						const invalid = response.status === 404 || response.status === 410;
						check((await admin.from('hm_notification_deliveries').upsert({ event_id: event.event_id, endpoint_id: endpoint.id, status: response.ok ? 'sent' : invalid ? 'invalid' : 'retry', attempts: (done?.attempts || 0) + 1, provider_message_id: response.headers.get('apns-id') })).error);
						if (invalid) check((await admin.from('hm_push_endpoints').delete().eq('id', endpoint.id)).error); else if (!response.ok) retry = true;
					} catch (sendError) {
						const status = Number((sendError as { statusCode?: number }).statusCode || 500), invalid = status === 404 || status === 410;
						await admin.from('hm_notification_deliveries').upsert({ event_id: event.event_id, endpoint_id: endpoint.id, status: invalid ? 'invalid' : 'retry', attempts: (done?.attempts || 0) + 1 });
						if (invalid) await admin.from('hm_push_endpoints').delete().eq('id', endpoint.id); else retry = true;
					}
				}
			} catch { retry = true; }
			check((await admin.from('hm_notification_outbox').update({ ...eventOutcome(event.notification_type, event.attempts, retry), last_error: retry ? 'Provider or delivery failure' : null }).eq('event_id', event.event_id)).error);
		}
		return json({ processed: events?.length || 0 });
	} catch { return json({ error: 'WORKER_FAILED' }, 500); }
});
