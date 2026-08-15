const SUPABASE_URL="https://rrzglnazdppgjjtaswmd.supabase.co";
const SUPABASE_PUBLISHABLE_KEY="sb_publishable_ax0HpMi18hz-AQ2x8XOT3w_gRLYKE4h";
const ADMIN_UID="56a4036e-b37d-4928-abf2-8f49d709f5b7";
const FUNCTION_URL=`${SUPABASE_URL}/functions/v1/submit-streamer-application`;
const {createClient}=supabase;const db=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
let streamers=[],activePlatform="all";const fallbackThumb="https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1000&q=80";
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
function slug(s){try{const u=new URL(s.channel_url);let p=u.pathname.split("/").filter(Boolean)[0]||"";return p}catch{return""}}
function twitchPreview(s){if(s.platform!=="Twitch"||!s.is_live)return"";const ch=slug(s);if(!ch)return"";return `<div class="preview"><iframe src="https://player.twitch.tv/?channel=${encodeURIComponent(ch)}&parent=streamhub.ee&autoplay=true&muted=true" allow="autoplay; fullscreen" allowfullscreen loading="lazy"></iframe><div class="preview-label">LIVE eelvaade · heli jaoks ava stream</div></div>`}
function card(s){const a=s.avatar_url||`https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(s.name)}`,t=s.thumbnail_url||fallbackThumb;return `<article class="card ${s.is_live?"is-live":""}"><div class="thumb" style="background-image:url('${esc(t)}')">${s.is_live?`<span class="live-badge">● LIVE</span><span class="viewers">👁 ${Number(s.viewers||0).toLocaleString("et-EE")}</span>`:`<span class="platform">OFFLINE</span>`}<span class="platform">${esc(s.platform)}</span>${twitchPreview(s)}</div><div class="card-body"><div class="person"><img class="avatar" src="${esc(a)}" alt=""><div><h3>${esc(s.name)}</h3><div class="game">${esc(s.game||"Streaming")}</div></div></div><a class="watch" href="${esc(s.channel_url)}" target="_blank" rel="noopener">${s.is_live?"VAATA LIVE'I  →":"AVA KANAL  →"}</a></div></article>`}
async function loadStreamers(){const {data,error}=await db.from("streamers").select("*").order("is_live",{ascending:false}).order("viewers",{ascending:false});if(error){showError("Andmebaasiga ühendamisel tekkis viga: "+error.message);return}streamers=data||[];render()}
function render(){const l=streamers.filter(s=>s.is_live);document.getElementById("liveCount").textContent=l.length;document.getElementById("viewerCount").textContent=l.reduce((a,s)=>a+Number(s.viewers||0),0).toLocaleString("et-EE");document.getElementById("streamerCount").textContent=streamers.length;renderLive();renderAll();renderAdminList()}
function renderLive(){const q=document.getElementById("search").value.toLowerCase(),d=streamers.filter(s=>s.is_live&&(activePlatform==="all"||s.platform===activePlatform)&&s.name.toLowerCase().includes(q));document.getElementById("liveGrid").innerHTML=d.map(card).join("");document.getElementById("emptyLive").classList.toggle("hidden",d.length>0)}
function renderAll(){const q=document.getElementById("search").value.toLowerCase();document.getElementById("allGrid").innerHTML=streamers.filter(s=>s.name.toLowerCase().includes(q)).map(card).join("")}
function openJoin(){document.getElementById("joinModal").classList.remove("hidden");document.getElementById("joinName").focus()}function closeJoin(){document.getElementById("joinModal").classList.add("hidden")}
async function submitJoin(e){e.preventDefault();const b=document.querySelector("#joinForm button[type=submit]"),st=document.getElementById("joinStatus");b.disabled=true;b.textContent="SAADAN...";st.textContent="";try{const payload={name:joinName.value.trim(),platform:joinPlatform.value,channel_url:joinUrl.value.trim(),email:joinEmail.value.trim(),message:joinMessage.value.trim(),website:website.value};const r=await fetch(FUNCTION_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const d=await r.json();if(!r.ok||d.error)throw new Error(d.error||"Saatmine ebaõnnestus.");st.className="form-status ok";st.textContent="✅ Avaldus saadetud! Võtame sinuga ühendust.";e.target.reset()}catch(err){st.className="form-status bad";st.textContent="❌ "+err.message}finally{b.disabled=false;b.textContent="SAADA AVALDUS →"}}
function openAdmin(){document.getElementById("adminModal").classList.remove("hidden");checkSession()}function closeAdmin(){document.getElementById("adminModal").classList.add("hidden")}
const $ = (id) => document.getElementById(id);

async function checkSession(){
  const {data} = await db.auth.getSession();
  const u = data.session?.user;
  const ok = u?.id === ADMIN_UID;
  $("loginView").classList.toggle("hidden", !!ok);
  $("adminView").classList.toggle("hidden", !ok);
  if(ok) renderAdminList();
}

async function login(e){
  e.preventDefault();
  $("loginError").classList.add("hidden");

  const email = $("loginEmail").value.trim();
  const password = $("loginPassword").value;

  const {data,error} = await db.auth.signInWithPassword({email,password});

  if(error){
    $("loginError").textContent = error.message;
    $("loginError").classList.remove("hidden");
    return;
  }

  if(data.user.id !== ADMIN_UID){
    await db.auth.signOut();
    $("loginError").textContent = "Sellel kontol ei ole adminiõigusi.";
    $("loginError").classList.remove("hidden");
    return;
  }

  await checkSession();
}

async function logout(){
  await db.auth.signOut();
  await checkSession();
}

async function saveStreamer(e){
  e.preventDefault();

  const errorBox = $("adminError");
  errorBox.classList.add("hidden");
  errorBox.classList.remove("success");

  const {data:{user}} = await db.auth.getUser();

  if(!user || user.id !== ADMIN_UID){
    errorBox.textContent = "Admini sessioon puudub. Logi uuesti sisse.";
    errorBox.classList.remove("hidden");
    return;
  }

  const editId = $("editId").value.trim();

  const payload = {
    name: $("name").value.trim(),
    platform: $("platform").value,
    channel_url: $("url").value.trim(),
    game: $("game").value.trim() || null,
    avatar_url: $("avatar").value.trim() || null,
    thumbnail_url: $("thumbnail").value.trim() || null,
    is_live: $("live").checked,
    viewers: Math.max(0, Number($("viewers").value || 0)),
    updated_at: new Date().toISOString()
  };

  if(!payload.name || !payload.channel_url){
    errorBox.textContent = "Nimi ja kanali URL on kohustuslikud.";
    errorBox.classList.remove("hidden");
    return;
  }

  const saveButton = $("saveBtn");
  saveButton.disabled = true;
  saveButton.textContent = editId ? "SALVESTAN..." : "LISAN...";

  try{
    let result;

    if(editId){
      result = await db
        .from("streamers")
        .update(payload)
        .eq("id", editId);

      if(result.error) throw result.error;
    }else{
      // Add through a SECURITY DEFINER RPC. This avoids client-side
      // INSERT/RLS/grant mismatches while still checking the admin UID
      // inside PostgreSQL.
      result = await db.rpc("admin_add_streamer", {
        p_name: payload.name,
        p_platform: payload.platform,
        p_channel_url: payload.channel_url,
        p_game: payload.game,
        p_avatar_url: payload.avatar_url,
        p_thumbnail_url: payload.thumbnail_url,
        p_is_live: payload.is_live,
        p_viewers: payload.viewers
      });

      if(result.error) throw result.error;
    }

    cancelEdit();
    await loadStreamers();
    errorBox.textContent = editId ? "Striimer salvestatud!" : "Striimer lisatud!";
    errorBox.classList.remove("hidden");
    errorBox.classList.add("success");
    setTimeout(() => errorBox.classList.add("hidden"), 2500);

  }catch(error){
    console.error("StreamHub save error:", error);
    errorBox.textContent = `Salvestamine ebaõnnestus: ${error.message || error}`;
    errorBox.classList.remove("hidden");
  }finally{
    saveButton.disabled = false;
    if($("editId").value){
      saveButton.textContent = "Salvesta muudatus";
    }else{
      saveButton.textContent = "Lisa striimer";
    }
  }
}

function editStreamer(id){
  const s = streamers.find(x => x.id === id);
  if(!s) return;

  $("editId").value = s.id;
  $("name").value = s.name || "";
  $("platform").value = s.platform || "Twitch";
  $("url").value = s.channel_url || "";
  $("game").value = s.game || "";
  $("avatar").value = s.avatar_url || "";
  $("thumbnail").value = s.thumbnail_url || "";
  $("live").checked = !!s.is_live;
  $("viewers").value = Number(s.viewers || 0);

  $("saveBtn").textContent = "Salvesta muudatus";
  $("cancelEdit").classList.remove("hidden");
  $("name").focus();
}

function cancelEdit(){
  $("streamerForm").reset();
  $("editId").value = "";
  $("viewers").value = 0;
  $("saveBtn").textContent = "Lisa striimer";
  $("cancelEdit").classList.add("hidden");
  $("adminError").classList.add("hidden");
}

async function deleteStreamer(id){
  const s = streamers.find(x => x.id === id);
  if(!s || !confirm(`Kustuta ${s.name}?`)) return;

  const {error} = await db
    .from("streamers")
    .delete()
    .eq("id", id);

  if(error){
    $("adminError").textContent = `Kustutamine ebaõnnestus: ${error.message}`;
    $("adminError").classList.remove("hidden");
    return;
  }

  await loadStreamers();
}

function renderAdminList(){
  const el = $("adminList");
  if(!el) return;

  if(!streamers.length){
    el.innerHTML = '<div class="empty">Andmebaasis pole veel striimereid.</div>';
    return;
  }

  el.innerHTML = streamers.map(s => `
    <div class="admin-row">
      <div>
        <strong>${esc(s.name)}</strong>
        <span>${esc(s.platform)} · ${esc(s.game || "Streaming")} · ${s.is_live ? "🔴 LIVE" : "offline"}</span>
      </div>
      <div class="admin-row-actions">
        <button class="secondary small-btn" onclick="editStreamer('${s.id}')">Muuda</button>
        <button class="danger-btn" onclick="deleteStreamer('${s.id}')">Kustuta</button>
      </div>
    </div>
  `).join("");
}

function showError(m){
  $("liveGrid").innerHTML = `<div class="empty" style="grid-column:1/-1">${esc(m)}</div>`;
}

document.querySelectorAll(".filter").forEach(b =>
  b.addEventListener("click", () => {
    document.querySelectorAll(".filter").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    activePlatform = b.dataset.filter;
    renderLive();
  })
);

$("search").addEventListener("input", () => {
  renderLive();
  renderAll();
});

$("joinForm").addEventListener("submit", submitJoin);
$("loginForm").addEventListener("submit", login);
$("streamerForm").addEventListener("submit", saveStreamer);

db.auth.onAuthStateChange(() => checkSession());
loadStreamers();
