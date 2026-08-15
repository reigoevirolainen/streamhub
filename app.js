const SUPABASE_URL = "https://rrzglnazdppgjjtaswmd.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_ax0HpMi18hz-AQ2x8XOT3w_gRLYKE4h"; // replace if your current key differs
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const ADMIN_UID = "56a4036e-b37d-4928-abf2-8f49d709f5b7";
let streamers = [], filter = "all";

const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const fmt = n => Number(n || 0).toLocaleString("et-EE");

function openModal(id){$(id).classList.remove("hidden")}
function closeModal(id){$(id).classList.add("hidden")}
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>closeModal(b.dataset.close));
$("joinBtn").onclick=()=>openModal("joinModal");
$("aboutJoin").onclick=()=>openModal("joinModal");
$("adminBtn").onclick=()=>openModal("adminModal");

function parseTwitchLogin(url){
  try{ const u=new URL(url); if(!/twitch\.tv$/i.test(u.hostname) && !/twitch\.tv$/i.test(u.hostname.replace(/^www\./,''))) return null; return u.pathname.split("/").filter(Boolean)[0] || null; }catch{return null}
}
function youtubeChannelId(url){
  try{ const u=new URL(url); const p=u.pathname.split("/").filter(Boolean); if(p[0]==="channel"&&p[1]) return p[1]; return null; }catch{return null}
}
function embedFor(s){
  const p=(s.platform||"").toLowerCase();
  if(p==="twitch"){
    const login=parseTwitchLogin(s.channel_url); if(!login) return "";
    return `https://player.twitch.tv/?channel=${encodeURIComponent(login)}&parent=${encodeURIComponent(location.hostname)}&muted=true`;
  }
  if(p==="youtube" && s.live_video_id) return `https://www.youtube.com/embed/${encodeURIComponent(s.live_video_id)}?autoplay=1&mute=1`;
  return "";
}
function card(s){
  const live=!!s.is_live;
  const img=s.thumbnail_url||s.avatar_url||"";
  const iframe=live?embedFor(s):"";
  const preview=iframe?`<div class="preview"><iframe src="${iframe}" allow="autoplay; fullscreen"></iframe></div>`:"";
  return `<article class="card">
    <div class="thumb" style="background-image:url('${esc(img)}')">
      ${live?'<span class="live">● LIVE</span>':'<span class="live offline">OFFLINE</span>'}
      <span class="viewers">👁 ${fmt(s.viewers)} ${live?"vaatajat":""}</span>
      <span class="platform">${esc(s.platform)}</span>${preview}
    </div>
    <div class="body"><div class="person"><img class="avatar" src="${esc(s.avatar_url||img)}" onerror="this.style.display='none'"><div><h3>${esc(s.name)}</h3><div class="game">${esc(s.game||"Mäng pole määratud")}</div></div></div>
    <a class="watch" target="_blank" rel="noopener" href="${esc(s.channel_url)}">${live?"VAATA LIVE →":"AVA KANAL →"}</a></div>
  </article>`;
}
function render(){
  const live=streamers.filter(s=>s.is_live && (filter==="all"||s.platform===filter));
  const all=streamers.filter(s=>filter==="all"||s.platform===filter);
  const q=$("search").value.trim().toLowerCase();
  const searched=all.filter(s=>!q||s.name.toLowerCase().includes(q)||String(s.game||"").toLowerCase().includes(q));
  $("liveGrid").innerHTML=live.map(card).join("");
  $("allGrid").innerHTML=searched.map(card).join("");
  $("emptyLive").classList.toggle("hidden",live.length!==0);
  $("liveCount").textContent=fmt(streamers.filter(s=>s.is_live).length);
  $("viewerCount").textContent=fmt(streamers.filter(s=>s.is_live).reduce((a,s)=>a+Number(s.viewers||0),0));
  $("streamerCount").textContent=fmt(streamers.length);
}
async function load(){
  const {data,error}=await db.from("streamers").select("*").order("is_live",{ascending:false}).order("viewers",{ascending:false});
  if(error){console.error(error);return}
  streamers=data||[]; render();
}
$("search").oninput=render;
["Twitch","YouTube","Kick","TikTok"].forEach(p=>{
  const b=document.createElement("button"); b.className="filter"; b.textContent=p; b.onclick=()=>{filter=filter===p?"all":p;document.querySelectorAll(".filter").forEach(x=>x.classList.remove("active"));b.classList.add("active");render()}; $("filters").appendChild(b);
});
const allB=document.createElement("button");allB.className="filter active";allB.textContent="Kõik";allB.onclick=()=>{filter="all";document.querySelectorAll(".filter").forEach(x=>x.classList.remove("active"));allB.classList.add("active");render()};$("filters").prepend(allB);

$("joinForm").onsubmit=async e=>{
  e.preventDefault(); const st=$("joinStatus"); st.className=""; st.textContent="Saadan...";
  if($("honeypot").value){st.textContent="OK";return}
  const payload={name:$("joinName").value.trim(),platform:$("joinPlatform").value,channel_url:$("joinUrl").value.trim(),email:$("joinEmail").value.trim(),message:$("joinMessage").value.trim()};
  const {error}=await db.from("streamer_applications").insert(payload);
  if(error){st.className="error";st.textContent=error.message;return}
  st.className="ok";st.textContent="Avaldus saadetud!";e.target.reset();
};

$("loginForm").onsubmit=async e=>{
  e.preventDefault();$("loginError").textContent=""; const {data,error}=await db.auth.signInWithPassword({email:$("loginEmail").value,password:$("loginPassword").value});
  if(error){$("loginError").className="error";$("loginError").textContent=error.message;return}
  if(data.user?.id!==ADMIN_UID){await db.auth.signOut();$("loginError").className="error";$("loginError").textContent="Sul puuduvad adminiõigused.";return}
  showAdmin();
};
async function showAdmin(){
  $("loginView").classList.add("hidden");$("adminView").classList.remove("hidden");await renderAdmin();await renderApplications();
}
$("logoutBtn").onclick=async()=>{await db.auth.signOut();$("adminView").classList.add("hidden");$("loginView").classList.remove("hidden")};
async function renderAdmin(){
  const {data,error}=await db.from("streamers").select("*").order("created_at",{ascending:false});
  if(error){$("adminError").className="error";$("adminError").textContent=error.message;return}
  $("adminList").innerHTML=(data||[]).map(s=>`<div class="admin-row"><div><strong>${esc(s.name)} ${s.is_live?"🔴 LIVE":"⚫ OFFLINE"}</strong><small>${esc(s.platform)} · ${fmt(s.viewers)} viewers · ${esc(s.game||"mäng puudub")} ${s.sync_error?`· ⚠ ${esc(s.sync_error)}`:""}</small></div><div><button onclick='editStreamer(${JSON.stringify(s).replace(/'/g,"&#39;")})'>MUUDA</button> <button class="danger" onclick="deleteStreamer('${s.id}')">KUSTUTA</button></div></div>`).join("");
}
window.editStreamer=s=>{$("editId").value=s.id;$("name").value=s.name;$("platform").value=s.platform;$("url").value=s.channel_url;$("game").value=s.game||"";$("avatar").value=s.avatar_url||"";$("saveBtn").textContent="SALVESTA";$("cancelEdit").classList.remove("hidden")};
$("cancelEdit").onclick=()=>{ $("streamerForm").reset();$("editId").value="";$("saveBtn").textContent="LISA STRIIMER";$("cancelEdit").classList.add("hidden")};
$("streamerForm").onsubmit=async e=>{
  e.preventDefault();$("adminError").textContent="";
  const payload={name:$("name").value.trim(),platform:$("platform").value,channel_url:$("url").value.trim(),game:$("game").value.trim()||null,avatar_url:$("avatar").value.trim()||null};
  let result;
  if($("editId").value){
    result=await db.from("streamers").update(payload).eq("id",$("editId").value);
  }else{
    result=await db.rpc("admin_add_streamer",{p_avatar_url:payload.avatar_url,p_channel_url:payload.channel_url,p_game:payload.game,p_name:payload.name,p_platform:payload.platform});
  }
  if(result.error){$("adminError").className="error";$("adminError").textContent=result.error.message;return}
  $("adminError").className="ok";$("adminError").textContent="Salvestatud."; $("streamerForm").reset();$("editId").value="";$("saveBtn").textContent="LISA STRIIMER";$("cancelEdit").classList.add("hidden");await renderAdmin();await load();
};
window.deleteStreamer=async id=>{if(!confirm("Kustuta striimer?"))return;const {error}=await db.from("streamers").delete().eq("id",id);if(error){$("adminError").className="error";$("adminError").textContent=error.message;return}await renderAdmin();await load()};
async function renderApplications(){
  const {data,error}=await db.from("streamer_applications").select("*").order("created_at",{ascending:false});
  if(error)return;
  $("applicationsList").innerHTML=(data||[]).map(a=>`<div class="app"><b>${esc(a.name)}</b> · ${esc(a.platform)} · ${esc(a.status)}<br><span>${esc(a.channel_url)} · ${esc(a.email)}</span>${a.message?`<p>${esc(a.message)}</p>`:""}<div class="app-actions"><button onclick="setApp('${a.id}','approved')">KINNITA</button><button onclick="setApp('${a.id}','rejected')">KEELDU</button></div></div>`).join("");
}
window.setApp=async(id,status)=>{const {error}=await db.from("streamer_applications").update({status}).eq("id",id);if(error)alert(error.message);else renderApplications()};

db.auth.getSession().then(({data})=>{if(data.session&&data.session.user.id===ADMIN_UID)showAdmin()});
load();
setInterval(load,60000);
