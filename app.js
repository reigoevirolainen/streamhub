(() => {
  "use strict";

  const C = window.STREAMHUB_CONFIG || {};
  const ADMIN_UID = "56a4036e-b37d-4928-abf2-8f49d709f5b7";
  const hasConfig = Boolean(C.SUPABASE_URL && C.SUPABASE_PUBLISHABLE_KEY);
  const db = hasConfig && window.supabase?.createClient
    ? window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_PUBLISHABLE_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      })
    : null;

  let streamers = [];
  let currentUser = null;
  let currentProfile = null;
  let activeGame = null;
  let activePlatform = "Kõik";
  let booted = false;

  const games = [
    { name: "Fortnite", art: "assets/games/fortnite.svg" },
    { name: "Minecraft", art: "assets/games/minecraft.svg" },
    { name: "Call of Duty: Warzone", art: "assets/games/warzone.svg" },
    { name: "Apex Legends", art: "assets/games/apex.svg" },
    { name: "Grand Theft Auto V", art: "assets/games/gta5.svg" },
    { name: "VALORANT", art: "assets/games/valorant.svg" }
  ];

  const $ = (s) => document.querySelector(s);
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

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
  function closeModal() { const r=$("#modalRoot"); if(r) r.innerHTML=""; }

  function dbReady() {
    if (!db) { toast("Supabase ühendus puudub. Kontrolli config.js faili.", true); return false; }
    return true;
  }
  function supaError(e) {
    return [e?.code, e?.status, e?.message, e?.details, e?.hint].filter(Boolean).join(" — ") || "Tundmatu Supabase viga";
  }
  function setBusy(form, busy, text="Töötlen…") {
    if (!form) return;
    form.querySelectorAll("button[type=submit]").forEach(b => { b.disabled=busy; if(busy){b.dataset.oldText=b.textContent;b.textContent=text;}else if(b.dataset.oldText){b.textContent=b.dataset.oldText;} });
  }
  function showError(id, message) { const x=$(id); if(!x) return; x.textContent=message; x.classList.remove("hidden"); }

  function fallbackGameArt(name) {
    const colors = {"Fortnite":"#6d3df2","Minecraft":"#55a83b","Call of Duty: Warzone":"#4a4a4a","Apex Legends":"#b4475a","Grand Theft Auto V":"#7a9d3a","VALORANT":"#d93b58"};
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="500"><rect width="100%" height="100%" fill="${colors[name]||'#333'}"/><rect width="100%" height="100%" fill="url(#g)"/><defs><linearGradient id="g" x1="0" x2="1"><stop stop-color="#000" stop-opacity=".15"/><stop offset="1" stop-color="#000" stop-opacity=".65"/></linearGradient></defs><text x="50%" y="52%" text-anchor="middle" fill="white" font-family="Arial,sans-serif" font-weight="900" font-size="64">${name.toUpperCase()}</text></svg>`)}`;
  }

  function card(s) {
    const img = s.thumbnail_url || s.avatar_url || "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80";
    const safeUrl = /^https?:\/\//i.test(String(s.channel_url||"")) ? s.channel_url : "#";
    return `<article class="card"><div class="preview"><img src="${esc(img)}" alt="${esc(s.name)} thumbnail" loading="lazy" onerror="this.src='${fallbackGameArt(s.game||'Gaming')}'"><span class="badge ${s.is_live ? "" : "offline"}">${s.is_live ? "● LIVE" : "OFFLINE"}</span>${s.is_live ? `<span class="viewers">👁 ${Number(s.viewers||0).toLocaleString("et-EE")}</span>` : ""}</div><div class="cardbody"><div class="cardtitle">${esc(s.name)}</div><div class="meta">${esc(s.game||"Streaming")} · ${esc(s.platform||"")}</div><a class="cardlink" href="${esc(safeUrl)}" target="_blank" rel="noopener">${s.is_live ? "VAATA LIVE'I →" : "AVA KANAL →"}</a></div></article>`;
  }

  function filtered() {
    const q=($("#search")?.value||"").trim().toLowerCase();
    return streamers.filter(s => (activePlatform==="Kõik"||s.platform===activePlatform) && (!activeGame||String(s.game||"").trim().toLowerCase()===activeGame.toLowerCase()) && (`${s.name} ${s.game||""}`).toLowerCase().includes(q));
  }
  function render(){
    const rows=filtered(), live=rows.filter(s=>s.is_live);
    const lg=$("#liveGrid"), sg=$("#streamerGrid");
    if(lg) lg.innerHTML=live.length?live.map(card).join(""):`<div class="empty">Hetkel pole valitud vaates ühtegi LIVE striimerit.</div>`;
    if(sg) sg.innerHTML=rows.length?rows.map(card).join(""):`<div class="empty">Ühtegi striimerit ei leitud.</div>`;
    renderGames();
  }
  function renderGames(){
    const strip=$("#gameStrip"), results=$("#gameResults"); if(!strip||!results)return;
    strip.innerHTML=games.map(g=>{const count=streamers.filter(s=>String(s.game||"").trim().toLowerCase()===g.name.toLowerCase()&&s.is_live).length; return `<button type="button" class="game-tile ${activeGame===g.name?"active":""}" data-game="${esc(g.name)}"><span class="game-art" style="background-image:url('${esc(g.art)}')"></span><span class="game-name">${esc(g.name)}</span><span class="game-count">${count} LIVE</span></button>`}).join("");
    strip.querySelectorAll("[data-game]").forEach(b=>b.addEventListener("click",()=>{activeGame=b.dataset.game;render();$("#games")?.scrollIntoView({behavior:"smooth",block:"start"})}));
    if(!activeGame){results.classList.add("hidden");results.innerHTML="";return;}
    const found=streamers.filter(s=>String(s.game||"").trim().toLowerCase()===activeGame.toLowerCase());
    results.classList.remove("hidden"); results.innerHTML=`<div class="game-results-title">${esc(activeGame)} — ${found.length} striimerit</div><div class="game-results-grid">${found.length?found.map(card).join(""):`<div class="empty">Selle mängu all pole veel striimereid.</div>`}</div>`;
  }
  function setupFilters(){
    const ps=["Kõik","Twitch","YouTube","Kick","TikTok"], el=$("#platformFilters"); if(!el)return;
    el.innerHTML=ps.map((p,i)=>`<button type="button" class="filter ${i===0?"active":""}" data-platform="${esc(p)}">${esc(p)}</button>`).join("");
    el.querySelectorAll("[data-platform]").forEach(b=>b.addEventListener("click",()=>{activePlatform=b.dataset.platform;el.querySelectorAll(".filter").forEach(x=>x.classList.remove("active"));b.classList.add("active");render()}));
  }

  function accountModal(tab="login"){
    openModal(`<button class="close-btn" id="closeModal">×</button><div class="eyebrow">STREAMHUB KASUTAJA</div><h2>Kasutaja</h2><div class="account-tabs"><button type="button" class="btn ${tab==="login"?"primary":""}" id="tabLogin">Logi sisse</button><button type="button" class="btn ${tab==="signup"?"primary":""}" id="tabSignup">Loo konto</button><button type="button" class="btn" id="tabJoin">Liitu striimerina</button></div><div id="accountBody"></div>`);
    $("#tabLogin").onclick=()=>accountModal("login"); $("#tabSignup").onclick=()=>accountModal("signup"); $("#tabJoin").onclick=joinModal;
    tab==="signup"?signupForm():loginForm();
  }
  function loginForm(){
    $("#accountBody").innerHTML=`<form id="loginForm" class="formgrid" novalidate><div class="field"><label>E-POST</label><input name="email" type="email" autocomplete="email" required></div><div class="field"><label>PAROOL</label><input name="password" type="password" autocomplete="current-password" required></div><button type="submit" class="primary full">LOGI SISSE</button><div id="accountError" class="notice error hidden"></div></form>`;
    $("#loginForm").addEventListener("submit",async e=>{e.preventDefault();const form=e.currentTarget;if(!form.reportValidity())return;if(!dbReady())return;setBusy(form,true,"LOGIM SISSE…");try{const d=Object.fromEntries(new FormData(form));const {data,error}=await db.auth.signInWithPassword({email:d.email.trim().toLowerCase(),password:d.password});if(error){showError("#accountError",supaError(error));return;}currentUser=data.user;if(currentUser.id===ADMIN_UID){closeModal();toast("Adminina sisse logitud.");adminModal();return;}await loadProfile();closeModal();toast("Sisse logitud.");userModal();}catch(err){showError("#accountError",supaError(err));}finally{setBusy(form,false);}});
  }
  function signupForm(){
    $("#accountBody").innerHTML=`<form id="signupForm" class="formgrid" novalidate><div class="field"><label>KASUTAJANIMI</label><input name="username" autocomplete="username" required minlength="2" maxlength="40"></div><div class="field"><label>E-POST</label><input name="email" type="email" autocomplete="email" required></div><div class="field"><label>PAROOL</label><input name="password" type="password" autocomplete="new-password" minlength="6" required></div><div class="field"><label>PAROOL UUESTI</label><input name="password2" type="password" autocomplete="new-password" minlength="6" required></div><button type="submit" class="primary full">LOO KONTO</button><div id="accountError" class="notice error hidden"></div></form>`;
    $("#signupForm").addEventListener("submit",async e=>{e.preventDefault();const form=e.currentTarget;if(!form.reportValidity())return;if(!dbReady())return;setBusy(form,true,"LOON KONTO…");try{const d=Object.fromEntries(new FormData(form));if(d.password!==d.password2){showError("#accountError","Paroolid ei kattu.");return;}const {data,error}=await db.auth.signUp({email:d.email.trim().toLowerCase(),password:d.password,options:{data:{username:d.username.trim(),display_name:d.username.trim()}}});if(error){showError("#accountError",supaError(error));return;}if(!data.user){showError("#accountError","Konto loomine ebaõnnestus.");return;}if(!data.session){$("#accountBody").innerHTML=`<div class="notice success"><b>Konto on loodud.</b><br><br>Supabase nõuab e-posti kinnitamist. Ava ${esc(d.email)} postkastis kinnituslink ja logi seejärel sisse.</div>`;return;}currentUser=data.user;await loadProfile();closeModal();toast("Konto loodud.");userModal();}catch(err){showError("#accountError",supaError(err));}finally{setBusy(form,false);}});
  }

  function joinModal(){
    openModal(`<button class="close-btn" id="closeModal">×</button><div class="eyebrow">STREAMER</div><h2>Liitu striimerina</h2><p class="muted">Saada andmed. Admin vaatab taotluse üle. Kinnitamisel saad sama e-postiga kasutaja kaudu oma profiili hallata.</p><form id="joinForm" class="formgrid"><div class="field"><label>STRIIMERI NIMI</label><input name="name" required maxlength="80"></div><div class="field"><label>GMAIL / E-POST</label><input name="email" type="email" required maxlength="254"></div><div class="field"><label>PLATVORM</label><select name="platform"><option>Twitch</option><option>YouTube</option><option>Kick</option><option>TikTok</option></select></div><div class="field"><label>KANALI URL</label><input name="channel_url" type="url" placeholder="https://..." required></div><div class="field"><label>MIDA SA STRIIMID?</label><input name="game" placeholder="Fortnite"></div><div class="field"><label>AVATARI URL (valikuline)</label><input name="avatar_url" type="url" placeholder="https://..."></div><div class="field"><label>SÕNUM (valikuline)</label><textarea name="message"></textarea></div><div class="modal-actions"><button type="button" class="btn" id="cancelJoin">Tühista</button><button type="submit" class="primary">SAADA TAOTLUS</button></div><div id="joinError" class="notice error hidden"></div></form>`);
    $("#cancelJoin").onclick=closeModal;
    $("#joinForm").addEventListener("submit",async e=>{e.preventDefault();const form=e.currentTarget;if(!form.reportValidity())return;if(!dbReady())return;setBusy(form,true,"SAADAN…");try{const d=Object.fromEntries(new FormData(form));const {data,error}=await db.rpc("submit_streamer_application",{p_name:d.name.trim(),p_email:d.email.trim().toLowerCase(),p_platform:d.platform,p_channel_url:d.channel_url.trim(),p_game:d.game?.trim()||null,p_avatar_url:d.avatar_url?.trim()||null,p_message:d.message?.trim()||null});if(error){showError("#joinError",supaError(error));return;}if(!data){showError("#joinError","Taotluse ID puudub. Kontrolli Supabase'i funktsiooni.");return;}closeModal();toast("Taotlus saadetud. Admin vaatab selle üle.");}catch(err){showError("#joinError",supaError(err));}finally{setBusy(form,false);}});
  }

  async function loadProfile(){
    currentProfile=null;if(!currentUser||!db)return;
    const {data,error}=await db.from("profiles").select("id,username,user_type,email,display_name,avatar_url").eq("id",currentUser.id).maybeSingle();
    if(!error&&data){currentProfile=data;return;}
    const {data:ensured,error:ensureError}=await db.rpc("ensure_my_profile");
    if(!ensureError) currentProfile=ensured||null;
  }
  async function userModal(){
    if(!currentUser){accountModal("login");return;}await loadProfile();
    openModal(`<button class="close-btn" id="closeModal">×</button><div class="eyebrow">MINU KONTO</div><h2>${esc(currentProfile?.username||currentUser.email?.split("@")[0]||"Kasutaja")}</h2><div id="userPanel"><div class="notice">Laen kontot…</div></div>`);await loadUserPanel();
  }
  async function loadUserPanel(){
    const p=$("#userPanel");if(!p||!currentUser)return;
    const {data:s,error}=await db.from("streamers").select("id,name,platform,channel_url,game,is_live,viewers,thumbnail_url,owner_id,owner_email").eq("owner_id",currentUser.id).maybeSingle();
    if(error){p.innerHTML=`<div class="notice error">${esc(supaError(error))}</div>`;return;}
    p.innerHTML=`<div class="account-panel"><div class="notice">${esc(currentUser.email||"")} · ${esc(currentProfile?.user_type||"streamer")}</div>${s?streamerControls(s):`<div class="notice">Kinnitatud striimeriprofiili ei leitud. Kui admin on sinu taotluse kinnitanud, vajuta allolevat nuppu.</div><button type="button" class="primary" id="claimBtn">VÕTA OMA STRIIMERIPROFIIL</button>`}<button type="button" class="btn" id="logoutUser">LOGI VÄLJA</button></div>`;
    $("#logoutUser").onclick=async()=>{await db.auth.signOut();currentUser=null;currentProfile=null;closeModal();toast("Välja logitud.");};
    $("#claimBtn")?.addEventListener("click",claimStreamer);$("#toggleLive")?.addEventListener("click",()=>toggleLive(s));
  }
  function streamerControls(s){return `<div class="notice">${esc(s.platform)} · ${esc(s.game||"Streaming")}<br><a href="${esc(s.channel_url)}" target="_blank" rel="noopener">${esc(s.channel_url)}</a></div><div class="live-switch ${s.is_live?"online":""}"><span>STAATUS<br><strong>${s.is_live?"ONLINE":"OFFLINE"}</strong></span><button type="button" class="primary" id="toggleLive">${s.is_live?"LÜLITA OFFLINE":"LÜLITA ONLINE"}</button></div><div class="notice">Vaatajate arv tuleb automaatselt platvormi API-st. Seda numbrit ei saa striimer ise muuta.</div>`;}
  async function toggleLive(s){const next=!s.is_live;const {error}=await db.rpc("set_my_stream_live",{p_is_live:next});if(error){toast(supaError(error),true);return;}toast(next?"Oled nüüd ONLINE.":"Oled nüüd OFFLINE.");await loadStreamers();await loadUserPanel();}
  async function claimStreamer(){const {data,error}=await db.rpc("claim_my_streamer");if(error){toast(supaError(error),true);return;}if(!data){toast("Kinnitatud striimeriprofiili ei leitud.",true);return;}toast("Striimeriprofiil ühendatud.");await loadStreamers();await loadUserPanel();}

  function adminModal(){openModal(`<button class="close-btn" id="closeModal">×</button><div class="eyebrow">ADMIN PANEL</div><h2>Striimerid & taotlused</h2><div class="account-tabs"><button type="button" class="btn primary" id="adminStreamsTab">Striimerid</button><button type="button" class="btn" id="adminAppsTab">Taotlused</button></div><div id="adminBody"></div>`);$("#adminStreamsTab").onclick=loadAdminStreams;$("#adminAppsTab").onclick=loadAdminApps;loadAdminStreams();}
  async function adminLogin(){
    openModal(`<button class="close-btn" id="closeModal">×</button><div class="eyebrow">STREAMHUB ADMIN</div><h2>Admini sisselogimine</h2><p class="muted">Logi sisse oma olemasoleva StreamHub admin-kontoga.</p><form id="adminLoginForm" class="formgrid"><div class="field"><label>E-POST</label><input name="email" type="email" autocomplete="username" required></div><div class="field"><label>PAROOL</label><input name="password" type="password" autocomplete="current-password" required></div><button type="submit" class="primary full">LOGI SISSE</button><div id="adminLoginError" class="notice error hidden"></div></form>`);
    $("#adminLoginForm").addEventListener("submit",async e=>{e.preventDefault();const form=e.currentTarget;if(!form.reportValidity())return;if(!dbReady())return;setBusy(form,true,"LOGIM SISSE…");try{const d=Object.fromEntries(new FormData(form));await db.auth.signOut();const {data,error}=await db.auth.signInWithPassword({email:d.email.trim().toLowerCase(),password:d.password});if(error){showError("#adminLoginError",supaError(error));return;}if(data.user.id!==ADMIN_UID){await db.auth.signOut();showError("#adminLoginError","See konto ei ole StreamHubi admin-konto.");return;}currentUser=data.user;closeModal();toast("Adminina sisse logitud.");adminModal();}catch(err){showError("#adminLoginError",supaError(err));}finally{setBusy(form,false);}});
  }
  async function loadAdminStreams(){const b=$("#adminBody");if(!b)return;b.innerHTML=`<div class="notice">Laen striimereid…</div>`;const {data,error}=await db.from("streamers").select("*").order("name");if(error){b.innerHTML=`<div class="notice error">${esc(supaError(error))}</div>`;return;}b.innerHTML=`<div class="notice">Olemasolevad striimerid</div>${(data||[]).map(s=>`<div class="app-row"><b>${esc(s.name)}</b><div class="meta">${esc(s.platform)} · ${esc(s.game||"Streaming")} · ${s.is_live?"🔴 LIVE":"offline"} · 👁 ${Number(s.viewers||0).toLocaleString("et-EE")}</div><div class="admin-actions"><button type="button" class="btn" data-admin-edit="${esc(s.id)}">Muuda</button><button type="button" class="danger" data-admin-delete="${esc(s.id)}">Kustuta</button></div></div>`).join("")||`<div class="empty">Pole striimereid.</div>`}`;b.querySelectorAll("[data-admin-delete]").forEach(x=>x.onclick=()=>adminDelete(x.dataset.adminDelete));b.querySelectorAll("[data-admin-edit]").forEach(x=>x.onclick=()=>adminEdit(x.dataset.adminEdit));}
  async function loadAdminApps(){const b=$("#adminBody");if(!b)return;b.innerHTML=`<div class="notice">Laen taotlusi…</div>`;const {data,error}=await db.from("streamer_applications").select("*").order("created_at",{ascending:false});if(error){b.innerHTML=`<div class="notice error">${esc(supaError(error))}</div>`;return;}b.innerHTML=(data||[]).map(a=>`<div class="app-row"><b>${esc(a.name)}</b><div class="meta">${esc(a.email)} · ${esc(a.platform)} · ${esc(a.game||"")}</div><div class="meta"><a href="${esc(a.channel_url)}" target="_blank" rel="noopener">${esc(a.channel_url)}</a></div><div class="meta">Staatus: <b>${esc(a.status)}</b></div>${a.status==="pending"?`<div class="admin-actions"><button type="button" class="primary" data-approve="${esc(a.id)}">AKSEPTEERI</button><button type="button" class="danger" data-reject="${esc(a.id)}">KEELDU</button></div>`:""}</div>`).join("")||`<div class="empty">Taotlusi pole.</div>`;b.querySelectorAll("[data-approve]").forEach(x=>x.onclick=()=>approveApp(x.dataset.approve));b.querySelectorAll("[data-reject]").forEach(x=>x.onclick=()=>rejectApp(x.dataset.reject));}
  async function approveApp(id){const {error}=await db.rpc("admin_approve_application",{p_application_id:id});if(error){toast(supaError(error),true);return;}toast("Taotlus kinnitatud ja striimeriprofiil loodud.");await loadStreamers();await loadAdminApps();}
  async function rejectApp(id){const {error}=await db.rpc("admin_reject_application",{p_application_id:id});if(error){toast(supaError(error),true);return;}toast("Taotlus tagasi lükatud.");await loadAdminApps();}
  async function adminDelete(id){if(!confirm("Kustuta striimer?"))return;const {error}=await db.rpc("admin_delete_streamer",{p_streamer_id:id});if(error){toast(supaError(error),true);return;}toast("Kustutatud.");await loadStreamers();await loadAdminStreams();}
  function adminEdit(id){const s=streamers.find(x=>x.id===id);if(!s)return;const b=$("#adminBody");b.innerHTML=`<div class="field"><label>NIMI</label><input id="aName" value="${esc(s.name)}"></div><div class="field"><label>MÄNG</label><input id="aGame" value="${esc(s.game||"")}"></div><div class="field"><label>THUMBNAIL URL</label><input id="aThumb" value="${esc(s.thumbnail_url||"")}"></div><div class="field"><label>KANALI URL</label><input id="aUrl" value="${esc(s.channel_url)}"></div><div class="modal-actions"><button type="button" class="btn" id="backAdmin">Tagasi</button><button type="button" class="primary" id="saveAdmin">Salvesta</button></div>`;$("#backAdmin").onclick=loadAdminStreams;$("#saveAdmin").onclick=async()=>{const {error}=await db.rpc("admin_update_streamer",{p_streamer_id:id,p_name:$("#aName").value.trim(),p_game:$("#aGame").value.trim()||null,p_thumbnail_url:$("#aThumb").value.trim()||null,p_channel_url:$("#aUrl").value.trim()});if(error){toast(supaError(error),true);return;}toast("Salvestatud.");await loadStreamers();loadAdminStreams();};}
  async function loadStreamers(){if(!dbReady())return;const {data,error}=await db.from("streamers").select("*").order("is_live",{ascending:false}).order("viewers",{ascending:false}).order("name");if(error){toast("Striimerite laadimine ebaõnnestus: "+supaError(error),true);return;}streamers=data||[];render();}

  async function boot(){if(!dbReady())return;const {data,error}=await db.auth.getSession();if(error)toast(supaError(error),true);currentUser=data?.session?.user||null;if(currentUser&&currentUser.id!==ADMIN_UID)await loadProfile();setupFilters();renderGames();await loadStreamers();db.auth.onAuthStateChange((event,session)=>{currentUser=session?.user||null;if(currentUser&&currentUser.id!==ADMIN_UID){setTimeout(loadProfile,0);}else currentProfile=null;});}
  function setup(){if(booted)return;booted=true;const ub=$("#userBtn"),ab=$("#adminBtn");if(ub)ub.addEventListener("click",e=>{e.preventDefault();currentUser? (currentUser.id===ADMIN_UID?adminModal():userModal()):accountModal("login")});if(ab)ab.addEventListener("click",e=>{e.preventDefault();adminLogin()});$("#search")?.addEventListener("input",render);$("#clearGameFilter")?.addEventListener("click",()=>{activeGame=null;render()});$('[data-scroll="#live"]')?.addEventListener("click",e=>{e.preventDefault();$("#live")?.scrollIntoView({behavior:"smooth"})});$('[data-scroll="#streamers"]')?.addEventListener("click",e=>{e.preventDefault();$("#streamers")?.scrollIntoView({behavior:"smooth"})});boot();}
  document.addEventListener("DOMContentLoaded",setup);
})();
