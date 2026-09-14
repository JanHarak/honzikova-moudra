import { admin,headers,json,administrator,check } from '../_shared/server.ts';
import { ImageMagick, initializeImageMagick, MagickFormat } from 'npm:@imagemagick/magick-wasm@0.0.35';
const initialized=initializeImageMagick();
Deno.serve(async req=>{if(req.method==='OPTIONS')return new Response(null,{headers});if(req.method!=='POST')return json({error:'METHOD'},405);let path:string|undefined;try{const u=await administrator(req);const f=await req.formData(),file=f.get('file');const id=String(f.get('quoteId')),version=Number(f.get('version'));if(!(file instanceof File)||file.size>10*1024*1024||!['image/png','image/jpeg','image/webp'].includes(file.type))return json({error:'INVALID_IMAGE'},400);
 await initialized;const input=new Uint8Array(await file.arrayBuffer());let output:Uint8Array|undefined;
 ImageMagick.read(input,img=>{if(img.width*img.height>40000000)throw Error('DIMENSIONS');img.autoOrient();img.resize(1600,1600);img.strip();img.quality=82;img.write(MagickFormat.WebP,bytes=>{output=new Uint8Array(bytes)})});if(!output)throw Error('INVALID_IMAGE');path=`${id}/${crypto.randomUUID()}.webp`;
 check((await admin.storage.from('hm-quote-media').upload(path,output,{contentType:'image/webp',upsert:false})).error);
 const {data,error}=await admin.rpc('hm_attach_quote_image',{p_id:id,p_path:path,p_version:version,p_admin:u.id});check(error);return json({path,version:data});
 }catch{if(path)await admin.storage.from('hm-quote-media').remove([path]);return json({error:'IMAGE_UPLOAD_FAILED'},400)}});
