import { SignJWT,importPKCS8 } from 'npm:jose@6';
import {admin,json,check} from '../_shared/server.ts';
// Invoke only from a trusted scheduler with WORKER_SECRET, never from the application.
Deno.serve(async req=>{if(req.method!=='POST'||req.headers.get('Authorization')!==`Bearer ${Deno.env.get('WORKER_SECRET')}`||!Deno.env.get('WORKER_SECRET'))return json({error:'FORBIDDEN'},403);
 const required=['APNS_PRIVATE_KEY','APNS_KEY_ID','APNS_TEAM_ID','APNS_TOPIC'];if(required.some(k=>!Deno.env.get(k)))return json({error:'APNS_NOT_CONFIGURED'},503);
 try{check((await admin.rpc('hm_fill_daily_plan')).error);const {data:events,error}=await admin.rpc('hm_claim_notification_events');check(error);
 const key=await importPKCS8(Deno.env.get('APNS_PRIVATE_KEY')!.replace(/\\n/g,'\n'),'ES256');const jwt=await new SignJWT({}).setProtectedHeader({alg:'ES256',kid:Deno.env.get('APNS_KEY_ID')!}).setIssuer(Deno.env.get('APNS_TEAM_ID')!).setIssuedAt().sign(key);
 for(const event of events||[]){let retry=false;try{
 const {data:quotes,error:qerr}=await admin.rpc('hm_get_publication_batch',{p_id:event.batch_id});check(qerr);
 if(!quotes?.length){check((await admin.from('hm_notification_outbox').update({status:'cancelled'}).eq('event_id',event.event_id)).error);continue;}
 const {data:prefs,error:perr}=await admin.from('hm_notification_preferences').select('installation_id').eq('new_quotes_enabled',true).eq('permission','granted');check(perr);
 const ids=(prefs||[]).map(p=>p.installation_id);const {data:endpoints,error:eerr}=ids.length?await admin.from('hm_push_endpoints').select('*').in('installation_id',ids):{data:[],error:null};check(eerr);
 for(const endpoint of endpoints||[]){
 const {data:done,error:derr}=await admin.from('hm_notification_deliveries').select('status,attempts').eq('event_id',event.event_id).eq('endpoint_id',endpoint.id).maybeSingle();check(derr);if(done?.status==='sent'||done?.status==='invalid')continue;
 // Recheck visibility and preference immediately before each provider call.
 const {data:current}=await admin.rpc('hm_get_publication_batch',{p_id:event.batch_id});const {data:pref}=await admin.from('hm_notification_preferences').select('*').eq('installation_id',endpoint.installation_id).single();if(!current?.length||!pref?.new_quotes_enabled||pref.permission!=='granted')continue;
 const path=current.length===1?`/moudra/${current[0].id}`:`/davky/${event.batch_id}`;
 const host=Deno.env.get('APNS_ENVIRONMENT')==='production'?'api.push.apple.com':'api.sandbox.push.apple.com';
 const response=await fetch(`https://${host}/3/device/${endpoint.token}`,{method:'POST',headers:{authorization:`bearer ${jwt}`,'apns-topic':Deno.env.get('APNS_TOPIC')!,'apns-push-type':'alert','apns-priority':'10','apns-collapse-id':event.event_id,'apns-id':event.event_id,'content-type':'application/json'},body:JSON.stringify({aps:{alert:{title:'Honzíkova moudra',body:current.length===1?'Ve sbírce je nové moudro.':`Ve sbírce je ${current.length} nových mouder.`},sound:'default'},path,eventId:event.event_id})});
 const body=response.ok?null:await response.json().catch(()=>({reason:'Unknown'}));const invalid=response.status===410||body?.reason==='BadDeviceToken'||body?.reason==='Unregistered';
 check((await admin.from('hm_notification_deliveries').upsert({event_id:event.event_id,endpoint_id:endpoint.id,status:response.ok?'sent':invalid?'invalid':'retry',attempts:(done?.attempts||0)+1,provider_message_id:response.headers.get('apns-id')})).error);
 if(invalid)check((await admin.from('hm_push_endpoints').delete().eq('id',endpoint.id)).error);else if(!response.ok)retry=true;
 }
 }catch{retry=true;}
 check((await admin.from('hm_notification_outbox').update({status:retry?(event.attempts>=10?'failed':'pending'):'sent',next_attempt_at:new Date(Date.now()+Math.min(3600000,2**event.attempts*30000)).toISOString(),last_error:retry?'Provider or delivery failure':null}).eq('event_id',event.event_id)).error);
 }
 return json({processed:events?.length||0});}catch{return json({error:'WORKER_FAILED'},500)}});
