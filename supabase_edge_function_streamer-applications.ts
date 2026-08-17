// StreamHub V35 - streamer applications
// Deploy as: streamer-applications
//
// Required Supabase Edge Function secrets:
//   SUPABASE_SERVICE_ROLE_KEY (normally already available)
//   STREAMHUB_PASSWORD_ENCRYPTION_KEY  -> random secret used only to encrypt pending passwords
//   RESEND_API_KEY
//   STREAMHUB_FROM_EMAIL               -> e.g. "StreamHub <noreply@your-domain.ee>"
//   STREAMHUB_SITE_URL                  -> e.g. "https://streamhub.ee"
//
// The password is NEVER stored as plaintext. It is encrypted while an application
// is pending, then decrypted only during approval so the chosen password can be
// sent in the approval email. After approval the encrypted value is removed.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
const ADMIN_UID = "56a4036e-b37d-4928-abf2-8f49d709f5b7";
const ADMIN_EMAIL = "reigoevert@gmail.com";
const FROM_EMAIL = Deno.env.get("STREAMHUB_FROM_EMAIL") || "";
const SITE_URL = Deno.env.get("STREAMHUB_SITE_URL") || "";
const PASSWORD_KEY_SECRET = Deno.env.get("STREAMHUB_PASSWORD_ENCRYPTION_KEY") || "";

const adminDb = createClient(SUPABASE_URL, SERVICE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json; charset=utf-8" }
  });
}

function text(value: unknown, max = 5000) {
  return String(value ?? "").trim().slice(0, max);
}

function esc(value: unknown) {
  return text(value).replace(/[&<>"']/g, (c) => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
  }[c] || c));
}

function b64(bytes: Uint8Array) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function unb64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

async function encryptionKey() {
  if (!PASSWORD_KEY_SECRET) throw new Error("STREAMHUB_PASSWORD_ENCRYPTION_KEY puudub.");
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(PASSWORD_KEY_SECRET)
  );
  return crypto.subtle.importKey(
    "raw",
    digest,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptPassword(password: string) {
  const key = await encryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(password)
  );
  const payload = new Uint8Array(iv.length + encrypted.byteLength);
  payload.set(iv, 0);
  payload.set(new Uint8Array(encrypted), iv.length);
  return b64(payload);
}

async function decryptPassword(payload: string) {
  const key = await encryptionKey();
  const bytes = unb64(payload);
  if (bytes.length < 13) throw new Error("Salvestatud parooliandmed on vigased.");
  const iv = bytes.slice(0, 12);
  const ciphertext = bytes.slice(12);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );
  return new TextDecoder().decode(decrypted);
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY || !FROM_EMAIL) {
    return { sent: false, error: "RESEND_API_KEY või STREAMHUB_FROM_EMAIL puudub." };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [to],
      subject,
      html
    })
  });

  if (!response.ok) {
    const body = await response.text();
    return { sent: false, error: `E-posti teenus vastas HTTP ${response.status}: ${body.slice(0, 500)}` };
  }

  return { sent: true, error: null };
}

function emailLayout(title: string, content: string) {
  return `<!doctype html>
<html lang="et">
<body style="margin:0;background:#07070c;color:#f7f5ff;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:680px;margin:32px auto;padding:0 18px">
    <div style="background:#10101a;border:1px solid #29283a;border-radius:18px;padding:30px">
      <div style="font-size:12px;letter-spacing:.22em;color:#a15cff;font-weight:800">STREAMHUB EE</div>
      <h1 style="font-size:30px;margin:12px 0 24px;color:#fff">${title}</h1>
      ${content}
      <div style="margin-top:28px;padding-top:18px;border-top:1px solid #29283a;color:#898798;font-size:12px">
        StreamHub Eesti
      </div>
    </div>
  </div>
</body>
</html>`;
}

function siteLink() {
  return SITE_URL
    ? `<a href="${esc(SITE_URL)}" style="display:inline-block;background:#9655ff;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:800">AVA STREAMHUB</a>`
    : "";
}

async function authenticatedAdmin(req: Request) {
  const auth = req.headers.get("Authorization");
  if (!auth) throw new Error("Admini sisselogimine on vajalik.");

  const userDb = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: auth } }
  });
  const { data, error } = await userDb.auth.getUser();
  if (error || !data.user || data.user.id !== ADMIN_UID) {
    throw new Error("Sul puuduvad adminiõigused.");
  }

  return { user: data.user, userDb };
}

async function submitApplication(body: any) {
  const name = text(body.name, 80);
  const email = text(body.email, 254).toLowerCase();
  const password = String(body.password ?? "");
  const password2 = String(body.password2 ?? "");
  const platform = text(body.platform, 20);
  const channelUrl = text(body.channel_url, 500);
  const game = text(body.game, 100) || null;
  const avatarUrl = text(body.avatar_url, 1000) || null;
  const thumbnailUrl = text(body.thumbnail_url, 1000) || null;
  const message = text(body.message, 2000) || null;

  if (name.length < 2) throw new Error("Striimeri nimi on kohustuslik.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Sisesta korrektne e-post.");
  if (password.length < 6 || password.length > 128) throw new Error("Parool peab olema 6–128 märki.");
  if (password2 && password !== password2) throw new Error("Paroolid ei kattu.");
  if (!["Twitch","YouTube","Kick","TikTok"].includes(platform)) throw new Error("Tundmatu platvorm.");
  if (channelUrl.length < 8) throw new Error("Kanali URL on kohustuslik.");

  const { data: existing } = await adminDb
    .from("streamer_applications")
    .select("id,status")
    .ilike("email", email)
    .in("status", ["pending","approved"])
    .limit(1)
    .maybeSingle();

  if (existing?.status === "pending") throw new Error("Selle e-postiga on juba ootel taotlus.");
  if (existing?.status === "approved") throw new Error("Selle e-postiga on StreamHubi konto juba olemas.");

  const { data: existingAuth } = await adminDb.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if ((existingAuth.users || []).some((u: any) => String(u.email || "").toLowerCase() === email)) {
    throw new Error("Selle e-postiga on juba kasutajakonto olemas.");
  }

  const passwordCiphertext = await encryptPassword(password);

  const { data: application, error } = await adminDb
    .from("streamer_applications")
    .insert({
      name,
      email,
      platform,
      channel_url: channelUrl,
      game,
      avatar_url: avatarUrl,
      thumbnail_url: thumbnailUrl,
      message,
      password_ciphertext: passwordCiphertext,
      status: "pending",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  const html = emailLayout("Uus striimeri liitumistaotlus", `
    <p style="color:#aaa8ba;line-height:1.7">StreamHubi tuli uus striimeri liitumistaotlus.</p>
    <div style="background:#0b0b12;border:1px solid #29283a;border-radius:12px;padding:18px;line-height:1.8">
      <b>Nimi:</b> ${esc(name)}<br>
      <b>E-post:</b> ${esc(email)}<br>
      <b>Platvorm:</b> ${esc(platform)}<br>
      <b>Mäng:</b> ${esc(game || "Määramata")}<br>
      <b>Kanal:</b> <a href="${esc(channelUrl)}" style="color:#b47cff">${esc(channelUrl)}</a>
      ${message ? `<br><b>Sõnum:</b> ${esc(message)}` : ""}
    </div>
    <p style="margin-top:24px;color:#aaa8ba">Logi StreamHubi adminpaneeli ja ava <b>Taotlused</b>.</p>
  `);

  const mail = await sendEmail(ADMIN_EMAIL, `StreamHub — uus striimeri taotlus: ${name}`, html);
  return { ok: true, application_id: application.id, email_sent: mail.sent, email_error: mail.error };
}

async function approveApplication(req: Request, applicationId: string) {
  const { userDb } = await authenticatedAdmin(req);

  const { data: application, error: readError } = await adminDb
    .from("streamer_applications")
    .select("*")
    .eq("id", applicationId)
    .single();

  if (readError || !application) throw new Error("Taotlust ei leitud.");
  if (application.status !== "pending") throw new Error("Taotlus on juba töödeldud.");
  if (!application.password_ciphertext) throw new Error("Sellel taotlusel puudub turvaliselt salvestatud parool. Taotleja peab esitama uue taotluse.");

  const password = await decryptPassword(application.password_ciphertext);

  const { data: created, error: createError } = await adminDb.auth.admin.createUser({
    email: String(application.email).toLowerCase(),
    password,
    email_confirm: true,
    user_metadata: {
      username: String(application.email).split("@")[0],
      display_name: application.name,
      avatar_url: application.avatar_url || null,
      user_type: "streamer"
    }
  });

  if (createError || !created.user) {
    throw new Error(createError?.message || "Kasutajakonto loomine ebaõnnestus.");
  }

  try {
    // Reuse the existing V35/V33.6 admin RPC through the real admin session.
    // This preserves the existing RLS/admin logic and automatically links owner_id
    // to the newly created Auth user by email.
    const { error: approveError } = await userDb.rpc("admin_approve_application", {
      p_application_id: application.id
    });

    if (approveError) {
      await adminDb.auth.admin.deleteUser(created.user.id);
      throw new Error(approveError.message);
    }

    // Remove the encrypted password as soon as the account is approved.
    await adminDb.from("streamer_applications")
      .update({ password_ciphertext: null, updated_at: new Date().toISOString() })
      .eq("id", application.id);

    const loginUrl = SITE_URL || req.headers.get("origin") || "";
    const html = emailLayout("Sinu StreamHubi taotlus on vastu võetud", `
      <p style="color:#aaa8ba;line-height:1.7">Tere, ${esc(application.name)}!</p>
      <p style="color:#aaa8ba;line-height:1.7">Sinu StreamHubi striimeriks liitumise taotlus on vastu võetud. Sinu konto on nüüd aktiivne.</p>
      <div style="background:#0b0b12;border:1px solid #29283a;border-radius:12px;padding:20px;line-height:2">
        <b>Kasutajatunnus / e-post:</b> ${esc(application.email)}<br>
        <b>Parool:</b> <span style="color:#c28cff">${esc(password)}</span>
      </div>
      <p style="color:#aaa8ba;line-height:1.7">Kasuta neid andmeid StreamHubi sisselogimiseks.</p>
      ${loginUrl ? `<p>${siteLink()}</p>` : ""}
      <p style="color:#777587;font-size:12px;line-height:1.6">Ära jaga seda e-kirja teistega. Kui sa ei esitanud seda taotlust, võta StreamHubiga ühendust.</p>
    `);

    const mail = await sendEmail(String(application.email), "StreamHub — sinu taotlus on vastu võetud", html);
    return { ok: true, email_sent: mail.sent, email_error: mail.error };
  } catch (err) {
    // If post-account notification work fails, the account is still valid.
    throw err;
  }
}

async function rejectApplication(req: Request, applicationId: string) {
  const { userDb } = await authenticatedAdmin(req);
  const { error } = await userDb.rpc("admin_reject_application", {
    p_application_id: applicationId
  });
  if (error) throw new Error(error.message);

  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    const action = text(body.action, 30);

    if (action === "submit") return json(await submitApplication(body));
    if (action === "approve") return json(await approveApplication(req, text(body.application_id, 100)));
    if (action === "reject") return json(await rejectApplication(req, text(body.application_id, 100)));

    return json({ ok: false, error: "Tundmatu tegevus." }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return json({ ok: false, error: message }, 400);
  }
});
