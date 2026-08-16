(() => {
  "use strict";

  const C = window.STREAMHUB_CONFIG || {};
  const ADMIN_UID = "56a4036e-b37d-4928-abf2-8f49d709f5b7";
  const db = window.supabase?.createClient?.(C.SUPABASE_URL, C.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  let streamers = [];
  let currentUser = null;
  let currentProfile = null;
  let activeGame = null;
  let activePlatform = "Kõik";

  const games = [
    { name: "Fortnite", art: "https://cdn2.unrealengine.com/fortnite-battle-royale-1920x1080-8f1f3a0e2f8b.jpg" },
    { name: "Minecraft", art: "https://www.minecraft.net/content/dam/minecraftnet/games/minecraft/key-art/PDP-Hero_OV-Deluxe_16x9.jpg" },
    { name: "Call of Duty: Warzone", art: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1962663/header.jpg" },
    { name: "Apex Legends", art: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1172470/header.jpg" },
    { name: "Grand Theft Auto V", art: "https://media-rockstargames-com.akamaized.net/rockstargames-newsite/img/global/games/fob/1280/V.jpg" }
  ];

  const $ = (s) => document.querySelector(s);
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
  }[c]));

  function toast(message, bad = false) {
    const t = $("#toast");
    if (!t) return;
    t.textContent = message;
    t.className = `toast show ${bad ? "" : "good"}`;
    clearTimeout(window.__streamhubToast);
    window.__streamhubToast = setTimeout(() => { t.className = "toast"; }, 5000);
  }

  function openModal(content) {
    const root = $("#modalRoot");
    if (!root) return;
    root.innerHTML = `<div class="modal-back" id="modalBack"><div class="modal" role="dialog" aria-modal="true">${content}</div></div>`;
    $("#modalBack")?.addEventListener("click", e => { if (e.target.id === "modalBack") closeModal(); });
    $("#closeModal")?.addEventListener("click", closeModal);
  }

  function closeModal() { if ($("#modalRoot")) $("#modalRoot").innerHTML = ""; }

  function dbReady() {
    if (!db) { toast("Supabase ühendus puudub. Kontrolli config.js faili.", true); return false; }
    return true;
  }

  function supaError(e) {
    return [e?.code, e?.message, e?.details, e?.hint].filter(Boolean).join(" — ") || "Tundmatu Supabase viga";
  }

  function card(s) {
    const img = s.thumbnail_url || s.avatar_url || "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80";
    return `<article class="card">
      <div class="preview"><img src="${esc(img)}" alt="${esc(s.name)} thumbnail" loading="lazy">
        <span class="badge ${s.is_live ? "" : "offline"}">${s.is_live ? "● LIVE" : "OFFLINE"}</span>
        ${s.is_live ? `<span class="viewers">👁 ${Number(s.viewers || 0).toLocaleString("et-EE")}</span>` : ""}
      </div>
      <div class="cardbody"><div class="cardtitle">${esc(s.name)}</div>
        <div class="meta">${esc(s.game || "Streaming")} · ${esc(s.platform)}</div>
        <a class="cardlink" href="${esc(s.channel_url)}" target="_blank" rel="noopener">${s.is_live ? "VAATA LIVE'I →" : "AVA KANAL →"}</a>
      </div>
    </article>`;
  }

  function filtered() {
    const q = ($( "#search")?.value || "").trim().toLowerCase();
    return streamers.filter(s =>
      (activePlatform === "Kõik" || s.platform === activePlatform) &&
      (!activeGame || String(s.game || "").trim().toLowerCase() === activeGame.toLowerCase()) &&
      (`${s.name} ${s.game || ""}`).toLowerCase().includes(q)
    );
  }

  function render() {
    const rows = filtered();
    const live = rows.filter(s => s.is_live);
    $("#liveGrid").innerHTML = live.length ? live.map(card).join("") : `<div class="empty">Hetkel pole valitud vaates ühtegi LIVE striimerit.</div>`;
    $("#streamerGrid").innerHTML = rows.length ? rows.map(card).join("") : `<div class="empty">Ühtegi striimerit ei leitud.</div>`;
    renderGames();
  }

  function renderGames() {
    const strip = $("#gameStrip");
    const results = $("#gameResults");
    if (!strip || !results) return;
    strip.innerHTML = games.map(g => {
      const count = streamers.filter(s => String(s.game || "").trim().toLowerCase() === g.name.toLowerCase() && s.is_live).length;
      return `<button type="button" class="game-tile ${activeGame === g.name ? "active" : ""}" data-game="${esc(g.name)}">
        <span class="game-art" style="background-image:url('${esc(g.art)}')"></span>
        <span class="game-name">${esc(g.name)}</span><span class="game-count">${count} LIVE</span>
      </button>`;
    }).join("");
    strip.querySelectorAll("[data-game]").forEach(b => b.addEventListener("click", () => {
      activeGame = b.dataset.game;
      render();
      $("#games")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }));

    if (!activeGame) { results.classList.add("hidden"); results.innerHTML = ""; return; }
    const found = streamers.filter(s => String(s.game || "").trim().toLowerCase() === activeGame.toLowerCase());
    results.classList.remove("hidden");
    results.innerHTML = `<div class="game-results-title">${esc(activeGame)} — ${found.length} striimerit</div>
      <div class="game-results-grid">${found.length ? found.map(card).join("") : `<div class="empty">Selle mängu all pole veel striimereid.</div>`}</div>`;
  }

  function setupFilters() {
    const ps = ["Kõik", "Twitch", "YouTube", "Kick", "TikTok"];
    $("#platformFilters").innerHTML = ps.map((p, i) => `<button type="button" class="filter ${i === 0 ? "active" : ""}" data-platform="${p}">${p}</button>`).join("");
    $("#platformFilters").querySelectorAll("[data-platform]").forEach(b => b.addEventListener("click", () => {
      activePlatform = b.dataset.platform;
      $("#platformFilters").querySelectorAll(".filter").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      render();
    }));
  }

  function accountModal(tab = "login") {
    openModal(`<button class="close-btn" id="closeModal">×</button>
      <div class="eyebrow">STREAMHUB KASUTAJA</div><h2>Kasutaja</h2>
      <div class="account-tabs">
        <button type="button" class="btn ${tab === "login" ? "primary" : ""}" id="tabLogin">Logi sisse</button>
        <button type="button" class="btn ${tab === "signup" ? "primary" : ""}" id="tabSignup">Loo konto</button>
        <button type="button" class="btn" id="tabJoin">Liitu striimerina</button>
      </div><div id="accountBody"></div>`);
    $("#tabLogin").onclick = () => accountModal("login");
    $("#tabSignup").onclick = () => accountModal("signup");
    $("#tabJoin").onclick = joinModal;
    tab === "signup" ? signupForm() : loginForm();
  }

  function loginForm() {
    $("#accountBody").innerHTML = `<form id="loginForm" class="formgrid">
      <div class="field"><label>E-POST</label><input name="email" type="email" autocomplete="email" required></div>
      <div class="field"><label>PAROOL</label><input name="password" type="password" autocomplete="current-password" required></div>
      <button type="submit" class="primary full">LOGI SISSE</button>
      <div id="accountError" class="notice error hidden"></div></form>`;
    $("#loginForm").addEventListener("submit", async e => {
      e.preventDefault();
      if (!dbReady()) return;
      const d = Object.fromEntries(new FormData(e));
      const { data, error } = await db.auth.signInWithPassword({ email: d.email.trim(), password: d.password });
      if (error) { showAccountError(supaError(error)); return; }
      currentUser = data.user;
      if (currentUser.id === ADMIN_UID) {
        closeModal(); toast("Adminina sisse logitud."); adminModal(); return;
      }
      await loadProfile();
      closeModal(); toast("Sisse logitud."); userModal();
    });
  }

  function signupForm() {
    $("#accountBody").innerHTML = `<form id="signupForm" class="formgrid">
      <div class="field"><label>KASUTAJANIMI</label><input name="username" autocomplete="username" required minlength="2" maxlength="40"></div>
      <div class="field"><label>E-POST</label><input name="email" type="email" autocomplete="email" required></div>
      <div class="field"><label>PAROOL</label><input name="password" type="password" autocomplete="new-password" minlength="6" required></div>
      <div class="field"><label>PAROOL UUESTI</label><input name="password2" type="password" autocomplete="new-password" minlength="6" required></div>
      <button type="submit" class="primary full">LOO KONTO</button>
      <div id="accountError" class="notice error hidden"></div></form>`;
    $("#signupForm").addEventListener("submit", async e => {
      e.preventDefault();
      if (!dbReady()) return;
      const d = Object.fromEntries(new FormData(e));
      if (d.password !== d.password2) { showAccountError("Paroolid ei kattu."); return; }
      const { data, error } = await db.auth.signUp({
        email: d.email.trim(), password: d.password,
        options: { data: { username: d.username.trim() } }
      });
      if (error) { showAccountError(supaError(error)); return; }
      if (!data.user) { showAccountError("Konto loomine ebaõnnestus."); return; }
      if (!data.session) {
        $("#accountBody").innerHTML = `<div class="notice success"><b>Konto on loodud.</b><br><br>Supabase nõuab praegu e-posti kinnitamist. Ava oma Gmailis kinnituslink ja seejärel vajuta KASUTAJA → LOGI SISSE.</div>`;
        return;
      }
      currentUser = data.user;
      await loadProfile();
      closeModal(); toast("Konto loodud."); userModal();
    });
  }

  function showAccountError(message) {
    const x = $("#accountError");
    if (!x) return;
    x.textContent = message; x.classList.remove("hidden");
  }

  async function loadProfile() {
    currentProfile = null;
    if (!currentUser || !db) return;
    const { data } = await db.from("profiles").select("id,username,role").eq("id", currentUser.id).maybeSingle();
    currentProfile = data || null;
  }

  function joinModal() {
    openModal(`<button class="close-btn" id="closeModal">×</button><div class="eyebrow">STREAMER</div>
      <h2>Liitu striimerina</h2><p class="muted">Saada andmed. Admin vaatab taotluse üle. Pärast kinnitamist saad sama e-postiga kasutaja kaudu oma profiili hallata.</p>
      <form id="joinForm" class="formgrid">
        <div class="field"><label>STRIIMERI NIMI</label><input name="name" required maxlength="80"></div>
        <div class="field"><label>GMAIL / E-POST</label><input name="email" type="email" required maxlength="254"></div>
        <div class="field"><label>PLATVORM</label><select name="platform"><option>Twitch</option><option>YouTube</option><option>Kick</option><option>TikTok</option></select></div>
        <div class="field"><label>KANALI URL</label><input name="channel_url" type="url" required></div>
        <div class="field"><label>MIDA SA STRIIMID?</label><input name="game" placeholder="Fortnite"></div>
        <div class="field"><label>AVATARI URL (valikuline)</label><input name="avatar_url" type="url"></div>
        <div class="field"><label>SÕNUM (valikuline)</label><textarea name="message"></textarea></div>
        <div class="modal-actions"><button type="button" class="btn" id="cancelJoin">Tühista</button><button type="submit" class="primary">SAADA TAOTLUS</button></div>
        <div id="joinError" class="notice error hidden"></div></form>`);
    $("#cancelJoin").onclick = closeModal;
    $("#joinForm").addEventListener("submit", async e => {
      e.preventDefault(); if (!dbReady()) return;
      const d = Object.fromEntries(new FormData(e));
      const { error } = await db.from("streamer_applications").insert({
        name: d.name.trim(), email: d.email.trim().toLowerCase(), platform: d.platform,
        channel_url: d.channel_url.trim(), game: d.game?.trim() || null,
        avatar_url: d.avatar_url?.trim() || null, message: d.message?.trim() || null, status: "pending"
      });
      if (error) { const x=$("#joinError"); x.textContent=supaError(error); x.classList.remove("hidden"); return; }
      closeModal(); toast("Taotlus saadetud. Admin vaatab selle üle.");
    });
  }

  async function userModal() {
    if (!currentUser) { accountModal("login"); return; }
    await loadProfile();
    openModal(`<button class="close-btn" id="closeModal">×</button><div class="eyebrow">MINU KONTO</div>
      <h2>${esc(currentProfile?.username || currentUser.email?.split("@")[0] || "Kasutaja")}</h2><div id="userPanel"><div class="notice">Laen kontot...</div></div>`);
    await loadUserPanel();
  }

  async function loadUserPanel() {
    const p = $("#userPanel"); if (!p) return;
    const { data: s, error } = await db.from("streamers").select("*").eq("owner_id", currentUser.id).maybeSingle();
    if (error) { p.innerHTML = `<div class="notice error">${esc(supaError(error))}</div>`; return; }
    p.innerHTML = `<div class="account-panel"><div class="notice">${esc(currentUser.email || "")} · ${esc(currentProfile?.role || "user")}</div>
      ${s ? streamerControls(s) : `<div class="notice">Kinnitatud striimeriprofiili ei leitud. Kui admin on sinu taotluse kinnitanud, vajuta allolevat nuppu.</div><button type="button" class="primary" id="claimBtn">VÕTA OMA STRIIMERIPROFIIL</button>`}
      <button type="button" class="btn" id="logoutUser">LOGI VÄLJA</button></div>`;
    $("#logoutUser").onclick = async () => { await db.auth.signOut(); currentUser=null; currentProfile=null; closeModal(); toast("Välja logitud."); };
    $("#claimBtn")?.addEventListener("click", claimStreamer);
    $("#toggleLive")?.addEventListener("click", () => toggleLive(s));
    $("#saveViewers")?.addEventListener("click", () => saveViewers(s));
  }

  function streamerControls(s) {
    return `<div class="notice">${esc(s.platform)} · ${esc(s.game || "Streaming")}<br><a href="${esc(s.channel_url)}" target="_blank" rel="noopener">${esc(s.channel_url)}</a></div>
      <div class="live-switch ${s.is_live ? "online" : ""}"><span>STAATUS<br><strong>${s.is_live ? "ONLINE" : "OFFLINE"}</strong></span><button type="button" class="primary" id="toggleLive">${s.is_live ? "LÜLITA OFFLINE" : "LÜLITA ONLINE"}</button></div>
      <div class="field"><label>VAATAJAD</label><input id="viewerValue" type="number" min="0" value="${Number(s.viewers || 0)}"></div>
      <button type="button" class="btn" id="saveViewers">SALVESTA VAATAJAD</button>`;
  }

  async function toggleLive(s) {
    const next = !s.is_live;
    const { error } = await db.rpc("set_my_stream_status", { p_is_live: next, p_viewers: next ? Number(s.viewers || 0) : 0 });
    if (error) { toast(supaError(error), true); return; }
    toast(next ? "Oled nüüd ONLINE." : "Oled nüüd OFFLINE."); await loadStreamers(); await loadUserPanel();
  }

  async function saveViewers(s) {
    const v = Math.max(0, Number($("#viewerValue")?.value || 0));
    const { error } = await db.rpc("set_my_stream_status", { p_is_live: true, p_viewers: v });
    if (error) { toast(supaError(error), true); return; }
    toast("Vaatajate arv salvestatud."); await loadStreamers(); await loadUserPanel();
  }

  async function claimStreamer() {
    const { data, error } = await db.rpc("claim_my_streamer");
    if (error) { toast(supaError(error), true); return; }
    if (!data) { toast("Kinnitatud striimeriprofiili ei leitud.", true); return; }
    toast("Striimeriprofiil ühendatud."); await loadStreamers(); await loadUserPanel();
  }

  function adminModal() {
    openModal(`<button class="close-btn" id="closeModal">×</button><div class="eyebrow">ADMIN PANEL</div><h2>Striimerid & taotlused</h2>
      <div class="account-tabs"><button type="button" class="btn primary" id="adminStreamsTab">Striimerid</button><button type="button" class="btn" id="adminAppsTab">Taotlused</button></div><div id="adminBody"></div>`);
    $("#adminStreamsTab").onclick = loadAdminStreams; $("#adminAppsTab").onclick = loadAdminApps; loadAdminStreams();
  }

  async function adminLogin() {
    openModal(`<button class="close-btn" id="closeModal">×</button><div class="eyebrow">STREAMHUB ADMIN</div><h2>Admini sisselogimine</h2>
      <p class="muted">Logi sisse oma olemasoleva Supabase admin-kontoga.</p><form id="adminLoginForm" class="formgrid">
      <div class="field"><label>E-POST</label><input name="email" type="email" autocomplete="username" required></div>
      <div class="field"><label>PAROOL</label><input name="password" type="password" autocomplete="current-password" required></div>
      <button type="submit" class="primary full">LOGI SISSE</button><div id="adminLoginError" class="notice error hidden"></div></form>`);
    $("#adminLoginForm").addEventListener("submit", async e => {
      e.preventDefault(); if (!dbReady()) return;
      const d = Object.fromEntries(new FormData(e));
      // Always sign in with the supplied credentials, even if another user is already logged in.
      await db.auth.signOut();
      const { data, error } = await db.auth.signInWithPassword({ email: d.email.trim(), password: d.password });
      if (error) { $("#adminLoginError").textContent=supaError(error); $("#adminLoginError").classList.remove("hidden"); return; }
      if (data.user.id !== ADMIN_UID) {
        await db.auth.signOut();
        $("#adminLoginError").textContent="See konto ei ole StreamHubi admin-konto.";
        $("#adminLoginError").classList.remove("hidden"); return;
      }
      currentUser = data.user; closeModal(); toast("Adminina sisse logitud."); adminModal();
    });
  }

  async function loadAdminStreams() {
    const b=$("#adminBody"); if(!b) return;
    const {data,error}=await db.from("streamers").select("*").order("name");
    if(error){b.innerHTML=`<div class="notice error">${esc(supaError(error))}</div>`;return;}
    b.innerHTML=`<div class="notice">Olemasolevad striimerid</div>${(data||[]).map(s=>`<div class="app-row"><b>${esc(s.name)}</b><div class="meta">${esc(s.platform)} · ${esc(s.game||"Streaming")} · ${s.is_live?"🔴 LIVE":"offline"}</div><div class="admin-actions"><button type="button" class="btn" data-admin-edit="${s.id}">Muuda</button><button type="button" class="danger" data-admin-delete="${s.id}">Kustuta</button></div></div>`).join("")||`<div class="empty">Pole striimereid.</div>`}`;
    b.querySelectorAll("[data-admin-delete]").forEach(x=>x.onclick=()=>adminDelete(x.dataset.adminDelete));
    b.querySelectorAll("[data-admin-edit]").forEach(x=>x.onclick=()=>adminEdit(x.dataset.adminEdit));
  }

  async function loadAdminApps() {
    const b=$("#adminBody"); if(!b) return;
    const {data,error}=await db.from("streamer_applications").select("*").order("created_at",{ascending:false});
    if(error){b.innerHTML=`<div class="notice error">${esc(supaError(error))}</div>`;return;}
    b.innerHTML=(data||[]).map(a=>`<div class="app-row"><b>${esc(a.name)}</b><div class="meta">${esc(a.email)} · ${esc(a.platform)} · ${esc(a.game||"")}</div><div class="meta"><a href="${esc(a.channel_url)}" target="_blank" rel="noopener">${esc(a.channel_url)}</a></div><div class="meta">Staatus: <b>${esc(a.status)}</b></div>${a.status==="pending"?`<div class="admin-actions"><button type="button" class="primary" data-approve="${a.id}">AKSEPTEERI</button><button type="button" class="danger" data-reject="${a.id}">KEELDU</button></div>`:""}</div>`).join("")||`<div class="empty">Taotlusi pole.</div>`;
    b.querySelectorAll("[data-approve]").forEach(x=>x.onclick=()=>approveApp(x.dataset.approve));
    b.querySelectorAll("[data-reject]").forEach(x=>x.onclick=()=>rejectApp(x.dataset.reject));
  }

  async function approveApp(id) {
    const {error}=await db.rpc("admin_approve_application",{p_application_id:id});
    if(error){toast(supaError(error),true);return;}
    toast("Taotlus kinnitatud ja striimeriprofiil loodud."); await loadStreamers(); await loadAdminApps();
  }

  async function rejectApp(id) {
    const {error}=await db.from("streamer_applications").update({status:"rejected"}).eq("id",id);
    if(error){toast(supaError(error),true);return;}
    toast("Taotlus tagasi lükatud."); await loadAdminApps();
  }

  async function adminDelete(id) {
    if(!confirm("Kustuta striimer?")) return;
    const {error}=await db.from("streamers").delete().eq("id",id);
    if(error){toast(supaError(error),true);return;}
    toast("Kustutatud."); await loadStreamers(); await loadAdminStreams();
  }

  function adminEdit(id) {
    const s=streamers.find(x=>x.id===id); if(!s) return;
    const b=$("#adminBody");
    b.innerHTML=`<div class="field"><label>NIMI</label><input id="aName" value="${esc(s.name)}"></div><div class="field"><label>MÄNG</label><input id="aGame" value="${esc(s.game||"")}"></div><div class="field"><label>THUMBNAIL URL</label><input id="aThumb" value="${esc(s.thumbnail_url||"")}"></div><div class="field"><label>KANALI URL</label><input id="aUrl" value="${esc(s.channel_url)}"></div><div class="modal-actions"><button type="button" class="btn" id="backAdmin">Tagasi</button><button type="button" class="primary" id="saveAdmin">Salvesta</button></div>`;
    $("#backAdmin").onclick=loadAdminStreams;
    $("#saveAdmin").onclick=async()=>{const {error}=await db.from("streamers").update({name:$("#aName").value.trim(),game:$("#aGame").value.trim()||null,thumbnail_url:$("#aThumb").value.trim()||null,channel_url:$("#aUrl").value.trim(),updated_at:new Date().toISOString()}).eq("id",id);if(error){toast(supaError(error),true);return;}toast("Salvestatud.");await loadStreamers();loadAdminStreams();};
  }

  async function loadStreamers() {
    if(!dbReady()) return;
    const {data,error}=await db.from("streamers").select("*").order("is_live",{ascending:false}).order("viewers",{ascending:false}).order("name");
    if(error){toast("Striimerite laadimine ebaõnnestus: "+supaError(error),true);return;}
    streamers=data||[]; render();
  }

  async function boot() {
    if(!dbReady()) return;
    const {data}=await db.auth.getSession();
    currentUser=data.session?.user||null;
    if(currentUser && currentUser.id!==ADMIN_UID) await loadProfile();
    setupFilters(); renderGames(); await loadStreamers();
    db.auth.onAuthStateChange((event,session)=>{
      currentUser=session?.user||null;
      if(currentUser && currentUser.id!==ADMIN_UID) loadProfile(); else currentProfile=null;
    });
  }

  function setup() {
    // Explicit listeners. These are installed only after the DOM exists.
    $("#userBtn").addEventListener("click", e => { e.preventDefault(); currentUser ? userModal() : accountModal("login"); });
    $("#adminBtn").addEventListener("click", e => { e.preventDefault(); adminLogin(); });
    $("#search").addEventListener("input", render);
    $("#clearGameFilter").addEventListener("click", () => { activeGame=null; render(); });
    $("[data-scroll=\"#live\"]")?.addEventListener("click", e=>{e.preventDefault();$("#live")?.scrollIntoView({behavior:"smooth"});});
    $("[data-scroll=\"#streamers\"]")?.addEventListener("click", e=>{e.preventDefault();$("#streamers")?.scrollIntoView({behavior:"smooth"});});
    boot();
  }

  document.addEventListener("DOMContentLoaded", setup);
})();
