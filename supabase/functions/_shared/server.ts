import { createClient } from 'npm:@supabase/supabase-js@2';
export const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
export const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'};
export const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...headers,'Content-Type':'application/json'}});
export async function user(req:Request){const jwt=req.headers.get('Authorization')?.replace(/^Bearer /,'');if(!jwt)throw Error('AUTH_REQUIRED');const {data,error}=await admin.auth.getUser(jwt);if(error||!data.user)throw Error('AUTH_REQUIRED');return data.user;}
export async function administrator(req:Request){const u=await user(req);const {data}=await admin.from('hm_user_roles').select('role').eq('user_id',u.id).maybeSingle();if(data?.role!=='admin')throw Error('FORBIDDEN');return u;}
export async function sha(value:string){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');}
export function check(error:unknown){if(error)throw error;}
