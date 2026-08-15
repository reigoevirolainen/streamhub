(() => {
  const BASE_URL = "https://rrzglnazdppgjjtaswmd.supabase.co";
  const savedKey = localStorage.getItem("streamhub_supabase_publishable_key") || "";
  let supabaseClient = null;

  const $ = s => document.querySelector(s);
  const toast = (msg, bad=false) => {
    const t=$("#toast");
    t.textContent=msg;
    t.className="toast show "+(bad?"bad":"good");
    clearTimeout(window.__toastTimer);
    window.__toastTimer=setTimeout(()=>t.className="toast",3500);
  };
  const esc = s => String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));

  function getClient(){
    if(supabaseClient) return supabaseClient;
    const key=localStorage.getItem("streamhub_supabase_publishable_key") || "";
    if(!window.supabase || !key.startsWith("sb_publishable_")) return null;
    supabaseClient=window.supabase.createClient(BASE_URL,key);
    return supabaseClient;
  }

  function openModal(html){
    $("#modalRoot").innerHTML=`<div class="modal-back" id="back"><div class="modal">${html}</div></div>`;
    $("#back").addEventListener("click",e=>{if(e.target.id==="back")closeModal()});
    $(".close")?.addEventListener("click",closeModal);
  }
  function closeModal(){ $("#modalRoot").innerHTML=""; }

  function showSetup(){
    openModal(`<button class="close">×</button>
      <div class="eyebrow">STREAMHUB</div><h2>Ühenda Supabase</h2>
      <p style="color:#9695aa">Kopeeri Supabase → Settings → API Keys alt <b>Publishable key</b> ja kleebi see siia.</p>
      <div class="field"><label>PUBLISHABLE KEY</label><input id="sbKey" type="password" placeholder="sb_publishable_..." autocomplete="off"></div>
      <p style="font-size:12px;color:#777">Ära kasuta siin kunagi <code>sb_secret_...</code> võtit.</p>
      <div class="modal-actions"><button class="btn cancel">Tühista</button><button class="primary" id="connectBtn">ÜHENDA</button></div>`);
    $(".cancel").onclick=closeModal;
    $("#connectBtn").onclick=async()=>{
      const key=$("#sbKey").value.trim();
      if(!key.startsWith("sb_publishable_")){
        toast("Palun kasuta Supabase Publishable key'd, mis algab sb_publishable_.",true);return;
      }
      // Do not block connection on a database-table test. Save the valid publishable
      // key first, then let normal data loading report any table/RLS issue separately.
      localStorage.setItem("streamhub_supabase_publishable_key",key);
      supabaseClient=window.supabase.createClient(BASE_URL,key);
      closeModal();
      updateConnectionButton();
      toast("Supabase võti salvestatud.");
      load();
    };
  }

  function updateConnectionButton(){
    const b=$("#setupBtn");
    if(!b) return;
    const ok=!!getClient();
    b.textContent=ok?"SUPABASE ✓":"ÜHENDA";
    b.classList.toggle("connected",ok);
  }


  let streamers = [];
  let filter = "Kõik";

  const $ = s => document.querySelector(s);
  const toast = (msg, bad=false) => {
    const t=$("#toast");
    t.textContent=msg;
    t.className="toast show "+(bad?"bad":"good");
    clearTimeout(window.__toastTimer);
    window.__toastTimer=setTimeout(()=>t.className="toast",3500);
  };
  const esc = s => String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));

  function openModal(html){
    $("#modalRoot").innerHTML=`<div class="modal-back" id="back"><div class="modal">${html}</div></div>`;
    $("#back").addEventListener("click",e=>{if(e.target.id==="back")closeModal()});
    $(".close")?.addEventListener("click",closeModal);
  }
  function closeModal(){ $("#modalRoot").innerHTML=""; }

  function joinModal(){
    openModal(`<button class="close">×</button><div class="eyebrow">STREAMER</div><h2>Liitu striimerina</h2>
      <p style="color:#9695aa">Saada oma andmed. Admin vaatab taotluse üle.</p>
      <form id="joinForm" class="formgrid">
      <div class="field"><label>STRIIMERI NIMI</label><input name="name" required></div>
      <div class="field"><label>GMAIL / E-MAIL</label><input name="email" type="email" required></div>
      <div class="field"><label>PLATVORM</label><select name="platform"><option>Twitch</option><option>YouTube</option><option>Kick</option><option>TikTok</option></select></div>
      <div class="field"><label>KANALI URL</label><input name="channel_url" type="url" required></div>
      <div class="field"><label>MIDA SA STRIIMID?</label><input name="game" placeholder="Fortnite, Minecraft..."></div>
      <div class="field"><label>AVATARI URL (VALIKULINE)</label><input name="avatar_url" type="url"></div>
      <div class="field"><label>SÕNUM (VALIKULINE)</label><textarea name="message"></textarea></div>
      <div class="modal-actions"><button type="button" class="btn cancel">Tühista</button><button class="primary">SAADA TAOTLUS</button></div></form>`);
    $(".cancel").onclick=closeModal;
    $("#joinForm").onsubmit=async e=>{
      e.preventDefault();
      const sb=getClient(); if(!sb){showSetup(); return;}
      const d=Object.fromEntries(new FormData(e).entries());
      const {error}=await sb.from("streamer_applications").insert({name:d.name,email:d.email,platform:d.platform,channel_url:d.channel_url,game:d.game||null,avatar_url:d.avatar_url||null,message:d.message||null,status:"pending"});
      if(error){toast(error.message,true);return}
      closeModal();toast("Taotlus saadetud! Admin vaatab selle üle.");
    };
  }

  function loginModal(type){
    openModal(`<button class="close">×</button><div class="eyebrow">${type==="admin"?"ADMIN":"KASUTAJA"}</div><h2>${type==="admin"?"Admin":"Striimeri"} login</h2>
      <form id="loginForm" class="formgrid"><div class="field"><label>E-MAIL</label><input name="email" type="email" required></div>
      <div class="field"><label>PAROOL</label><input name="password" type="password" required></div>
      <div class="modal-actions"><button type="button" class="btn cancel">Tühista</button><button class="primary">LOGI SISSE</button></div></form>`);
    $(".cancel").onclick=closeModal;
    $("#loginForm").onsubmit=async e=>{
      e.preventDefault();
      if(!supabase){showSetup(); return}
      const d=Object.fromEntries(new FormData(e).entries());
      const {data,error}=await sb.auth.signInWithPassword({email:d.email,password:d.password});
      if(error){toast(error.message,true);return}
      const {data:p}=await sb.from("profiles").select("user_type,username").eq("id",data.user.id).maybeSingle();
      if(type==="admin" && p?.user_type!=="admin"){await sb.auth.signOut();toast("See konto ei ole admin.",true);return}
      if(type==="user" && p?.user_type!=="streamer"){await sb.auth.signOut();toast("See konto ei ole striimer.",true);return}
      closeModal();toast("Sisselogimine õnnestus.");
    };
  }

  function card(s){
    const live=!!s.is_live;
    return `<article class="card"><div class="preview">${s.thumbnail_url?`<img src="${esc(s.thumbnail_url)}" alt="">`:""}<span class="badge ${live?"":"offline"}">${live?"LIVE":"OFFLINE"}</span></div>
      <div class="cardbody"><div class="cardtitle">${esc(s.name)}</div><div class="meta">${esc(s.game||"Määramata")} · ${esc(s.platform)} · ${live?`${Number(s.viewers||0).toLocaleString("et-EE")} vaatajat`:"offline"}</div><a class="cardlink" href="${esc(s.channel_url)}" target="_blank" rel="noopener">AVA KANAL →</a></div></article>`;
  }

  function render(){
    const q=($("#search")?.value||"").toLowerCase();
    const list=streamers.filter(s=>(filter==="Kõik"||s.platform===filter)&&(`${s.name} ${s.game||""}`).toLowerCase().includes(q));
    $("#streamerGrid").innerHTML=list.length?list.map(card).join(""):`<div class="empty">Ühtegi striimerit ei leitud.</div>`;
    const live=list.filter(s=>s.is_live);
    $("#liveGrid").innerHTML=live.length?live.map(card).join(""):`<div class="empty">Hetkel pole ühtegi kinnitatud LIVE striimerit.</div>`;
  }

  async function load(){
    if(!supabase){
      streamers=[];
      render();
      return;
    }
    const {data,error}=await sb.from("streamers").select("*").order("is_live",{ascending:false}).order("name");
    if(error){toast(error.message,true);return}
    streamers=data||[]; render();
  }

  function setup(){
    const setupBtn=document.createElement("button");
    setupBtn.className="btn";
    setupBtn.textContent=getClient()?"SUPABASE ✓":"ÜHENDA";
    setupBtn.id="setupBtn";
    setupBtn.title="Supabase seadistus";
    $(".actions").prepend(setupBtn);
    setupBtn.onclick=showSetup;
    updateConnectionButton();
    $("#joinBtn").onclick=joinModal;
    $("#userBtn").onclick=()=>loginModal("user");
    $("#adminBtn").onclick=()=>loginModal("admin");
    document.querySelectorAll("[data-scroll]").forEach(b=>b.onclick=()=>document.querySelector(b.dataset.scroll)?.scrollIntoView({behavior:"smooth"}));
    $("#search").oninput=render;
    const platforms=["Kõik","Twitch","YouTube","Kick","TikTok"];
    $("#filters").innerHTML=platforms.map(x=>`<button class="filter ${x==="Kõik"?"active":""}" data-filter="${x}">${x}</button>`).join("");
    document.querySelectorAll(".filter").forEach(b=>b.onclick=()=>{filter=b.dataset.filter;document.querySelectorAll(".filter").forEach(x=>x.classList.remove("active"));b.classList.add("active");render()});
    window.addEventListener("hashchange",()=>{const h=location.hash.slice(1);if(h&&document.getElementById(h))document.getElementById(h).scrollIntoView({behavior:"smooth"})});
    load();
    setInterval(load,60000);
  }
  document.addEventListener("DOMContentLoaded",setup);
})();