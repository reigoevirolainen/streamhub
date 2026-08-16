(() => {
"use strict";

const CFG = window.STREAMHUB_CONFIG || {};
const SUPABASE_URL = CFG.SUPABASE_URL;
const SUPABASE_KEY = CFG.SUPABASE_PUBLISHABLE_KEY;

const sb = (window.supabase && SUPABASE_URL && SUPABASE_KEY)
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    })
  : null;

let streamers = [];
let currentFilter = "Kõik";
let currentUser = null;
let currentProfile = null;

const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, m => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[m]));

function toast(msg, bad=false) {
  const t = $("#toast");
  if (!t) return;
  t.textContent = msg;
  t.className = "toast show " + (bad ? "" : "good");
  clearTimeout(window.__toast);
  window.__toast = setTimeout(() => t.className = "toast", 5000);
}

function openModal(html) {
  $("#modalRoot").innerHTML = `<div class="modal-back" id="modalBack"><div class="modal">${html}</div></div>`;
  $("#modalBack").onclick = e => {
    if (e.target.id === "modalBack") closeModal();
  };
  $(".close")?.addEventListener("click", closeModal);
}

function closeModal() {
  $("#modalRoot").innerHTML = "";
}

function dbRequired() {
  if (!sb) {
    toast("Supabase ühendus puudub. Kontrolli config.js faili.", true);
    return false;
  }
  return true;
}

function errorText(error) {
  if (!error) return "";
  return [error.code, error.message, error.hint, error.details].filter(Boolean).join(" — ");
}

/* ---------------- JOIN ---------------- */

function joinModal() {
  openModal(`
    <button class="close">×</button>
    <div class="eyebrow">STREAMER</div>
    <h2>Liitu StreamHubiga</h2>
    <p class="muted">Saada oma andmed. Admin vaatab taotluse üle.</p>
    <form id="joinForm" class="formgrid">
      <div class="field"><label>STRIIMERI NIMI</label><input name="name" required maxlength="80"></div>
      <div class="field"><label>GMAIL / E-POST</label><input name="email" type="email" required maxlength="254"></div>
      <div class="field"><label>PLATVORM</label>
        <select name="platform"><option>Twitch</option><option>YouTube</option><option>Kick</option><option>TikTok</option></select>
      </div>
      <div class="field"><label>KANALI URL</label><input name="channel_url" type="url" required></div>
      <div class="field"><label>MIDA STRIIMID?</label><input name="game" placeholder="Fortnite, Minecraft..."></div>
      <div class="field"><label>AVATARI URL</label><input name="avatar_url" type="url"></div>
      <div class="field"><label>SÕNUM</label><textarea name="message"></textarea></div>
      <div class="modal-actions">
        <button type="button" class="btn cancel">Tühista</button>
        <button class="primary" id="submitApplication">SAADA TAOTLUS</button>
      </div>
    </form>
  `);

  $(".cancel").onclick = closeModal;

  $("#joinForm").onsubmit = async e => {
    e.preventDefault();
    if (!dbRequired()) return;

    const btn = $("#submitApplication");
    btn.disabled = true;
    btn.textContent = "SAADAN...";

    const d = Object.fromEntries(new FormData(e));

    // Direct insert is intentionally used here. The SQL below creates the
    // required anon INSERT grant + RLS policy, so there is no RPC/schema-cache
    // dependency for the public join form.
    const { error } = await sb.from("streamer_applications").insert({
      name: d.name.trim(),
      email: d.email.trim().toLowerCase(),
      platform: d.platform,
      channel_url: d.channel_url.trim(),
      game: d.game?.trim() || null,
      avatar_url: d.avatar_url?.trim() || null,
      message: d.message?.trim() || null,
      status: "pending"
    });

    if (error) {
      btn.disabled = false;
      btn.textContent = "SAADA TAOTLUS";
      toast("Taotlus ei läinud läbi: " + errorText(error), true);
      return;
    }

    closeModal();
    toast("Taotlus saadetud. Admin vaatab selle üle.");
  };
}

/* ---------------- LOGIN ---------------- */

function loginModal(kind) {
  openModal(`
    <button class="close">×</button>
    <div class="eyebrow">${kind === "admin" ? "ADMIN" : "KASUTAJA"}</div>
    <h2>${kind === "admin" ? "Admini sisselogimine" : "Striimeri sisselogimine"}</h2>
    <form id="loginForm" class="formgrid">
      <div class="field"><label>E-POST</label><input name="email" type="email" required></div>
      <div class="field"><label>PAROOL</label><input name="password" type="password" required></div>
      <div class="modal-actions">
        <button type="button" class="btn cancel">Tühista</button>
        <button class="primary" id="loginButton">LOGI SISSE</button>
      </div>
    </form>
  `);

  $(".cancel").onclick = closeModal;

  $("#loginForm").onsubmit = async e => {
    e.preventDefault();
    if (!dbRequired()) return;

    const btn = $("#loginButton");
    btn.disabled = true;
    btn.textContent = "LOGIN...";

    const d = Object.fromEntries(new FormData(e));
    const { data, error } = await sb.auth.signInWithPassword({
      email: d.email.trim(),
      password: d.password
    });

    if (error) {
      btn.disabled = false;
      btn.textContent = "LOGI SISSE";
      toast(errorText(error), true);
      return;
    }

    const { data: profile, error: profileError } = await sb
      .from("profiles")
      .select("id,username,user_type")
      .eq("id", data.user.id)
      .maybeSingle();

    if (profileError) {
      await sb.auth.signOut();
      btn.disabled = false;
      btn.textContent = "LOGI SISSE";
      toast(errorText(profileError), true);
      return;
    }

    // Admin bootstrap: if this is the first authenticated account and there
    // is no admin yet, the SQL function permits the current authenticated
    // user to become admin exactly once. This avoids hard-coding a UUID.
    if (kind === "admin" && profile?.user_type !== "admin") {
      const { data: boot, error: bootError } = await sb.rpc("bootstrap_admin");
      if (bootError || !boot) {
        await sb.auth.signOut();
        btn.disabled = false;
        btn.textContent = "LOGI SISSE";
        toast("See konto ei ole admin. " + errorText(bootError), true);
        return;
      }
      const { data: refreshed } = await sb
        .from("profiles").select("id,username,user_type").eq("id", data.user.id).maybeSingle();
      currentProfile = refreshed;
    } else {
      currentProfile = profile;
    }

    if (kind === "admin" && currentProfile?.user_type !== "admin") {
      await sb.auth.signOut();
      btn.disabled = false;
      btn.textContent = "LOGI SISSE";
      toast("See konto ei ole admin.", true);
      return;
    }

    if (kind === "user" && currentProfile?.user_type !== "streamer") {
      await sb.auth.signOut();
      btn.disabled = false;
      btn.textContent = "LOGI SISSE";
      toast("See konto ei ole streamer.", true);
      return;
    }

    currentUser = data.user;
    closeModal();
    toast("Sisselogimine õnnestus.");
    if (kind === "admin") adminPanel();
    else streamerPanel();
  };
}

/* ---------------- STREAMER ACCOUNT ---------------- */

function streamerPanel() {
  openModal(`
    <button class="close">×</button>
    <div class="eyebrow">STREAMER</div>
    <h2>Minu konto</h2>
    <div id="myStreamerBox" class="panelbox"><div class="empty">Laen...</div></div>
    <div class="modal-actions">
      <button class="btn" id="logoutBtn">LOGI VÄLJA</button>
    </div>
  `);

  $("#logoutBtn").onclick = async () => {
    await sb.auth.signOut();
    currentUser = null;
    currentProfile = null;
    closeModal();
    toast("Välja logitud.");
  };

  loadMyStreamer();
}

async function loadMyStreamer() {
  if (!currentUser) return;

  const { data, error } = await sb
    .from("streamers")
    .select("*")
    .eq("owner_id", currentUser.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    $("#myStreamerBox").innerHTML = `<p class="error">${esc(errorText(error))}</p>`;
    return;
  }

  if (!data) {
    // Try to claim a previously approved application matching the login email.
    const { data: claimed, error: claimError } = await sb.rpc("claim_my_streamer");
    if (!claimError && claimed) return loadMyStreamer();

    $("#myStreamerBox").innerHTML = `
      <div class="empty">
        Sinu kontol pole veel kinnitatud striimeri profiili.
      </div>`;
    return;
  }

  $("#myStreamerBox").innerHTML = `
    <div class="panelbox">
      <b>${esc(data.name)}</b>
      <p class="muted">${esc(data.platform)} · ${esc(data.game || "Mäng määramata")}</p>
      <div class="switchrow">
        <span>STAATUS: <b id="myStatus">${data.is_live ? "ONLINE" : "OFFLINE"}</b></span>
        <button id="toggleLive" class="${data.is_live ? "btn" : "primary"}">
          ${data.is_live ? "LÜLITA OFFLINE" : "LÜLITA ONLINE"}
        </button>
      </div>
      <div style="margin-top:14px;color:#999">
        Vaatajad: <b id="myViewers">${Number(data.viewers || 0).toLocaleString("et-EE")}</b>
      </div>
      <div class="field" style="margin-top:14px">
        <label>VAATAJATE ARV</label>
        <input id="viewerInput" type="number" min="0" value="${Number(data.viewers || 0)}">
      </div>
      <button class="btn" id="saveViewers">SALVESTA VAATAJAD</button>
    </div>`;

  $("#toggleLive").onclick = async () => {
    const next = !data.is_live;
    const { error } = await sb
      .from("streamers")
      .update({ is_live: next, updated_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("owner_id", currentUser.id);

    if (error) {
      toast(errorText(error), true);
      return;
    }

    data.is_live = next;
    $("#myStatus").textContent = next ? "ONLINE" : "OFFLINE";
    $("#toggleLive").textContent = next ? "LÜLITA OFFLINE" : "LÜLITA ONLINE";
    $("#toggleLive").className = next ? "btn" : "primary";
    loadStreamers();
    toast(next ? "Oled nüüd ONLINE." : "Oled nüüd OFFLINE.");
  };

  $("#saveViewers").onclick = async () => {
    const viewers = Math.max(0, Number($("#viewerInput").value || 0));
    const { error } = await sb
      .from("streamers")
      .update({ viewers, updated_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("owner_id", currentUser.id);

    if (error) {
      toast(errorText(error), true);
      return;
    }

    $("#myViewers").textContent = viewers.toLocaleString("et-EE");
    loadStreamers();
    toast("Vaatajate arv salvestatud.");
  };
}

/* ---------------- ADMIN ---------------- */

function adminPanel() {
  openModal(`
    <button class="close">×</button>
    <div class="eyebrow">ADMIN</div>
    <h2>Admin</h2>
    <div id="adminContent"><div class="empty">Laen taotlusi...</div></div>
    <div class="modal-actions">
      <button class="btn" id="logoutBtn">LOGI VÄLJA</button>
    </div>
  `);

  $("#logoutBtn").onclick = async () => {
    await sb.auth.signOut();
    currentUser = null;
    currentProfile = null;
    closeModal();
    toast("Välja logitud.");
  };

  loadApplications();
}

async function loadApplications() {
  const { data, error } = await sb
    .from("streamer_applications")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    $("#adminContent").innerHTML = `<p class="error">${esc(errorText(error))}</p>`;
    return;
  }

  if (!data?.length) {
    $("#adminContent").innerHTML = `<div class="empty">Uusi taotlusi pole.</div>`;
    return;
  }

  $("#adminContent").innerHTML = data.map(a => `
    <div class="application">
      <b>${esc(a.name)}</b>
      <span>${esc(a.email)} · ${esc(a.platform)} · ${esc(a.game || "")}</span>
      <a href="${esc(a.channel_url)}" target="_blank" rel="noopener">kanal</a>
      <span class="status">${esc(a.status)}</span>
      ${a.status === "pending" ? `
        <div class="appactions">
          <button class="primary approve" data-id="${a.id}">AKSEPTEERI</button>
          <button class="btn reject" data-id="${a.id}">KEELDU</button>
        </div>` : ""}
    </div>`).join("");

  document.querySelectorAll(".approve").forEach(b => b.onclick = () => approve(b.dataset.id));
  document.querySelectorAll(".reject").forEach(b => b.onclick = () => reject(b.dataset.id));
}

async function approve(id) {
  const { error } = await sb.rpc("admin_approve_streamer", { p_application_id: id });
  if (error) {
    toast(errorText(error), true);
    return;
  }
  toast("Taotlus kinnitatud. Striimer lisati kataloogi.");
  loadApplications();
  loadStreamers();
}

async function reject(id) {
  const { error } = await sb
    .from("streamer_applications")
    .update({ status: "rejected" })
    .eq("id", id);

  if (error) {
    toast(errorText(error), true);
    return;
  }

  toast("Taotlus tagasi lükatud.");
  loadApplications();
}

/* ---------------- PUBLIC DIRECTORY ---------------- */

function card(s) {
  const live = !!s.is_live;
  const v = Number(s.viewers || 0).toLocaleString("et-EE");

  return `<article class="card">
    <div class="preview">
      ${s.thumbnail_url ? `<img src="${esc(s.thumbnail_url)}" alt="">` : ""}
      <span class="badge ${live ? "" : "offline"}">${live ? "LIVE" : "OFFLINE"}</span>
      ${live ? `<span class="viewers">👁 ${v}</span>` : ""}
    </div>
    <div class="cardbody">
      <div class="cardtitle">${esc(s.name)}</div>
      <div class="meta">${esc(s.game || "Mäng määramata")} · ${esc(s.platform)}</div>
      <a class="cardlink" href="${esc(s.channel_url)}" target="_blank" rel="noopener">AVA KANAL →</a>
    </div>
  </article>`;
}

function render() {
  const q = ($("#search")?.value || "").toLowerCase();

  const all = streamers.filter(s =>
    (currentFilter === "Kõik" || s.platform === currentFilter) &&
    (`${s.name} ${s.game || ""}`).toLowerCase().includes(q)
  );

  $("#streamerGrid").innerHTML = all.length
    ? all.map(card).join("")
    : `<div class="empty">Ühtegi striimerit ei leitud.</div>`;

  const live = all.filter(s => s.is_live);

  $("#liveGrid").innerHTML = live.length
    ? live.map(card).join("")
    : `<div class="empty">Hetkel pole kinnitatud LIVE striime.</div>`;
}

async function loadStreamers() {
  if (!sb) {
    streamers = [];
    render();
    return;
  }

  const { data, error } = await sb
    .from("streamers")
    .select("*")
    .order("is_live", { ascending: false })
    .order("name");

  if (error) {
    streamers = [];
    render();
    toast("Striimerite laadimine ebaõnnestus: " + errorText(error), true);
    return;
  }

  streamers = data || [];
  render();
}

/* ---------------- START ---------------- */

async function boot() {
  if (sb) {
    const { data } = await sb.auth.getUser();

    if (data?.user) {
      currentUser = data.user;
      const { data: p } = await sb
        .from("profiles")
        .select("id,username,user_type")
        .eq("id", data.user.id)
        .maybeSingle();
      currentProfile = p;
    }
  }

  loadStreamers();
  setInterval(loadStreamers, 60000);
}

function setup() {
  $("#joinBtn").onclick = joinModal;
  $("#userBtn").onclick = () => loginModal("user");
  $("#adminBtn").onclick = () => loginModal("admin");

  document.querySelectorAll("[data-scroll]").forEach(b =>
    b.onclick = () => document.querySelector(b.dataset.scroll)?.scrollIntoView({ behavior: "smooth" })
  );

  $("#search").oninput = render;

  const platforms = ["Kõik", "Twitch", "YouTube", "Kick", "TikTok"];
  $("#filters").innerHTML = platforms
    .map(p => `<button class="filter ${p === "Kõik" ? "active" : ""}" data-f="${p}">${p}</button>`)
    .join("");

  document.querySelectorAll(".filter").forEach(b => b.onclick = () => {
    currentFilter = b.dataset.f;
    document.querySelectorAll(".filter").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    render();
  });

  boot();
}

document.addEventListener("DOMContentLoaded", setup);
})();