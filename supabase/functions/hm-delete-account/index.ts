import { admin,headers,json,user,check } from '../_shared/server.ts';
Deno.serve(async req=>{if(req.method==='OPTIONS')return new Response(null,{headers});if(req.method!=='POST')return json({error:'METHOD'},405);try{const u=await user(req);check((await admin.auth.admin.deleteUser(u.id)).error);return json({ok:true});}catch{return json({error:'DELETE_FAILED'},400)}});
