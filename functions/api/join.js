// Cloudflare Pages Function. Deploy only with IHO_INTAKE_DB and TURNSTILE_SECRET_KEY configured.
// This endpoint intentionally does not send mail; acknowledgement requires a separate tested mail worker.
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const clean=(x,max)=>typeof x==='string'?x.trim().slice(0,max):'';
const uuid=()=>crypto.randomUUID();
export async function onRequestPost({request,env}){
  if(!env.IHO_INTAKE_DB||!env.TURNSTILE_SECRET_KEY)return json({error:'Intake unavailable'},503);
  const origin=request.headers.get('Origin');
  if(origin && !['https://iho.co.nz','https://www.iho.co.nz'].includes(origin))return json({error:'Origin not allowed'},403);
  if((request.headers.get('content-type')||'').split(';')[0].trim()!=='application/json')return json({error:'Expected JSON'},415);
  if(Number(request.headers.get('content-length')||0)>12000)return json({error:'Payload too large'},413);
  let body;try{body=await request.json()}catch{return json({error:'Invalid JSON'},400)}
  const name=clean(body.name,120),email=clean(body.email,254).toLowerCase(),trust=clean(body.trust,160);
  const region=clean(body.region,120),role=clean(body.role,100),message=clean(body.message,2000);
  if(!name||!trust||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return json({error:'Missing or invalid required fields'},400);
  if(typeof body.updates_opt_in!=='boolean')return json({error:'Update consent must be explicit'},400);
  const token=clean(body.turnstile_token,4096);
  if(!token)return json({error:'Verification required'},400);
  let verification;
  try{
    const response=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({secret:env.TURNSTILE_SECRET_KEY,response:token,remoteip:request.headers.get('CF-Connecting-IP')||''})});
    verification=await response.json();
  }catch{return json({error:'Verification temporarily unavailable'},503)}
  if(!verification.success||!['iho.co.nz','www.iho.co.nz'].includes(verification.hostname))return json({error:'Verification failed'},403);
  const id=uuid(),eventId=uuid(),optIn=body.updates_opt_in?1:0,now=new Date().toISOString();
  try{
    await env.IHO_INTAKE_DB.batch([
      env.IHO_INTAKE_DB.prepare(`INSERT INTO iho_interest_enquiries
      (id,name,email,trust_name,region,role_label,message,privacy_notice_version,updates_opt_in,updates_opt_in_at,next_followup_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,datetime('now','+2 days'))`)
      .bind(id,name,email,trust,region,role,message,'iho-eoi-2026-11-15',optIn,optIn?now:null),
      env.IHO_INTAKE_DB.prepare('INSERT INTO iho_interest_events(id,enquiry_id,event_type,actor,detail) VALUES(?,?,?,?,?)')
      .bind(eventId,id,'submitted','public-form',optIn?'updates-opt-in':'enquiry-only')
    ]);
    return json({ok:true,reference:id},201);
  }catch(e){
    // A unique email+trust constraint prevents duplicate registrations; do not expose DB details.
    if(/UNIQUE constraint/i.test(String(e)))return json({ok:true,already_registered:true},200);
    return json({error:'Could not save your enquiry. Please retry.'},503);
  }
}
export async function onRequestGet(){return json({error:'Method not allowed'},405)}
