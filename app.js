const SUPABASE_URL="https://rrzglnazdppgjjtaswmd.supabase.co";
const SUPABASE_PUBLISHABLE_KEY="sb_publishable_ax0HpMi18hz-AQ2x8XOT3w_gRLYKE4h";
const ADMIN_UID="56a4036e-b37d-4928-abf2-8f49d709f5b7";
const FUNCTION_URL=`${SUPABASE_URL}/functions/v1/submit-streamer-application`;

const {createClient}=supabase;
const db=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);

let streamers=[],applications=[],activePlatform="all";

const fallbackThumb="https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1000&q=80";
const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));

function parsePath(url){
  try{return new URL(url).pathname.split("/").filter(Boolean)}
  catch{return[]}
}

function channelHandle(s){
  const p=parsePath(s.channel_url);
  if(!p.length)return"";
  if(s.platform==="Twitch")return p[0].replace(/^@/,"");
  if(s.platform==="TikTok")return p.find(x=>x.startsWith("@"))?.slice(1)||p[0].replace(/^@/,"");
  if(s.platform==="YouTube"){
    const at=p.find(x=>x.startsWith("@"));
    return at?at.slice(1):"";
  }
  return p[0].replace(/^@/,"");
}

function twitchPreview(s){
  if(s.platform!=="Twitch"||!s.is_live)return"";
  const ch=channelHandle(s);
  if(!ch)return"";
  return `<div class="preview">
    <iframe src="https://player.twitch.tv/?channel=${encodeURIComponent(ch)}&parent=streamhub.ee&autoplay=true&muted=true"
      allow="autoplay; fullscreen" allowfullscreen loading="lazy"></iframe>
    <div class="preview-label">LIVE eelvaade · heli jaoks ava stream</div>
  </div>`;
}

function youtubePreview(s){
  if(s.platform!=="YouTube"||!s.is_live||!s.live_video_id)return"";
  return `<div class="preview">
    <iframe src="https://www.youtube.com/embed/${encodeURIComponent(s.live_video_id)}?autoplay=1&mute=1&playsinline=1"
      allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe>
    <div class="preview-label">LIVE eelvaade · heli jaoks ava stream</div>
  </div>`;
}

function tiktokPreview(s){
  if(s.platform!=="TikTok"||!s.is_live)return"";
  const h=channelHandle(s);
  if(!h)return"";
  return `<div class="preview tiktok-preview">
    <iframe src="https://www.tiktok.com/embed/live/@${encodeURIComponent(h)}?autoplay=1&muted=1&controls=1&embed_domain=streamhub.ee"
      allow="autoplay; fullscreen" allowfullscreen loading="lazy"></iframe>
    <div class="preview-label">TikTok LIVE · embed sõltub TikToki toest</div>
  </div>`;
}

function preview(s){
  return twitchPreview(s)||youtubePreview(s)||tiktokPreview(s);
}

function card(s){
  const a=s.avatar_url||`https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(s.name)}`;
  const t=s.thumbnail_url||fallbackThumb;
  const live=s.is_live;

  return `<article class="card ${live?"is-live":""}">
    <div class="thumb" style="background-image:url('${esc(t)}')">
      ${live?`<span class="live-badge">● LIVE</span><span class="viewers">👁 ${Number(s.viewers||0).toLocaleString("et-EE")}</span>`:`<span class="platform">OFFLINE</span>`}
      <span class="platform">${esc(s.platform)}</span>
      ${preview(s)}
    </div>
    <div class="card-body">
      <div class="person">
        <img class="avatar" src="${esc(a)}" alt="">
        <div>
          <h3>${esc(s.name)}</h3>
          <div class="game">${esc(s.game||"Streaming")}</div>
        </div>
      </div>
      <a class="watch" href="${esc(s.channel_url)}" target="_blank" rel="noopener">
        ${live?"VAATA LIVE'I  →":"AVA KANAL  →"}
      </a>
    </div>
  </article>`;
}

async function loadStreamers(){
  const {data,error}=await db.from("streamers").select("*").order("is_live",{ascending:false}).order("viewers",{ascending:false});
  if(error){showError("Andmebaasiga ühendamisel tekkis viga: "+error.message);return}
  streamers=data||[];
  render();
}

function render(){
  const live=streamers.filter(s=>s.is_live);
  $("liveCount").textContent=live.length;
  $("viewerCount").textContent=live.reduce((a,s)=>a+Number(s.viewers||0),0).toLocaleString("et-EE");
  $("streamerCount").textContent=streamers.length;
  renderLive();
  renderAll();
  renderAdminList();
}

function renderLive(){
  const q=$("search").value.toLowerCase();
  const d=streamers.filter(s=>s.is_live&&(activePlatform==="all"||s.platform===activePlatform)&&s.name.toLowerCase().includes(q));
  $("liveGrid").innerHTML=d.map(card).join("");
  $("emptyLive").classList.toggle("hidden",d.length>0);
}

function renderAll(){
  const q=$("search").value.toLowerCase();
  $("allGrid").innerHTML=streamers.filter(s=>s.name.toLowerCase().includes(q)).map(card).join("");
}

function openJoin(){$("joinModal").classList.remove("hidden");$("joinName").focus()}
function closeJoin(){$("joinModal").classList.add("hidden")}

async function submitJoin(e){
  e.preventDefault();
  const b=e.target.querySelector("button[type=submit]"),st=$("joinStatus");
  b.disabled=true;b.textContent="SAADAN...";st.textContent="";
  try{
    const payload={
      name:$("joinName").value.trim(),
      platform:$("joinPlatform").value,
      channel_url:$("joinUrl").value.trim(),
      email:$("joinEmail").value.trim(),
      message:$("joinMessage").value.trim(),
      website:$("website").value
    };
    const r=await fetch(FUNCTION_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
    const d=await r.json().catch(()=>({}));
    if(!r.ok||d.error)throw new Error(d.error||"Saatmine ebaõnnestus.");
    st.className="form-status ok";
    st.textContent="✅ Avaldus saadetud! Võtame sinuga ühendust.";
    e.target.reset();
  }catch(err){
    st.className="form-status bad";
    st.textContent="❌ "+err.message;
  }finally{
    b.disabled=false;b.textContent="SAADA AVALDUS →";
  }
}

function openAdmin(){$("adminModal").classList.remove("hidden");checkSession()}
function closeAdmin(){$("adminModal").classList.add("hidden")}

async function checkSession(){
  const {data}=await db.auth.getSession();
  const u=data.session?.user;
  const ok=u?.id===ADMIN_UID;
  $("loginView").classList.toggle("hidden",ok);
  $("adminView").classList.toggle("hidden",!ok);
  if(ok){await loadApplications();renderAdminList()}
}

async function login(e){
  e.preventDefault();
  $("loginError").classList.add("hidden");
  const {data,error}=await db.auth.signInWithPassword({
    email:$("loginEmail").value.trim(),
    password:$("loginPassword").value
  });
  if(error){
    $("loginError").textContent=error.message;
    $("loginError").classList.remove("hidden");
    return;
  }
  if(data.user.id!==ADMIN_UID){
    await db.auth.signOut();
    $("loginError").textContent="Sellel kontol ei ole adminiõigusi.";
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

  const errorBox=$("adminError");
  errorBox.classList.add("hidden");

  const {data:{user}}=await db.auth.getUser();

  if(!user||user.id!==ADMIN_UID){
    errorBox.textContent="Admini sessioon puudub. Logi uuesti sisse.";
    errorBox.classList.remove("hidden");
    return;
  }

  const editId=$("editId").value.trim();

  const payload={
    name:$("name").value.trim(),
    platform:$("platform").value,
    channel_url:$("url").value.trim(),
    avatar_url:$("avatar").value.trim()||null
  };

  if(!payload.name||!payload.channel_url){
    errorBox.textContent="Nimi ja kanali URL on kohustuslikud.";
    errorBox.classList.remove("hidden");
    return;
  }

  const btn=$("saveBtn");
  btn.disabled=true;
  btn.textContent=editId?"SALVESTAN...":"LISAN...";

  try{
    let result;

    if(editId){
      result=await db.from("streamers")
        .update(payload)
        .eq("id",editId)
        .select()
        .single();
    }else{
      /*
       * V7 FIX:
       * admin_add_streamer() nõuab TÄPSELT 5 argumenti.
       * V6 saatis ainult 4 argumenti ja jättis p_game välja.
       * See põhjustas:
       * "Could not find the function ... in the schema cache"
       *
       * p_game saadame nullina, sest mängu määrab hiljem
       * automaatne platvormi sünkroonimine.
       */
      result=await db.rpc("admin_add_streamer",{
        p_avatar_url:payload.avatar_url,
        p_channel_url:payload.channel_url,
        p_game:null,
        p_name:payload.name,
        p_platform:payload.platform
      });
    }

    if(result.error)throw result.error;

    cancelEdit();
    await loadStreamers();

    errorBox.textContent=editId
      ?"Striimer salvestatud!"
      :"Striimer lisatud! Automaatne LIVE kontroll võtab selle üle.";

    errorBox.className="admin-error success";
    setTimeout(()=>errorBox.classList.add("hidden"),3500);

  }catch(err){
    console.error(err);
    errorBox.textContent=`Salvestamine ebaõnnestus: ${err.message||err}`;
    errorBox.className="admin-error";
  }finally{
    btn.disabled=false;
    btn.textContent=$("editId").value?"Salvesta muudatus":"Lisa striimer";
  }
}

function editStreamer(id){
  const s=streamers.find(x=>x.id===id);
  if(!s)return;
  $("editId").value=s.id;
  $("name").value=s.name||"";
  $("platform").value=s.platform||"Twitch";
  $("url").value=s.channel_url||"";
  $("avatar").value=s.avatar_url||"";
  $("saveBtn").textContent="Salvesta muudatus";
  $("cancelEdit").classList.remove("hidden");
  $("name").focus();
}

function cancelEdit(){
  $("streamerForm").reset();
  $("editId").value="";
  $("saveBtn").textContent="Lisa striimer";
  $("cancelEdit").classList.add("hidden");
}

async function deleteStreamer(id){
  const s=streamers.find(x=>x.id===id);
  if(!s||!confirm(`Kustuta ${s.name}?`))return;

  const {error}=await db.from("streamers").delete().eq("id",id);

  if(error){
    $("adminError").textContent=`Kustutamine ebaõnnestus: ${error.message}`;
    $("adminError").className="admin-error";
    return;
  }

  await loadStreamers();
}

async function loadApplications(){
  const {data,error}=await db.from("streamer_applications").select("*").order("created_at",{ascending:false});
  if(error){
    $("applicationsList").innerHTML=`<div class="admin-error">${esc(error.message)}</div>`;
    return;
  }
  applications=data||[];
  renderApplications();
}

function renderApplications(){
  const el=$("applicationsList");

  if(!applications.length){
    el.innerHTML='<div class="empty">Uusi avaldusi pole.</div>';
    return;
  }

  el.innerHTML=applications.map(a=>`
    <div class="admin-row app-row">
      <div>
        <strong>${esc(a.name)} · ${esc(a.platform)}</strong>
        <span>${esc(a.email)} · ${new Date(a.created_at).toLocaleString("et-EE")} · ${esc(a.status)}</span>
        <span>${esc(a.message||"")}</span>
      </div>
      <div class="admin-row-actions">
        ${a.status==="pending"
          ?`<button class="secondary small-btn" onclick="approveApplication('${a.id}')">Kinnita</button>
            <button class="danger-btn" onclick="rejectApplication('${a.id}')">Keeldu</button>`
          :""}
        <a class="secondary small-btn" href="${esc(a.channel_url)}" target="_blank" rel="noopener">Ava</a>
      </div>
    </div>`).join("");
}

async function approveApplication(id){
  const a=applications.find(x=>x.id===id);
  if(!a)return;

  const {error}=await db.rpc("admin_approve_application",{p_application_id:id});

  if(error){
    $("adminError").textContent=error.message;
    $("adminError").className="admin-error";
    return;
  }

  await Promise.all([loadApplications(),loadStreamers()]);
}

async function rejectApplication(id){
  const {error}=await db.rpc("admin_set_application_status",{
    p_application_id:id,
    p_status:"rejected"
  });

  if(error){
    $("adminError").textContent=error.message;
    $("adminError").className="admin-error";
    return;
  }

  await loadApplications();
}

function showError(m){
  $("liveGrid").innerHTML=`<div class="empty" style="grid-column:1/-1">${esc(m)}</div>`;
}

$("joinBtn").addEventListener("click",openJoin);
$("aboutJoin").addEventListener("click",openJoin);
$("closeJoin").addEventListener("click",closeJoin);
$("adminBtn").addEventListener("click",openAdmin);
$("closeAdmin").addEventListener("click",closeAdmin);
$("logoutBtn").addEventListener("click",logout);
$("joinForm").addEventListener("submit",submitJoin);
$("loginForm").addEventListener("submit",login);
$("streamerForm").addEventListener("submit",saveStreamer);
$("cancelEdit").addEventListener("click",cancelEdit);

document.querySelectorAll(".filter").forEach(b=>b.addEventListener("click",()=>{
  document.querySelectorAll(".filter").forEach(x=>x.classList.remove("active"));
  b.classList.add("active");
  activePlatform=b.dataset.filter;
  renderLive();
}));

$("search").addEventListener("input",()=>{
  renderLive();
  renderAll();
});

db.channel("streamhub-live")
  .on("postgres_changes",{event:"*",schema:"public",table:"streamers"},()=>loadStreamers())
  .subscribe();

db.auth.onAuthStateChange(()=>checkSession());

loadStreamers();
