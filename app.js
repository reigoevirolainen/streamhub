(() => {
  "use strict";

  const C = window.STREAMHUB_CONFIG || {};
  const ADMIN_UID = "56a4036e-b37d-4928-abf2-8f49d709f5b7";
  // Kaitse: Kui SUPABASE_URL on vigane/puudu, ei jookse kood Edge URl-i kokkupanemisel katki.
  const EDGE_URL = (C.SUPABASE_URL) ? `${String(C.SUPABASE_URL).replace(/\/+$/, "")}/functions/v1/streamer-workflow` : "";

  const db = (window.supabase && C.SUPABASE_URL && C.SUPABASE_PUBLISHABLE_KEY)
    ? window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_PUBLISHABLE_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      })
    : null;

  let streamers = [];
  let currentUser = null;
  let currentProfile = null;
  let activeGame = null;
  let activePlatform = "Kõik";

  const GAME_ART_URLS = {
    "Fortnite": "https://cdn1.epicgames.com/offer/fn/FNECO_36-10_ForbiddenFruit_EGS_Launcher_KeyArt_Blade_2560x1440_2560x1440-abce17aa0386b48069aa42c1ebf7b864",
    "Minecraft": "https://cdn.mos.cms.futurecdn.net/v2/t%3A0%2Cl%3A448%2Ccw%3A1152%2Cch%3A1152%2Cq%3A80%2Cw%3A1152/rpPGiw7RjFaeJCCDBC4Bna.jpg",
    "Call of Duty: Warzone": "https://image.api.playstation.com/vulcan/ap/rnd/202312/0123/978efa66c9645e4692ac7036a31aa002a49d0efb4b88b45c.png",
    "Apex Legends": "https://cdn.shopify.com/s/files/1/0556/5795/5430/articles/unnamed_40671e72-d1c1-4847-a527-d6a28c25e36b.jpg?v=1706891100",
    "Grand Theft Auto V": "https://media.vandal.net/m/15192/grand-theft-auto-v-2015413122229_1.jpg",
    "VALORANT": "https://images.squarespace-cdn.com/content/v1/5f031aa98cea4c639ef3f14f/1628022926456-P2ZU0NTSDBH1VXQKB5EO/riot%2Bnew%2Bheader.jpg"
  };

  function fallbackGameArt(name) {
    const cfg = {
      "Fortnite": ["#6d3df2","#17103b","FORTNITE","✦"],
      "Minecraft": ["#4e9d3d","#13240e","MINECRAFT","◆"],
      "Call of Duty: Warzone": ["#7d7d7d","#171717","WARZONE","◈"],
      "Apex Legends": ["#c94c62","#210d13","APEX LEGENDS","△"],
      "Grand Theft Auto V": ["#7f9d43","#171b10","GRAND THEFT AUTO V","V"],
      "VALORANT": ["#d54b66","#250c12","VALORANT","◇"]
    }[name] || ["#7c4dff","#171225",name,"✦"];
    const [a,b,title,mark] = cfg;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 500"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="900" height="500" fill="url(#bg)"/><circle cx="120" cy="80" r="190" fill="#fff" opacity=".10"/><circle cx="790" cy="420" r="280" fill="#000" opacity=".20"/><path d="M0 410 L180 250 L320 335 L470 185 L610 315 L760 175 L900 300 V500 H0Z" fill="#000" opacity=".20"/><text x="450" y="245" text-anchor="middle" fill="#fff" font-family="Arial Black,Arial,sans-serif" font-size="58" font-weight="900">${title}</text><text x="450" y="315" text-anchor="middle" fill="#fff" opacity=".9" font-family="Arial,sans-serif" font-size="72" font-weight="900">${mark}</text></svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

  const gameArt = name => GAME_ART_URLS[name] || fallbackGameArt(name);
  const games = ["Fortnite","Minecraft","Call of Duty: Warzone","Apex Legends","Grand Theft Auto V","VALORANT"]
    .map(name => ({ name, art: gameArt(name) }));

  const $ = s => document.querySelector(s);
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));

  function toast(message, bad = false) {
    const t = $("#toast"); if (!t) return;
    t.textContent = message;
    t.className = `toast show ${bad ? "error" : "good"}`;
    clearTimeout(window.__streamhubToast);
    window.__streamhubToast = setTimeout(() => { t.className = "toast"; }, 5000);
  }

  function openModal(content) {
    const root = $("#modalRoot"); if (!root) return;
    root.innerHTML = `<div class="modal-back" id="modalBack"><div class="modal" role="dialog" aria-modal="true">${content}</div></div>`;
    $("#modalBack")?.addEventListener("click", e => { if (e.target.id === "modalBack") closeModal(); });
    $("#closeModal")?.addEventListener("click", closeModal);
  }
  function closeModal() { if ($("#modalRoot")) $("#modalRoot").innerHTML = ""; }
  
  function dbReady() {
    if (!db) { toast("Andmebaasi ühendus puudub. Kontrolli seadeid.", true); return false; }
    return true;
  }
  
  function supaError(e) {
    return [e?.code,e?.message,e?.details,e?.hint].filter(Boolean).join(" — ") || "Tundmatu viga";
  }
  
  function showError(selector, message) {
    const x = typeof selector === "string" ? $(selector) : selector; if (!x) return;
    x.textContent = message; x.classList.remove("hidden","success"); x.classList.add("error");
  }
  
  function setBusy(form,busy,label="Töötlen…") {
    if (!form) return;
    form.querySelectorAll("button[type=submit]").forEach(btn => {
      if (busy) { btn.dataset.originalText=btn.textContent; btn.disabled=true; btn.textContent=label; }
      else { btn.disabled=false; if (btn.dataset.originalText) btn.textContent=btn.dataset.originalText; }
    });
  }

  async function edge(action, payload = {}) {
    if (!dbReady()) throw new Error("Andmebaasi ühendus puudub.");
    if (!EDGE_URL) throw new Error("API URL on puudu.");
    
    const headers = { "Content-Type":"application/json", "apikey":C.SUPABASE_PUBLISHABLE_KEY };
    const { data: { session } } = await db.auth.getSession();
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
    
    const r = await fetch(EDGE_URL, { method:"POST", headers, body:JSON.stringify({ action, ...payload }) });
    let body = null;
    try { 
      body = await r.json(); 
    } catch { 
      throw new Error(`Serveri päring ebaõnnestus (HTTP ${r.status}).`); 
    }
    
    if (!r.ok || body?.ok === false) throw new Error(body?.error || `Päring ebaõnnestus (HTTP ${r.status})`);
    return body;
  }

  function card(s) {
    const img = s.thumbnail_url || s.avatar_url || gameArt(s.game || "Fortnite");
    return `<article class="card">
      <div class="preview"><img src="${esc(img)}" data-game-fallback="${esc(s.game || "Fortnite")}" alt="${esc(s.name)} thumbnail" loading="lazy">
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
    const q = ($("#search")?.value || "").trim().toLowerCase();
    return streamers.filter(s =>
      (activePlatform === "Kõik" || s.platform === activePlatform) &&
      (!activeGame || String(s.game || "").trim().toLowerCase() === activeGame.toLowerCase()) &&
      (`${s.name} ${s.game || ""}`).toLowerCase().includes(q)
    );
  }

  function wireImageFallbacks() {
    document.querySelectorAll("img[data-game-fallback]").forEach(img => {
      if (img.dataset.fallbackBound) return;
      img.dataset.fallbackBound="1";
      img.addEventListener("error", () => { img.onerror=null; img.src=fallbackGameArt(img.dataset.gameFallback || "Fortnite"); }, {once:true});
    });
  }

  function render() {
    const rows=filtered(), live=rows.filter(s=>s.is_live);
    const liveGrid = $("#liveGrid");
    if (liveGrid) liveGrid.innerHTML=live.length?live.map(card).join(""):`<div class="empty">Hetkel pole valitud vaates ühtegi LIVE striimerit.</div>`;
    
    const streamerGrid = $("#streamerGrid");
    if (streamerGrid) streamerGrid.innerHTML=rows.length?rows.map(card).join(""):`<div class="empty">Ühtegi striimerit ei leitud.</div>`;
    
    if ($("#heroLiveCount")) $("#heroLiveCount").textContent=streamers.filter(s=>s.is_live).length.toLocaleString("et-EE");
    if ($("#heroStreamerCount")) $("#heroStreamerCount").textContent=streamers.length.toLocaleString("et-EE");
    
    wireImageFallbacks(); 
    renderGames();
  }

  function renderGames() {
    const strip=$("#gameStrip"),results=$("#gameResults"); if(!strip||!results)return;
    strip.innerHTML=games.map(g=>{
      const count=streamers.filter(s=>String(s.game||"").trim().toLowerCase()===g.name.toLowerCase()&&s.is_live).length;
      return `<button type="button" class="game-tile ${activeGame===g.name?"active":""}" data-game="${esc(g.name)}">
        <img class="game-art" src="${esc(g.art)}" data-game-art-fallback="${esc(g.name)}" alt="${esc(g.name)}" loading="lazy">
        <span class="game-name">${esc(g.name)}</span><span class="game-count">${count} LIVE</span></button>`;
    }).join("");
    
    strip.querySelectorAll("[data-game]").forEach(b=>b.onclick=()=>{
      activeGame=b.dataset.game;
      render();
      $("#games")?.scrollIntoView({behavior:"smooth",block:"start"});
    });
    
    strip.querySelectorAll("img[data-game-art-fallback]").forEach(img=>{
      if(img.dataset.bound)return;
      img.dataset.bound="1";
      img.addEventListener("error",()=>{img.onerror=null;img.src=fallbackGameArt(img.dataset.gameArtFallback||"Fortnite");},{once:true});
    });
    
    if(!activeGame){results.classList.add("hidden");results.innerHTML="";return;}
    const found=streamers.filter(s=>String(s.game||"").trim().toLowerCase()===activeGame.toLowerCase());
    results.classList.remove("hidden");
    results.innerHTML=`<div class="game-results-title">${esc(activeGame)} — ${found.length} striimerit</div><div class="game-results-grid">${found.length?found.map(card).join(""):`<div class="empty">Selle mängu all pole veel striimereid.</div>`}</div>`;
    wireImageFallbacks();
  }

  function setupFilters(){
    const filters = $("#platformFilters");
    if (!filters) return;
    
    // Ikoonid on nüüd iga platvormi brändivärvides!
    const ps = [
      { 
        name: "Kõik", 
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M10 3H3v7h7V3zm0 11H3v7h7v-7zm11-11h-7v7h7V3zm0 11h-7v7h7v-7z"/></svg>` 
      },
      { 
        name: "Twitch", 
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="#9146FF"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/></svg>` 
      },
      { 
        name: "YouTube", 
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="#FF0000"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>` 
      },
      { 
        name: "Kick", 
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="#53FC18"><path d="M2.666 0h5.334v5.333H10.666v2.667h2.667V5.333h5.334V0h2.666v5.333h-2.666v2.667h-2.667v5.333h2.667v2.667h2.666v8h-2.666v-5.333h-5.334v-2.667h-2.667v2.667H10.666v5.333H2.666z"/></svg>` 
      },
      { 
        name: "TikTok", 
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="#25F4EE"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/></svg>` 
      }
    ];

    filters.innerHTML = ps.map((p, i) => `
      <button type="button" class="filter ${i === 0 ? "active" : ""}" data-platform="${p.name}">
        ${p.icon}
        <span>${p.name}</span>
      </button>
    `).join("");

    filters.querySelectorAll("[data-platform]").forEach(b => b.onclick = () => {
      activePlatform = b.dataset.platform;
      filters.querySelectorAll(".filter").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      render();
    });
  }

  function accountModal(tab="login"){
    openModal(`<button class="close-btn" id="closeModal">×</button><div class="eyebrow">STREAMHUB KASUTAJA</div><h2>Kasutaja</h2>
      <div class="account-tabs">
        <button type="button" class="btn primary" id="tabLogin">Logi sisse</button>
        <button type="button" class="btn" id="tabJoin">Liitu striimerina</button>
      </div><div id="accountBody"></div>`);
    
    if($("#tabLogin")) $("#tabLogin").onclick=()=>accountModal("login");
    if($("#tabJoin")) $("#tabJoin").onclick=joinModal;
    
    loginForm();
  }

  function loginForm(){
    const body = $("#accountBody");
    if (!body) return;
    body.innerHTML=`<form id="loginForm" class="formgrid">
      <div class="field"><label>E-POST</label><input name="email" type="email" autocomplete="email" required></div>
      <div class="field"><label>PAROOL</label><input name="password" type="password" autocomplete="current-password" required></div>
      <button type="submit" class="primary full">LOGI SISSE</button><div id="accountError" class="notice error hidden"></div></form>`;
    
    $("#loginForm").onsubmit=async e=>{
      e.preventDefault();if(!dbReady())return;
      setBusy(e.currentTarget,true,"LOGIM SISSE…"); 
      
      try {
        const d=Object.fromEntries(new FormData(e.currentTarget));
        const {data,error}=await db.auth.signInWithPassword({email:d.email.trim().toLowerCase(),password:d.password});
        if(error) throw error;
        
        currentUser=data.user;
        if(currentUser.id===ADMIN_UID){
            closeModal();toast("Adminina sisse logitud.");adminModal();return;
        }
        await loadProfile();closeModal();toast("Sisse logitud.");userModal();
      } catch(err) {
          showError("#accountError",supaError(err));
      } finally {
          setBusy(e.currentTarget,false);
      }
    };
  }

  async function loadProfile(){
    currentProfile=null;if(!currentUser||!db)return;
    try {
        const {data}=await db.from("profiles").select("id,username,display_name,role,user_type").eq("id",currentUser.id).maybeSingle();
        currentProfile=data||null;
    } catch (e) {
        console.error("Viga profiili laadimisel:", e);
    }
  }

  function joinModal(){
    openModal(`<button class="close-btn" id="closeModal">×</button><div class="eyebrow">STREAMER</div><h2>Liitu striimerina</h2>
      <p class="muted">Täida taotlus. Admin vaatab selle üle. Konto luuakse alles pärast kinnitamist.</p>
      <form id="joinForm" class="formgrid">
        <div class="field"><label>STRIIMERI NIMI</label><input name="name" required maxlength="80"></div>
        <div class="field"><label>E-POST / KASUTAJATUNNUS</label><input name="email" type="email" required maxlength="254"></div>
        <div class="field"><label>PAROOL</label><input name="password" type="password" autocomplete="new-password" minlength="6" required></div>
        <div class="field"><label>PAROOL UUESTI</label><input name="password2" type="password" autocomplete="new-password" minlength="6" required></div>
        <div class="field"><label>PLATVORM</label><select name="platform"><option>Twitch</option><option>YouTube</option><option>Kick</option><option>TikTok</option></select></div>
        <div class="field"><label>KANALI URL</label><input name="channel_url" type="url" required></div>
        <div class="field"><label>MIDA SA STRIIMID?</label><input name="game" placeholder="Fortnite"></div>
        <div class="field"><label>KANALI PILT / THUMBNAIL (max 2MB, valikuline)</label><input type="file" id="thumbFile" accept="image/png, image/jpeg, image/webp" class="form-input"></div>
        <div class="field"><label>AVATARI URL (valikuline)</label><input name="avatar_url" type="url" placeholder="https://..."></div>
        <div class="field"><label>SÕNUM (valikuline)</label><textarea name="message"></textarea></div>
        <div class="modal-actions"><button type="button" class="btn" id="cancelJoin">Tühista</button><button type="submit" class="primary">SAADA TAOTLUS</button></div>
        <div id="joinError" class="notice error hidden"></div></form>`);
    
    if ($("#cancelJoin")) $("#cancelJoin").onclick=closeModal;
    
    $("#joinForm").onsubmit=async e=>{
      e.preventDefault();
      const form=e.currentTarget;
      if(!form.reportValidity())return;
      const d=Object.fromEntries(new FormData(form));
      
      if(d.password!==d.password2){showError("#joinError","Paroolid ei kattu.");return;}
      
      setBusy(form,true,"SAADAN…");
      try{
        let finalThumbnailUrl = null;
        const fileInput = document.getElementById("thumbFile");
        
        // PILDI ÜLESLAADIMISE LOOGIKA (Maksimaalselt 2MB)
        if (fileInput && fileInput.files.length > 0) {
            const file = fileInput.files[0];
            
            if (file.size > 2 * 1024 * 1024) {
                showError("#joinError", "Pilt on liiga suur! Maksimaalne lubatud suurus on 2MB.");
                setBusy(form, false);
                return;
            }
            
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
            
            toast("Laen pilti üles...");
            const { error: uploadError } = await db.storage.from('thumbnails').upload(fileName, file);
            
            if (uploadError) {
                showError("#joinError", "Viga pildi üleslaadimisel: " + uploadError.message);
                setBusy(form, false);
                return;
            }
            
            const { data: publicUrlData } = db.storage.from('thumbnails').getPublicUrl(fileName);
            finalThumbnailUrl = publicUrlData.publicUrl;
        }

        // Taotluse saatmine API kaudu
        await edge("submit", {
            name: d.name,
            email: d.email,
            password: d.password,
            password2: d.password2,
            platform: d.platform,
            channel_url: d.channel_url,
            game: d.game,
            thumbnail_url: finalThumbnailUrl, // Uus URL Supabasest!
            avatar_url: d.avatar_url,
            message: d.message
        });
        
        closeModal();
        toast("Taotlus saadetud. Admin vaatab selle peatselt üle.");
      }catch(err){
          showError("#joinError",err.message||String(err));
      }finally{
          setBusy(form,false);
      }
    };
  }

  async function userModal(){
    if(!currentUser){accountModal("login");return;}
    await loadProfile();
    
    // Parem turvakontroll nime kuvamisel
    const displayName = currentProfile?.display_name || currentProfile?.username || (currentUser.email ? currentUser.email.split("@")[0] : "Kasutaja");
    
    openModal(`<button class="close-btn" id="closeModal">×</button><div class="eyebrow">MINU KONTO</div>
      <h2>${esc(displayName)}</h2><div id="userPanel"><div class="notice">Laen kontot...</div></div>`);
    await loadUserPanel();
  }

  async function loadUserPanel(){
    const p=$("#userPanel");if(!p||!currentUser)return;
    const {data:s,error}=await db.from("streamers").select("id,name,platform,channel_url,game,is_live,viewers,thumbnail_url,avatar_url,owner_id,owner_email").eq("owner_id",currentUser.id).maybeSingle();
    
    if(error){p.innerHTML=`<div class="notice error">${esc(supaError(error))}</div>`;return;}
    
    // Parandatud: turvaline email parameetri lugemine
    const userEmail = currentUser.email || "";
    const {data:a}=await db.from("streamer_applications").select("id,name,email,platform,game,status,created_at").ilike("email",userEmail).order("created_at",{ascending:false}).limit(1).maybeSingle();
    
    let body="";
    if(s) body=streamerControls(s);
    else if(a?.status==="pending") body=`<div class="notice success"><b>Taotlus on saadetud.</b><br>Admin vaatab sinu taotluse üle.</div>`;
    else if(a?.status==="rejected") body=`<div class="notice error"><b>Taotlus lükati tagasi.</b><br>Võid esitada uue taotluse.</div><button type="button" class="primary" id="joinAgainBtn">LIITU STRIIMERINA UUESTI</button>`;
    else body=`<div class="notice">Kinnitatud striimeriprofiili ei leitud. Kui admin on taotluse kinnitanud, vajuta allolevat nuppu.</div><button type="button" class="primary" id="claimBtn">VÕTA OMA STRIIMERIPROFIIL</button>`;
    
    p.innerHTML=`<div class="account-panel"><div class="notice">${esc(userEmail)}</div>${body}<button type="button" class="btn" id="logoutUser" style="margin-top: 15px;">LOGI VÄLJA</button></div>`;
    
    $("#logoutUser").onclick=async()=>{
        await db.auth.signOut();
        currentUser=null;currentProfile=null;
        closeModal();
        toast("Edukalt välja logitud.");
    };
    
    if($("#claimBtn")) $("#claimBtn").addEventListener("click",claimStreamer);
    if($("#joinAgainBtn")) $("#joinAgainBtn").addEventListener("click",joinModal);
    if($("#toggleLive")) $("#toggleLive").addEventListener("click",()=>toggleLive(s));
  }

  function streamerControls(s){
    return `<div class="notice">${esc(s.platform)} · ${esc(s.game||"Streaming")}<br><a href="${esc(s.channel_url)}" target="_blank" rel="noopener">${esc(s.channel_url)}</a></div>
      <div class="live-switch ${s.is_live?"online":""}"><span>STAATUS<br><strong>${s.is_live?"ONLINE":"OFFLINE"}</strong></span><button type="button" class="primary" id="toggleLive">${s.is_live?"LÜLITA OFFLINE":"LÜLITA ONLINE"}</button></div>
      <div class="notice muted" style="font-size: 11px;">Märkus: Platvormide andmeid (vaatajate arv jms) uuendatakse automaatselt. Ülaltoodud käsitsi lüliti muudab kuvatavat staatust manuaalselt.</div>`;
  }

  async function toggleLive(s){
    const {error}=await db.rpc("set_my_stream_live",{p_is_live:!s.is_live});
    if(error){toast(supaError(error),true);return;}
    
    // UUS LOGI SALVESTAMINE: Striimer muudab ise oma staatust
    await db.from("streamer_logs").insert({
        streamer_id: s.id,
        action: !s.is_live ? 'STREAMER_SET_ONLINE' : 'STREAMER_SET_OFFLINE'
    });

    toast(!s.is_live?"Oled nüüd märgitud ONLINE.":"Oled nüüd märgitud OFFLINE.");
    await loadStreamers();
    await loadUserPanel();
  }

  async function claimStreamer(){
    const {data,error}=await db.rpc("claim_my_streamer");
    if(error){toast(supaError(error),true);return;}
    if(!data){toast("Sinu kontoga seotud kinnitatud striimeriprofiili ei leitud.",true);return;}
    toast("Striimeriprofiil edukalt ühendatud.");
    await loadStreamers();
    await loadUserPanel();
  }

  function adminModal(){
    openModal(`<button class="close-btn" id="closeModal">×</button><div class="eyebrow">ADMIN PANEL</div><h2>Striimerid & taotlused</h2>
      <div class="account-tabs"><button type="button" class="btn primary" id="adminStreamsTab">Striimerid</button><button type="button" class="btn" id="adminAppsTab">Taotlused</button></div><div id="adminBody"></div>`);
    
    if($("#adminStreamsTab")) $("#adminStreamsTab").onclick=loadAdminStreams;
    if($("#adminAppsTab")) $("#adminAppsTab").onclick=loadAdminApps;
    
    loadAdminStreams();
  }

  async function adminLogin(){
    openModal(`<button class="close-btn" id="closeModal">×</button><div class="eyebrow">STREAMHUB ADMIN</div><h2>Admini sisselogimine</h2><p class="muted">Sisselogimiseks on vaja Supabase administraatori õigusi.</p>
      <form id="adminLoginForm" class="formgrid"><div class="field"><label>E-POST</label><input name="email" type="email" autocomplete="username" required></div><div class="field"><label>PAROOL</label><input name="password" type="password" autocomplete="current-password" required></div>
      <button type="submit" class="primary full">LOGI SISSE</button><button type="button" class="btn full" id="adminResetBtn">SAADA PAROOLI LÄHTESTAMISE LINK</button><div id="adminLoginError" class="notice error hidden"></div></form>`);
    
    $("#adminLoginForm").onsubmit=async e=>{
      e.preventDefault();
      const form=e.currentTarget;
      if(!form.reportValidity())return;
      setBusy(form,true,"LOGIM SISSE…");
      
      try{
        const d=Object.fromEntries(new FormData(form));
        await db.auth.signOut();
        
        const {data,error}=await db.auth.signInWithPassword({email:d.email.trim().toLowerCase(),password:d.password});
        if(error)throw error;
        if(data.user.id!==ADMIN_UID){
            await db.auth.signOut();
            throw new Error("See konto ei oma StreamHubi administraatori õigusi.");
        }
        
        currentUser=data.user;closeModal();toast("Edukas. Adminina sisse logitud.");adminModal();
      }catch(err){
          showError("#adminLoginError",supaError(err));
      }finally{
          setBusy(form,false);
      }
    };
    
    $("#adminResetBtn").onclick=async()=>{
      const email=$("#adminLoginForm")?.elements.email?.value?.trim().toLowerCase();
      if(!email){showError("#adminLoginError","Palun sisesta esmalt oma admini e-posti aadress ülemisele väljale.");return;}
      
      const {error}=await db.auth.resetPasswordForEmail(email,{redirectTo:`${window.location.origin}/`});
      if(error){showError("#adminLoginError",supaError(error));return;}
      
      const x=$("#adminLoginError");
      x.textContent="Kui sisestasid õige e-posti, saadeti sinna parooli lähtestamise link.";
      x.classList.remove("hidden","error");x.classList.add("success");
    };
  }

  // UUENDATUD SAMM 2 KOOD: Adminil on kohene võimalus staatust muuta.
  async function loadAdminStreams(){
    const b=$("#adminBody");if(!b)return;
    const {data,error}=await db.from("streamers").select("*").order("name");
    
    if(error){b.innerHTML=`<div class="notice error">${esc(supaError(error))}</div>`;return;}
    
    b.innerHTML=`<div class="notice">Olemasolevad striimerid andmebaasis</div>${(data||[]).map(s=>`<div class="app-row"><b>${esc(s.name)}</b><div class="meta">${esc(s.platform)}</div><div class="meta">${esc(s.game||"Määramata mäng")}</div><div class="meta">${s.is_live?"🔴 LIVE":"Offline"}</div><div class="admin-actions">
    <button type="button" class="${s.is_live ? "btn" : "primary"}" data-admin-status="${s.id}" data-live="${s.is_live}">${s.is_live ? "Tee Offline" : "Tee Online"}</button>
    <button type="button" class="btn" data-admin-edit="${s.id}">Muuda</button><button type="button" class="danger" data-admin-delete="${s.id}">Kustuta</button></div></div>`).join("")||`<div class="empty">Ühtegi striimerit pole andmebaasis registreeritud.</div>`}`;
    
    b.querySelectorAll("[data-admin-delete]").forEach(x=>x.onclick=()=>adminDelete(x.dataset.adminDelete));
    b.querySelectorAll("[data-admin-edit]").forEach(x=>x.onclick=()=>adminEdit(x.dataset.adminEdit));
    
    // Event listener staatuse muutmise nuppudele
    b.querySelectorAll("[data-admin-status]").forEach(x=>x.onclick=async()=>{
      const id = x.dataset.adminStatus;
      const isLiveCurrently = x.dataset.live === "true";
      
      const {error} = await db.from("streamers").update({ is_live: !isLiveCurrently }).eq("id", id);
      if(error){toast("Viga: " + supaError(error),true);return;}
      
      // Salvestame logi uude tabelisse
      await db.from("streamer_logs").insert({
          streamer_id: id,
          action: !isLiveCurrently ? 'ADMIN_SET_ONLINE' : 'ADMIN_SET_OFFLINE'
      });
      
      toast(`Staatus muudetud: ${!isLiveCurrently ? 'ONLINE' : 'OFFLINE'}`);
      await loadAdminStreams();
      await loadStreamers();
    });
  }

  async function loadAdminApps(){
    const b=$("#adminBody");if(!b)return;
    const {data,error}=await db.from("streamer_applications").select("*").order("created_at",{ascending:false});
    
    if(error){b.innerHTML=`<div class="notice error">${esc(supaError(error))}</div>`;return;}
    
    b.innerHTML=(data||[]).map(a=>`<div class="app-row">${a.thumbnail_url?`<img class="admin-thumb" src="${esc(a.thumbnail_url)}" alt="">`:""}<b>${esc(a.name)}</b><div class="meta">${esc(a.email)}</div><div class="meta">${esc(a.platform)} · ${esc(a.game||"Määramata")}</div><div class="meta"><a href="${esc(a.channel_url)}" target="_blank" rel="noopener">${esc(a.channel_url)}</a></div><div class="meta">Staatus: <b>${esc(a.status)}</b></div>${a.status==="pending"?`<div class="admin-actions"><button type="button" class="primary" data-approve="${a.id}">AKSEPTEERI</button><button type="button" class="danger" data-reject="${a.id}">KEELDU</button></div>`:""}</div>`).join("")||`<div class="empty">Ootel taotlusi ei ole.</div>`;
    
    b.querySelectorAll("[data-approve]").forEach(x=>x.onclick=()=>approveApp(x.dataset.approve));
    b.querySelectorAll("[data-reject]").forEach(x=>x.onclick=()=>rejectApp(x.dataset.reject));
  }

  async function approveApp(id){
    try{
        toast("Kinnitan...");
        await edge("approve",{application_id:id});
        toast("Edukalt kinnitatud. Striimer on lehele lisatud.");
        await loadStreamers();
        await loadAdminApps();
    }
    catch(err){toast(err.message||String(err),true);}
  }
  
  async function rejectApp(id){
    const reason=prompt("Kas soovid lisada tagasilükkamise põhjuse? (Võid jätta tühjaks):","") ?? "";
    try{
        toast("Lükkan tagasi...");
        await edge("reject",{application_id:id,reason});
        toast("Taotlus edukalt tagasi lükatud.");
        await loadAdminApps();
    }
    catch(err){toast(err.message||String(err),true);}
  }

  async function adminDelete(id){
    if(!confirm("Oled sa kindel, et soovid selle striimeri andmebaasist kustutada? Seda tegevust ei saa tagasi võtta."))return;
    
    const {error}=await db.from("streamers").delete().eq("id",id);
    if(error){toast("Viga kustutamisel: " + supaError(error),true);return;}
    
    toast("Striimer edukalt kustutatud.");
    await loadStreamers();
    await loadAdminStreams();
  }

  function adminEdit(id){
    const s=streamers.find(x=>x.id===id);if(!s)return;
    const b=$("#adminBody");
    b.innerHTML=`<div class="field"><label>NIMI</label><input id="aName" value="${esc(s.name)}"></div><div class="field"><label>MÄNG</label><input id="aGame" value="${esc(s.game||"")}"></div><div class="field"><label>THUMBNAIL URL</label><input id="aThumb" value="${esc(s.thumbnail_url||"")}"></div><div class="field"><label>KANALI URL</label><input id="aUrl" value="${esc(s.channel_url)}"></div><div class="modal-actions"><button type="button" class="btn" id="backAdmin">Tagasi</button><button type="button" class="primary" id="saveAdmin">Salvesta muudatused</button></div>`;
    
    $("#backAdmin").onclick=loadAdminStreams;
    $("#saveAdmin").onclick=async()=>{
      const {error}=await db.from("streamers").update({
          name:$("#aName").value.trim(),
          game:$("#aGame").value.trim()||null,
          thumbnail_url:$("#aThumb").value.trim()||null,
          channel_url:$("#aUrl").value.trim(),
          updated_at:new Date().toISOString()
      }).eq("id",id);
      
      if(error){toast("Viga salvestamisel: " + supaError(error),true);return;}
      toast("Muudatused salvestatud.");
      await loadStreamers();
      await loadAdminStreams();
    };
  }

  async function loadStreamers(){
    if(!dbReady())return;
    const {data,error}=await db.from("streamers").select("*").eq("enabled",true).order("is_live",{ascending:false}).order("viewers",{ascending:false}).order("name");
    
    if(error){toast("Ei õnnestunud laadida striimereid: "+supaError(error),true);return;}
    streamers=data||[];
    render();
  }

  async function boot(){
    if(!dbReady())return;
    
    // Puhastab URL-ist inetud Supabase sisselogimise tokenid
    if (window.location.hash.includes('access_token=')) {
        setTimeout(() => {
            window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
        }, 100);
    }

    const {data,error}=await db.auth.getSession();
    if(error){console.warn("Session error:", error);} // Ära karju kasutajale näkku, kui vana sessioon aegus
    
    currentUser=data.session?.user||null;
    if(currentUser) await loadProfile();
    
    setupFilters();
    renderGames();
    await loadStreamers();
    
    db.auth.onAuthStateChange((_event,session)=>{
        currentUser=session?.user||null;
        if(currentUser) loadProfile();
        else currentProfile=null;
    });
  }

  function setup(){
    if($("#userBtn")) {
        // Eemaldab vanad event listenerid (hea tava)
        $("#userBtn").replaceWith($("#userBtn").cloneNode(true)); 
        $("#userBtn").addEventListener("click",e=>{e.preventDefault();currentUser?userModal():accountModal("login");});
    }
    
    if($("#adminBtn")) {
        $("#adminBtn").replaceWith($("#adminBtn").cloneNode(true));
        // Suuname adminLogin() asemel uuele lehele:
        $("#adminBtn").addEventListener("click", e => {
            e.preventDefault();
            window.location.href = "/admin.html";
        }); 
    } 
    
    if($("#search")) $("#search").addEventListener("input",render);
    if($("#clearGameFilter")) $("#clearGameFilter").addEventListener("click",()=>{activeGame=null;render();});
    
    document.querySelectorAll("[data-scroll='#live']").forEach(el => el.addEventListener("click",e=>{e.preventDefault();$("#live")?.scrollIntoView({behavior:"smooth"});}));
    document.querySelectorAll("[data-scroll='#streamers']").forEach(el => el.addEventListener("click",e=>{e.preventDefault();$("#streamers")?.scrollIntoView({behavior:"smooth"});}));
    
    boot();
  }
  
  document.addEventListener("DOMContentLoaded",setup);

  // --- KOODI KAITSE (Keelab paremkliki, F12 ja Ctrl+U) ---
  document.addEventListener('contextmenu', function(e) {
    e.preventDefault();
  });

  document.addEventListener('keydown', function(e) {
    // Keela F12
    if (e.key === 'F12' || e.keyCode === 123) {
      e.preventDefault();
      return false;
    }
    // Keela Ctrl+Shift+I (Avab DevTools)
    if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i')) {
      e.preventDefault();
      return false;
    }
    // Keela Ctrl+Shift+J (Avab Console)
    if (e.ctrlKey && e.shiftKey && (e.key === 'J' || e.key === 'j')) {
      e.preventDefault();
      return false;
    }
    // Keela Ctrl+U (Avab Page Source)
    if (e.ctrlKey && (e.key === 'u' || e.key === 'U')) {
      e.preventDefault();
      return false;
    }
  });
  // --------------------------------------------------------
})();