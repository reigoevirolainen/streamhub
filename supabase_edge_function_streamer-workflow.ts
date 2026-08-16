// StreamHub V36 - secure streamer workflow
// Deploy as: supabase functions deploy streamer-workflow --no-verify-jwt
// Required secrets: RESEND_API_KEY, STREAMHUB_ADMIN_EMAIL, STREAMHUB_MAIL_FROM
// Supabase supplies SUPABASE_URL and SUPABASE_SECRET_KEYS automatically.

import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "https://streamhub.ee",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"content-type":"application/json"}});
const adminUid="56a4036e-b37d-4928-abf2-8f49d709f5b7";

function secretKey(){
  const map=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}");
  return map.default || Deno.env.get("SUPABASE_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
}
const db=createClient(Deno.env.get("SUPABASE_URL")!,secretKey());

async function sendMail(to:string,subject:string,html:string){
  const key=Deno.env.get("RESEND_API_KEY");
  const from=Deno.env.get("STREAMHUB_MAIL_FROM");
  if(!key || !from) return false;
  const r=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${key}`},body:JSON.stringify({from,to,subject,html})});
  return r.ok;
}
function esc(v:string){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]!));}

async function callerIsAdmin(req:Request){
  const auth=req.headers.get("authorization")||"";
  const token=auth.replace(/^Bearer\s+/i,"");
  if(!token) return false;
  const {data,error}=await db.auth.getUser(token);
  return !error && data.user?.id===adminUid;
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
  if(req.method!=="POST") return json({error:"Method not allowed"},405);
  try{
    const body=await req.json();

    if(body.action==="apply"){
      const {name,email,platform,channel_url,game,avatar_url,thumbnail_url,message,password}=body;
      if(!name||!email||!platform||!channel_url||!password) return json({error:"Täida kõik kohustuslikud väljad."},400);
      if(String(password).length<8) return json({error:"Parool peab olema vähemalt 8 märki."},400);
      if(!["Twitch","YouTube","Kick","TikTok"].includes(platform)) return json({error:"Platvorm ei ole lubatud."},400);

      // Create the Auth account silently. The public UI has no signup form.
      const created=await db.auth.admin.createUser({
        email:String(email).trim().toLowerCase(), password:String(password), email_confirm:true,
        user_metadata:{username:String(name).trim(),display_name:String(name).trim(),streamhub_pending:true}
      });
      if(created.error){
        if(created.error.message?.toLowerCase().includes("already")) return json({error:"Selle e-postiga on juba StreamHubi konto olemas. Logi sisse või kasuta parooli taastamist."},409);
        return json({error:created.error.message},400);
      }
      const uid=created.data.user?.id;
      if(!uid) return json({error:"Kasutajakonto loomine ebaõnnestus."},500);

      const profile=await db.from("profiles").update({user_type:"pending",username:String(name).trim(),display_name:String(name).trim(),email:String(email).trim().toLowerCase(),updated_at:new Date().toISOString()}).eq("id",uid);
      if(profile.error){await db.auth.admin.deleteUser(uid); return json({error:profile.error.message},500);}

      const ins=await db.from("streamer_applications").insert({
        name:String(name).trim(),email:String(email).trim().toLowerCase(),platform,channel_url:String(channel_url).trim(),
        game:game?String(game).trim():null,avatar_url:avatar_url?String(avatar_url).trim():null,thumbnail_url:thumbnail_url?String(thumbnail_url).trim():null,
        message:message?String(message).trim():null,status:"pending",auth_user_id:uid
      }).select("id").single();
      if(ins.error){await db.auth.admin.deleteUser(uid);return json({error:ins.error.message},500);}

      const adminEmail=Deno.env.get("STREAMHUB_ADMIN_EMAIL");
      const sent=adminEmail?await sendMail(adminEmail,"Uus StreamHubi striimeritaotlus",`<h2>Uus striimeritaotlus</h2><p><b>${esc(String(name))}</b> soovib liituda StreamHubiga.</p><p>${esc(String(email))} · ${esc(String(platform))} · ${esc(String(game||"Määramata"))}</p><p><a href="${esc(String(channel_url))}">${esc(String(channel_url))}</a></p><p>Logi StreamHubi adminpaneeli ja vaata taotlus üle.</p>`):false;
      return json({ok:true,application_id:ins.data.id,admin_email_sent:sent});
    }

    if(body.action==="approved"){
      if(!(await callerIsAdmin(req))) return json({error:"Adminiõigus puudub."},403);
      const {data:a,error}=await db.from("streamer_applications").select("*").eq("id",body.application_id).single();
      if(error||!a) return json({error:error?.message||"Taotlust ei leitud."},404);
      const from=Deno.env.get("STREAMHUB_MAIL_FROM");
      const sent=from?await sendMail(a.email,"StreamHub — sinu striimerikonto on kinnitatud",`<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>🎉 Tere, ${esc(a.name)}!</h2><p>Sinu StreamHubi striimeritaotlus on <b>kinnitatud</b>.</p><p><b>Kasutajanimi:</b> ${esc(a.name)}</p><p><b>Parool:</b> see on sama parool, mille sisestasid liitumistaotluses.</p><p>Logi nüüd StreamHubis sisse ja saad oma profiili <b>ONLINE / OFFLINE</b> staatust ise hallata.</p><p>Aitäh, et liitusid StreamHubiga! 💜</p><p><a href="https://streamhub.ee">Ava StreamHub</a></p></div>`):false;
      return json({ok:true,email_sent:sent});
    }

    return json({error:"Tundmatu tegevus."},400);
  }catch(e){return json({error:e instanceof Error?e.message:String(e)},500)}
});
