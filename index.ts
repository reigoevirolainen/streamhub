import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "https://streamhub.ee",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const url = Deno.env.get("SUPABASE_URL")!;
const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
const secret = secretKeys.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const resendKey = Deno.env.get("RESEND_API_KEY")!;
const notifyEmail = Deno.env.get("NOTIFY_EMAIL")!;

const admin = createClient(url, secret);

function clean(v: unknown, max: number) {
  return String(v ?? "").trim().slice(0, max);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response(JSON.stringify({error:"Method not allowed"}), {status:405,headers:cors});

  try {
    const body = await req.json();

    // Honeypot: bots fill this hidden field.
    if (clean(body.website, 100)) return new Response(JSON.stringify({ok:true}), {headers:cors});

    const name = clean(body.name, 80);
    const platform = clean(body.platform, 20);
    const channel_url = clean(body.channel_url, 500);
    const email = clean(body.email, 254);
    const message = clean(body.message, 1000);

    if (name.length < 2 || email.length < 5 || channel_url.length < 8) {
      return new Response(JSON.stringify({error:"Palun täida kõik kohustuslikud väljad."}), {status:400,headers:cors});
    }
    if (!["Twitch","YouTube","Kick"].includes(platform)) {
      return new Response(JSON.stringify({error:"Platvorm ei ole lubatud."}), {status:400,headers:cors});
    }

    const { data, error } = await admin.from("streamer_applications").insert({
      name, platform, channel_url, email, message
    }).select("id").single();

    if (error) throw error;

    const html = `
      <div style="font-family:Arial,sans-serif;background:#0b0b10;color:#eee;padding:28px">
        <h2 style="margin-top:0">🎮 Uus StreamHubi striimeri avaldus</h2>
        <p><b>Nimi:</b> ${name.replaceAll("&","&amp;").replaceAll("<","&lt;")}</p>
        <p><b>Platvorm:</b> ${platform}</p>
        <p><b>Kanal:</b> <a href="${channel_url}" style="color:#a78bfa">${channel_url}</a></p>
        <p><b>E-post:</b> ${email}</p>
        <p><b>Sõnum:</b><br>${message.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll("\n","<br>") || "—"}</p>
        <hr style="border-color:#333">
        <p style="color:#999">Avaldus salvestati StreamHubi andmebaasi. ID: ${data.id}</p>
      </div>`;

    const mail = await fetch("https://api.resend.com/emails", {
      method:"POST",
      headers:{"Content-Type":"application/json","Authorization":`Bearer ${resendKey}`},
      body:JSON.stringify({
        from:"StreamHub <noreply@streamhub.ee>",
        to:[notifyEmail],
        reply_to:email,
        subject:`Uus striimeri avaldus: ${name}`,
        html
      })
    });

    if (!mail.ok) {
      const txt = await mail.text();
      console.error("Resend error", txt);
      return new Response(JSON.stringify({ok:true, saved:true, emailSent:false}), {headers:cors});
    }

    return new Response(JSON.stringify({ok:true}), {headers:cors});
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({error:"Avalduse saatmine ebaõnnestus. Proovi uuesti."}), {status:500,headers:cors});
  }
});
