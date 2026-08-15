/* =========================================================
   STREAMHUB V20
   Fill SUPABASE_URL and SUPABASE_ANON_KEY in config.js
   ========================================================= */

const CFG = window.STREAMHUB_CONFIG || {
  SUPABASE_URL: "PASTE_SUPABASE_URL_HERE",
  SUPABASE_ANON_KEY: "PASTE_SUPABASE_ANON_KEY_HERE"
};

const sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);

const $ = (s) => document.querySelector(s);
const modalRoot = $("#modalRoot");
let allStreamers = [];
let selectedPlatform = "Kõik";

function toast(message) {
  $("#toast").innerHTML = `<div class="toast">${escapeHtml(message)}</div>`;
  setTimeout(() => $("#toast").innerHTML = "", 4000);
}

function escapeHtml(s="") {
  return String(s).replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}

function openModal(html) {
  modalRoot.innerHTML = `<div class="modal-backdrop" id="backdrop">
    <div class="modal">${html}</div>
  </div>`;
  $("#backdrop").addEventListener("click", e => {
    if (e.target.id === "backdrop") closeModal();
  });
}

function closeModal() { modalRoot.innerHTML = ""; }

function openJoin() {
  openModal(`
    <button class="close" onclick="closeModal()">×</button>
    <div class="eyebrow">STREAMHUB</div>
    <h2>Liitu striimerina</h2>
    <p>Saada oma andmed. Admin vaatab taotluse üle ja kinnitamise korral luuakse sulle automaatselt eraldi striimeri konto.</p>
    <form id="joinForm" class="form">
      <div class="field"><label>STRIIMERI NIMI</label><input name="name" required minlength="2" maxlength="80"></div>
      <div class="field"><label>GMAIL / E-MAIL</label><input type="email" name="email" required></div>
      <div class="field"><label>PLATVORM</label><select name="platform">
        <option>Twitch</option><option>YouTube</option><option>Kick</option><option>TikTok</option>
      </select></div>
      <div class="field"><label>KANALI URL</label><input name="channel_url" required placeholder="https://..."></div>
      <div class="field"><label>MIDA SA STRIIMID?</label><input name="game" placeholder="Fortnite, Minecraft jne"></div>
      <div class="field"><label>AVATARI URL (VALIKULINE)</label><input name="avatar_url"></div>
      <div class="field"><label>SÕNUM (VALIKULINE)</label><textarea name="message"></textarea></div>
      <div class="modal-actions"><button type="button" class="btn secondary" onclick="closeModal()">Tühista</button><button class="btn primary">SAADA TAOTLUS</button></div>
    </form>
  `);
  $("#joinForm").addEventListener("submit", submitApplication);
}

async function submitApplication(e) {
  e.preventDefault();
  const form = new FormData(e.target);
  const payload = Object.fromEntries(form.entries());
  const btn = e.target.querySelector("button[type=submit]");
  btn.disabled = true; btn.textContent = "SAADAN...";
  const { data, error } = await sb.functions.invoke("submit-application", { body: payload });
  btn.disabled = false; btn.textContent = "SAADA TAOTLUS";
  if (error || data?.error) {
    toast(data?.error || error.message);
    return;
  }
  closeModal();
  toast("Taotlus saadetud. Admin saab nüüd selle üle vaadata.");
}

function openLogin() {
  openModal(`
    <button class="close" onclick="closeModal()">×</button>
    <div class="eyebrow">KASUTAJA</div>
    <h2>Striimeri sisselogimine</h2>
    <p>Kasuta sulle e-mailiga saadetud kasutajanime ja parooli.</p>
    <form id="loginForm" class="form">
      <div class="field"><label>KASUTAJANIMI</label><input name="username" required></div>
      <div class="field"><label>PAROOL</label><input name="password" type="password" required></div>
      <div class="modal-actions"><button type="button" class="btn secondary" onclick="closeModal()">Tühista</button><button class="btn primary">LOGI SISSE</button></div>
    </form>
  `);
  $("#loginForm").addEventListener("submit", streamerLogin);
}

async function streamerLogin(e) {
  e.preventDefault();
  const f = new FormData(e.target);
  const btn = e.target.querySelector("button[type=submit]");
  btn.disabled = true; btn.textContent = "LOGIN...";
  const { data, error } = await sb.functions.invoke("streamer-login", {
    body: { username: f.get("username"), password: f.get("password") }
  });
  btn.disabled = false; btn.textContent = "LOGI SISSE";
  if (error || data?.error) return toast(data?.error || error.message);
  const { error: sessionError } = await sb.auth.setSession(data.session);
  if (sessionError) return toast(sessionError.message);
  closeModal();
  openStreamerDashboard();
}

async function openAdminLogin() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    const { data: p } = await sb.from("user_profiles").select("*").eq("id", session.user.id).maybeSingle();
    if (p?.is_admin) return openAdminPanel();
  }
  openModal(`
    <button class="close" onclick="closeModal()">×</button>
    <div class="eyebrow">ADMIN PANEL</div><h2>Admini sisselogimine</h2>
    <form id="adminLogin" class="form">
      <div class="field"><label>E-MAIL</label><input name="email" type="email" required></div>
      <div class="field"><label>PAROOL</label><input name="password" type="password" required></div>
      <div class="modal-actions"><button class="btn primary">LOGI SISSE</button></div>
    </form>
  `);
  $("#adminLogin").addEventListener("submit", async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const { data, error } = await sb.auth.signInWithPassword({
      email: f.get("email"), password: f.get("password")
    });
    if (error) return toast(error.message);
    const { data: p } = await sb.from("user_profiles").select("*").eq("id", data.user.id).maybeSingle();
    if (!p?.is_admin) {
      await sb.auth.signOut();
      return toast("Sellel kontol ei ole adminiõigusi.");
    }
    closeModal(); openAdminPanel();
  });
}

async function openAdminPanel() {
  const { data, error } = await sb.from("streamer_applications")
    .select("*").order("created_at", { ascending: false });
  if (error) return toast(error.message);

  openModal(`
    <button class="close" onclick="closeModal()">×</button>
    <div class="eyebrow">ADMIN PANEL</div>
    <h2>Liitumistaotlused</h2>
    <p>Siin saad striimeri kinnitada või tagasi lükata.</p>
    <div id="applicationList" class="admin-list"></div>
    <div class="modal-actions"><button class="btn secondary" onclick="sb.auth.signOut().then(closeModal)">LOGI VÄLJA</button></div>
  `);

  const list = $("#applicationList");
  if (!data.length) {
    list.innerHTML = `<div class="empty-state">Taotlusi pole.</div>`;
    return;
  }

  list.innerHTML = data.map(a => `
    <div class="application">
      <b>${escapeHtml(a.name)}</b>
      <small>${escapeHtml(a.email)} • ${escapeHtml(a.platform)} • ${escapeHtml(a.game || "Mäng määramata")}</small>
      <small>${escapeHtml(a.channel_url)}</small>
      <small>${escapeHtml(a.message || "")}</small>
      <div class="modal-actions">
        <span class="status ${a.status === "pending" ? "off" : "on"}">${escapeHtml(a.status)}</span>
        ${a.status === "pending" ? `
          <button class="btn secondary" onclick="rejectApplication('${a.id}')">KEELDU</button>
          <button class="btn primary" onclick="approveApplication('${a.id}')">AKSEPTEERI</button>
        ` : ""}
      </div>
    </div>
  `).join("");
}

async function approveApplication(id) {
  if (!confirm("Kinnitan selle striimeri? Konto luuakse ja andmed saadetakse tema e-mailile.")) return;
  const { data, error } = await sb.functions.invoke("approve-streamer", {
    body: { application_id: id }
  });
  if (error || data?.error) return toast(data?.error || error.message);
  toast(data.warning ? `Konto loodud, kuid e-mail ebaõnnestus: ${data.warning}` : "Konto loodud ja e-mail saadetud.");
  openAdminPanel();
}

async function rejectApplication(id) {
  if (!confirm("Lükkan taotluse tagasi?")) return;
  const { error } = await sb.from("streamer_applications")
    .update({ status: "rejected", reviewed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return toast(error.message);
  toast("Taotlus tagasi lükatud.");
  openAdminPanel();
}

async function openStreamerDashboard() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return openLogin();

  const { data: profile } = await sb.from("user_profiles").select("*").eq("id", user.id).single();
  if (!profile || profile.is_admin) return toast("See on striimeri konto.");

  const { data: streamer } = await sb.from("streamers").select("*").eq("user_id", user.id).single();
  if (!streamer) return toast("Striimeri profiili ei leitud.");

  openModal(`
    <button class="close" onclick="closeModal()">×</button>
    <div class="eyebrow">MINU KONTO</div>
    <h2>${escapeHtml(profile.display_name || streamer.name)}</h2>
    <p>${escapeHtml(profile.username || "")} • ${escapeHtml(streamer.platform)}</p>

    <div class="dash-row">
      <div><div class="status ${streamer.is_live ? "on" : "off"}">${streamer.is_live ? "● ONLINE" : "● OFFLINE"}</div>
      <small>${streamer.viewers ?? 0} vaatajat</small></div>
      <div class="switch">
        ${streamer.is_live
          ? `<button class="btn secondary" onclick="setPresence(false)">MINE OFFLINE</button>`
          : `<button class="btn primary" onclick="setPresence(true)">MINE ONLINE</button>`}
      </div>
    </div>

    <form id="profileForm" class="form" style="margin-top:15px">
      <div class="field"><label>KASUTAJANIMI</label><input name="username" value="${escapeHtml(profile.username || "")}" required></div>
      <div class="field"><label>NIMI</label><input name="display_name" value="${escapeHtml(profile.display_name || streamer.name)}"></div>
      <div class="field"><label>AVATARI URL</label><input name="avatar_url" value="${escapeHtml(streamer.avatar_url || "")}"></div>
      <button class="btn secondary">SALVESTA PROFIIL</button>
    </form>

    <form id="passwordForm" class="form" style="margin-top:15px">
      <div class="field"><label>UUS PAROOL</label><input name="password" type="password" minlength="8" required></div>
      <button class="btn secondary">MUUDA PAROOL</button>
    </form>

    <div class="modal-actions"><button class="btn secondary" onclick="sb.auth.signOut().then(closeModal)">LOGI VÄLJA</button></div>
  `);

  $("#profileForm").addEventListener("submit", async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const { error } = await sb.rpc("update_streamer_profile", {
      p_username: f.get("username"),
      p_display_name: f.get("display_name"),
      p_avatar_url: f.get("avatar_url")
    });
    if (error) return toast(error.message);
    toast("Profiil salvestatud.");
    openStreamerDashboard();
  });

  $("#passwordForm").addEventListener("submit", async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const { error } = await sb.auth.updateUser({ password: f.get("password") });
    if (error) return toast(error.message);
    toast("Parool muudetud.");
    e.target.reset();
  });
}

async function setPresence(isLive) {
  const { error } = await sb.rpc("set_streamer_presence", { p_is_live: isLive });
  if (error) return toast(error.message);
  toast(isLive ? "Oled nüüd ONLINE." : "Oled nüüd OFFLINE.");
  await loadStreamers();
  openStreamerDashboard();
}

function renderFilters() {
  const platforms = ["Kõik", "Twitch", "YouTube", "Kick", "TikTok"];
  $("#platformFilters").innerHTML = platforms.map(p =>
    `<button class="filter ${p === selectedPlatform ? "active" : ""}" onclick="selectedPlatform='${p}';renderFilters();render()"> ${p}</button>`
  ).join("");
}

function card(s) {
  const live = Boolean(s.is_live);
  const thumb = s.thumbnail_url || s.avatar_url || "";
  return `<article class="card">
    <div class="preview">
      ${thumb ? `<img src="${escapeHtml(thumb)}" alt="">` : ""}
      <div class="shade"></div>
      <span class="badge ${live ? "" : "offline"}">${live ? "LIVE" : "OFFLINE"}</span>
      <span class="viewers">👁 ${Number(s.viewers || 0).toLocaleString("et-EE")}</span>
      <span class="platform">${escapeHtml(s.platform)}</span>
    </div>
    <div class="card-body">
      <h3>${escapeHtml(s.name)}</h3>
      <div class="meta">${escapeHtml(s.game || "Mäng määramata")}</div>
      <a class="watch" href="${escapeHtml(s.channel_url)}" target="_blank" rel="noopener">${live ? "VAATA LIVE →" : "AVA KANAL →"}</a>
    </div>
  </article>`;
}

function render() {
  const query = ($("#search").value || "").toLowerCase();
  const filtered = allStreamers.filter(s => {
    const platformOk = selectedPlatform === "Kõik" || s.platform === selectedPlatform;
    const textOk = !query || `${s.name} ${s.game || ""}`.toLowerCase().includes(query);
    return platformOk && textOk;
  });

  const live = filtered.filter(s => s.is_live);
  $("#liveGrid").className = "live-grid";
  $("#liveGrid").innerHTML = live.length ? live.map(card).join("") :
    `<div class="empty-state" style="grid-column:1/-1">Hetkel pole ühtegi kinnitatud LIVE striimerit.</div>`;

  $("#streamerGrid").innerHTML = filtered.length ? filtered.map(card).join("") :
    `<div class="empty-state" style="grid-column:1/-1">Striimerit ei leitud.</div>`;
}

async function loadStreamers() {
  const { data, error } = await sb.from("public_streamers").select("*").order("is_live", { ascending:false }).order("viewers", { ascending:false });
  if (error) return toast(error.message);
  allStreamers = data || [];
  renderFilters();
  render();
}

$("#joinBtn").onclick = openJoin;
$("#heroJoin").onclick = openJoin;
$("#infoJoin").onclick = openJoin;
$("#userBtn").onclick = async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (session) openStreamerDashboard(); else openLogin();
};
$("#adminBtn").onclick = openAdminLogin;
$("#search").oninput = render;

loadStreamers();
setInterval(loadStreamers, 30000);
