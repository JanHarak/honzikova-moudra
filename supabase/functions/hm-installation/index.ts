import { admin,headers,json,sha,check } from '../_shared/server.ts';
Deno.serve(async req=>{if(req.method==='OPTIONS')return new Response(null,{headers});if(req.method!=='POST')return json({error:'METHOD'},405);try{const b=await req.json();
 if(b.action==='register'){const credential=crypto.randomUUID()+crypto.randomUUID();const {data,error}=await admin.from('hm_installations').insert({credential_hash:await sha(credential)}).select('id').single();check(error);return json({id:data!.id,credential});}
 if(b.action==='daily'){if(typeof b.id!=='string'||typeof b.credential!=='string'||typeof b.enabled!=='boolean')return json({error:'INVALID_INPUT'},400);check((await admin.rpc('hm_set_daily_notification',{p_id:b.id,p_hash:await sha(b.credential),p_enabled:b.enabled})).error);return json({ok:true});}
 if(b.action!=='update'||typeof b.id!=='string'||typeof b.credential!=='string')return json({error:'INVALID_INPUT'},400);
 const {data:installation,error}=await admin.from('hm_installations').select('id').eq('id',b.id).eq('credential_hash',await sha(b.credential)).maybeSingle();check(error);if(!installation)return json({error:'FORBIDDEN'},403);
 if(typeof b.enabled!=='boolean'||!['granted','denied','prompt','prompt-with-rationale'].includes(b.permission)||typeof b.timezone!=='string'||b.timezone.length>100)return json({error:'INVALID_INPUT'},400);
 const provider=b.provider||'apns';
 if(!['apns','webpush'].includes(provider))return json({error:'INVALID_PROVIDER'},400);
 if(b.token!==undefined&&(typeof b.token!=='string'||(provider==='apns'&&!/^([a-fA-F0-9]{2}){16,128}$/.test(b.token))||(provider==='webpush'&&b.token.length>4096)))return json({error:'INVALID_TOKEN'},400);
 check((await admin.rpc('hm_update_installation',{p_id:b.id,p_hash:await sha(b.credential),p_enabled:b.enabled,p_permission:b.permission,p_timezone:b.timezone,p_token:b.token||null,p_provider:provider})).error);
 return json({ok:true});
 }catch{return json({error:'REQUEST_FAILED'},400)}});
