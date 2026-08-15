/* =========================================================
   STREAMHUB V21
   Frontend rebuilt so navigation/buttons work even before
   Supabase is configured. No service/secret key belongs here.
   ========================================================= */

const $ = (s) => document.querySelector(s);
const modalRoot = $("#modalRoot");
let allStreamers = [];
let appBooted = false;
let selectedPlatform = "Kõik";
let sb = null;

function cfgReady() {
  const c = window.STREAMHUB_CONFIG || {};
  const key = c.SUPABASE_PUBLISHABLE_KEY || c.SUPABASE_ANON_KEY || "";
  return Boolean(window.supabase && c.SUPABASE_URL && key && !key.startsWith("PASTE_"));
}

function getSb() {
  if (sb) return sb;
  if (!cfgReady()) return null;
  const c = window.STREAMHUB_CONFIG;
  const key = c.SUPABASE_PUBLISHABLE_KEY || c.SUPABASE_ANON_KEY;
  try { sb = window.supabase.createClient(c.SUPABASE_URL, key); return sb; }
  catch (e) { console.error(e); return null; }
}

function escapeHtml(s = "") { return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c])); }
function safeUrl(url = "") { try { const u = new URL(url); return ["http:","https:"].includes(u.protocol) ? u.href : ""; } catch { return ""; } }
function toast(message, kind = "") { $("#toast").innerHTML = `<div class="toast ${kind}">${escapeHtml(message)}</div>`; setTimeout(() => { $("#toast").innerHTML = ""; }, 4500); }
function closeModal() { modalRoot.innerHTML = ""; }
function openModal(html) {
  modalRoot.innerHTML = `<div class="modal-backdrop" id="backdrop"><div class="modal">${html}</div></div>`;
  $("#backdrop").addEventListener("click", e => { if (e.target.id === "backdrop") closeModal(); });
  $(".modal .close")?.addEventListener("click", closeModal);
}
function needsConfig() {
  if (!getSb()) {
    toast("Supabase pole veel ühendatud. Lisa config.js-i Publishable key.", "error");
    return true;
  }
  return false;
}

function openJoin() {
  openModal(`
    <button class="close" aria-label="Sulge">×</button>
    <div class="eyebrow">STREAMHUB</div><h2>Liitu striimerina</h2>
    <p>Saada oma andmed. Admin vaatab taotluse üle. Kinnitamisel luuakse sulle eraldi striimeri konto.</p>
    <form id="joinForm" class="form">
      <div class="field"><label>STRIIMERI NIMI</label><input name="name" required minlength="2" maxlength="80" autocomplete="nickname"></div>
      <div class="field"><label>GMAIL / E-MAIL</label><input name="email" type="email" required autocomplete="email"></div>
      <div class="field"><label>PLATVORM</label><select name="platform"><option>Twitch</option><option>YouTube</option><option>Kick</option><option>TikTok</option></select></div>
      <div class="field"><label>KANALI URL</label><input name="channel_url" required placeholder="https://..."></div>
      <div class="field"><label>MIDA SA STRIIMID?</label><input name="game" placeholder="Fortnite, Minecraft jne"></div>
      <div class="field"><label>AVATARI URL (VALIKULINE)</label><input name="avatar_url" placeholder="https://..."></div>
      <div class="field"><label>SÕNUM (VALIKULINE)</label><textarea name="message" rows="4"></textarea></div>
      <div class="modal-actions"><button type="button" class="btn secondary" data-close>Tühista</button><button class="btn primary" type="submit">SAADA TAOTLUS</button></div>
    </form>`);
  $("[data-close]").addEventListener("click", closeModal);
  $("#joinForm").addEventListener("submit", submitApplication);
}

async function submitApplication(e) {
  e.preventDefault();
  if (needsConfig()) return;
  const form = e.target, btn = form.querySelector('button[type="submit"]');
  const payload = Object.fromEntries(new FormData(form).entries());
  const url = safeUrl(payload.channel_url); if (!url) return toast("Kanali URL peab algama http:// või https://", "error");
  btn.disabled = true; btn.textContent = "SAADAN...";
  try {
    const { data, error } = await getSb().functions.invoke("submit-application", { body: payload });
    if (error || data?.error) throw new Error(data?.error || error.message);
    closeModal(); toast(data?.mailWarning ? `Taotlus saadetud, kuid admini e-mail ei läinud läbi: ${data.mailWarning}` : "Taotlus saadetud. Admin vaatab selle üle.", data?.mailWarning ? "error" : "ok");
  } catch (err) { toast(err.message || "Taotluse saatmine ebaõnnestus", "error"); }
  finally { btn.disabled = false; btn.textContent = "SAADA TAOTLUS"; }
}

function openLogin() {
  openModal(`<button class="close" aria-label="Sulge">×</button><div class="eyebrow">KASUTAJA</div><h2>Striimeri sisselogimine</h2><p>Kasuta e-mailiga saadetud kasutajanime ja parooli.</p><form id="loginForm" class="form"><div class="field"><label>KASUTAJANIMI</label><input name="username" required autocomplete="username"></div><div class="field"><label>PAROOL</label><input name="password" type="password" required autocomplete="current-password"></div><div class="modal-actions"><button type="button" class="btn secondary" data-close>Tühista</button><button class="btn primary" type="submit">LOGI SISSE</button></div></form>`);
  $("[data-close]").addEventListener("click", closeModal); $("#loginForm").addEventListener("submit", streamerLogin);
}

async function streamerLogin(e) {
  e.preventDefault(); if (needsConfig()) return;
  const f = new FormData(e.target), btn = e.target.querySelector('button[type="submit"]'); btn.disabled = true; btn.textContent = "LOGIN...";
  try {
    const { data, error } = await getSb().functions.invoke("streamer-login", { body: { username: f.get("username"), password: f.get("password") } });
    if (error || data?.error) throw new Error(data?.error || error.message);
    const { error: sessionError } = await getSb().auth.setSession({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
    if (sessionError) throw sessionError; closeModal(); await openStreamerDashboard();
  } catch (err) { toast(err.message || "Login ebaõnnestus", "error"); }
  finally { btn.disabled = false; btn.textContent = "LOGI SISSE"; }
}

async function openAdminLogin() {
  if (needsConfig()) return;
  const { data: { session } } = await getSb().auth.getSession();
  if (session && await isAdmin()) return openAdminPanel();
  openModal(`<button class="close" aria-label="Sulge">×</button><div class="eyebrow">ADMIN PANEL</div><h2>Admini sisselogimine</h2><form id="adminLogin" class="form"><div class="field"><label>E-MAIL</label><input name="email" type="email" required autocomplete="email"></div><div class="field"><label>PAROOL</label><input name="password" type="password" required autocomplete="current-password"></div><div class="modal-actions"><button type="button" class="btn secondary" data-close>Tühista</button><button class="btn primary">LOGI SISSE</button></div></form>`);
  $("[data-close]").addEventListener("click", closeModal);
  $("#adminLogin").addEventListener("submit", async e => {
    e.preventDefault(); const f = new FormData(e.target), btn = e.target.querySelector('button[type="submit"]'); btn.disabled = true;
    try { const { error } = await getSb().auth.signInWithPassword({ email: f.get("email"), password: f.get("password") }); if (error) throw error; if (!(await isAdmin())) { await getSb().auth.signOut(); throw new Error("Sellel kontol ei ole adminiõigusi."); } closeModal(); await openAdminPanel(); }
    catch (err) { toast(err.message || "Login ebaõnnestus", "error"); } finally { btn.disabled = false; }
  });
}
async function isAdmin() { const { data, error } = await getSb().rpc("is_admin"); if (error) return false; return data === true; }

async function openAdminPanel() {
  if (needsConfig()) return; if (!(await isAdmin())) return toast("Ainult admin saab seda avada.", "error");
  const { data, error } = await getSb().from("streamer_applications").select("*").order("created_at", { ascending: false });
  if (error) return toast(error.message, "error");
  openModal(`<button class="close" aria-label="Sulge">×</button><div class="eyebrow">ADMIN PANEL</div><h2>Liitumistaotlused</h2><p>Siin kinnitad või lükkad striimeri taotluse tagasi.</p><div id="applicationList" class="admin-list"></div><div class="modal-actions"><button class="btn secondary" id="adminLogout">LOGI VÄLJA</button></div>`);
  $("#adminLogout").addEventListener("click", async () => { await getSb().auth.signOut(); closeModal(); });
  const list = $("#applicationList");
  if (!data?.length) { list.innerHTML = `<div class="empty-state">Taotlusi pole.</div>`; return; }
  list.innerHTML = data.map(a => `<div class="application"><b>${escapeHtml(a.name)}</b><small>${escapeHtml(a.email)} • ${escapeHtml(a.platform)} • ${escapeHtml(a.game || "Mäng määramata")}</small><a class="application-url" href="${escapeHtml(safeUrl(a.channel_url))}" target="_blank" rel="noopener">${escapeHtml(a.channel_url)}</a>${a.message ? `<small>${escapeHtml(a.message)}</small>` : ""}<div class="modal-actions"><span class="status ${a.status === "pending" ? "off" : "on"}">${escapeHtml(a.status)}</span>${a.status === "pending" ? `<button class="btn secondary" data-reject="${a.id}">KEELDU</button><button class="btn primary" data-approve="${a.id}">AKSEPTEERI</button>` : ""}</div></div>`).join("");
  list.querySelectorAll("[data-approve]").forEach(b => b.addEventListener("click", () => approveApplication(b.dataset.approve)));
  list.querySelectorAll("[data-reject]").forEach(b => b.addEventListener("click", () => rejectApplication(b.dataset.reject)));
}
async function approveApplication(id) { if (!confirm("Kinnitan taotluse ja loon striimerile konto?")) return; const { data, error } = await getSb().functions.invoke("approve-streamer", { body: { application_id: id } }); if (error || data?.error) return toast(data?.error || error.message, "error"); toast(data?.warning ? `Konto loodud, e-mail ebaõnnestus: ${data.warning}` : "Konto loodud ja e-mail saadetud.", data?.warning ? "error" : "ok"); await openAdminPanel(); }
async function rejectApplication(id) { if (!confirm("Lükkan taotluse tagasi?")) return; const { error } = await getSb().from("streamer_applications").update({ status: "rejected", reviewed_at: new Date().toISOString() }).eq("id", id); if (error) return toast(error.message, "error"); toast("Taotlus tagasi lükatud."); await openAdminPanel(); }

async function openStreamerDashboard() {
  if (needsConfig()) return; const { data: { user } } = await getSb().auth.getUser(); if (!user) return openLogin();
  const { data: profile, error: pe } = await getSb().from("profiles").select("*").eq("id", user.id).single();
  if (pe || !profile || profile.user_type !== "streamer") { await getSb().auth.signOut(); return toast("See konto ei ole striimeri konto.", "error"); }
  const { data: streamer, error: se } = await getSb().from("streamers").select("*").eq("user_id", user.id).single(); if (se || !streamer) return toast("Striimeri profiili ei leitud.", "error");
  openModal(`<button class="close" aria-label="Sulge">×</button><div class="eyebrow">MINU KONTO</div><h2>${escapeHtml(profile.display_name || streamer.name)}</h2><p>${escapeHtml(profile.username || "")} • ${escapeHtml(streamer.platform)}</p><div class="dash-row"><div><div class="status ${streamer.is_live ? "on" : "off"}">${streamer.is_live ? "● ONLINE" : "● OFFLINE"}</div><small>${Number(streamer.viewers || 0).toLocaleString("et-EE")} vaatajat</small></div><button id="presenceBtn" class="btn ${streamer.is_live ? "secondary" : "primary"}">${streamer.is_live ? "MINE OFFLINE" : "MINE ONLINE"}</button></div><form id="profileForm" class="form"><div class="field"><label>KASUTAJANIMI</label><input name="username" value="${escapeHtml(profile.username || "")}" required></div><div class="field"><label>NIMI</label><input name="display_name" value="${escapeHtml(profile.display_name || streamer.name)}"></div><div class="field"><label>AVATARI URL</label><input name="avatar_url" value="${escapeHtml(profile.avatar_url || streamer.avatar_url || "")}"></div><button class="btn secondary">SALVESTA PROFIIL</button></form><form id="passwordForm" class="form"><div class="field"><label>UUS PAROOL</label><input name="password" type="password" minlength="8" required></div><button class="btn secondary">MUUDA PAROOL</button></form><div class="modal-actions"><button id="streamerLogout" class="btn secondary">LOGI VÄLJA</button></div>`);
  $("#presenceBtn").addEventListener("click", () => setPresence(!streamer.is_live)); $("#streamerLogout").addEventListener("click", async () => { await getSb().auth.signOut(); closeModal(); });
  $("#profileForm").addEventListener("submit", async e => { e.preventDefault(); const f = new FormData(e.target); const { error } = await getSb().rpc("update_streamer_profile", { p_username: f.get("username"), p_display_name: f.get("display_name"), p_avatar_url: f.get("avatar_url") }); if (error) return toast(error.message, "error"); toast("Profiil salvestatud.", "ok"); await openStreamerDashboard(); });
  $("#passwordForm").addEventListener("submit", async e => { e.preventDefault(); const f = new FormData(e.target); const { error } = await getSb().auth.updateUser({ password: f.get("password") }); if (error) return toast(error.message, "error"); toast("Parool muudetud.", "ok"); e.target.reset(); });
}
async function setPresence(isLive) { const { error } = await getSb().rpc("set_streamer_presence", { p_is_live: isLive }); if (error) return toast(error.message, "error"); toast(isLive ? "Oled nüüd ONLINE." : "Oled nüüd OFFLINE.", "ok"); await loadStreamers(); await openStreamerDashboard(); }

function renderFilters() { const platforms = ["Kõik","Twitch","YouTube","Kick","TikTok"]; $("#platformFilters").innerHTML = platforms.map(p => `<button class="filter ${p === selectedPlatform ? "active" : ""}" data-platform="${escapeHtml(p)}">${p}</button>`).join(""); $("#platformFilters").querySelectorAll("button").forEach(b => b.addEventListener("click", () => { selectedPlatform = b.dataset.platform; renderFilters(); render(); })); }
function previewEmbed(s) {
  const url = safeUrl(s.channel_url); if (!url || !s.is_live) return "";
  try { const u = new URL(url); const host = u.hostname.toLowerCase();
    if (s.platform === "Twitch" && (host.includes("twitch.tv"))) { const ch = u.pathname.split("/").filter(Boolean)[0]; if (ch) return `<iframe class="live-embed" src="https://player.twitch.tv/?channel=${encodeURIComponent(ch)}&parent=${encodeURIComponent(location.hostname || "localhost")}&muted=true" allow="autoplay; fullscreen" allowfullscreen></iframe>`; }
    if (s.platform === "YouTube" && (host.includes("youtube.com") || host.includes("youtu.be")) && s.live_video_id) return `<iframe class="live-embed" src="https://www.youtube.com/embed/${encodeURIComponent(s.live_video_id)}?autoplay=1&mute=1" allow="autoplay; encrypted-media; fullscreen" allowfullscreen></iframe>`;
  } catch {}
  return "";
}
function card(s) { const live = Boolean(s.is_live); const thumb = safeUrl(s.thumbnail_url) || safeUrl(s.avatar_url); return `<article class="card"><div class="preview">${thumb ? `<img src="${escapeHtml(thumb)}" alt="" loading="lazy">` : ""}${live ? previewEmbed(s) : ""}<div class="shade"></div><span class="badge ${live ? "" : "offline"}">${live ? "LIVE" : "OFFLINE"}</span><span class="viewers">👁 ${Number(s.viewers || 0).toLocaleString("et-EE")}</span><span class="platform">${escapeHtml(s.platform)}</span></div><div class="card-body"><h3>${escapeHtml(s.name)}</h3><div class="meta">${escapeHtml(s.game || "Mäng määramata")}</div><a class="watch" href="${escapeHtml(safeUrl(s.channel_url))}" target="_blank" rel="noopener">${live ? "VAATA LIVE →" : "AVA KANAL →"}</a></div></article>`; }
function render() { const q = ($( "#search").value || "").toLowerCase(); const filtered = allStreamers.filter(s => (selectedPlatform === "Kõik" || s.platform === selectedPlatform) && (!q || `${s.name} ${s.game || ""}`.toLowerCase().includes(q))); const live = filtered.filter(s => s.is_live); $("#liveGrid").innerHTML = live.length ? live.map(card).join("") : `<div class="empty-state" style="grid-column:1/-1">Hetkel pole ühtegi kinnitatud LIVE striimerit.</div>`; $("#streamerGrid").innerHTML = filtered.length ? filtered.map(card).join("") : `<div class="empty-state" style="grid-column:1/-1">Striimerit ei leitud.</div>`; }
async function loadStreamers() { const client = getSb(); if (!client) { allStreamers = []; renderFilters(); render(); return; } const { data, error } = await client.from("streamers").select("id,name,platform,channel_url,game,avatar_url,thumbnail_url,live_video_id,is_live,viewers,last_checked_at,last_live_at").order("is_live", { ascending:false }).order("viewers", { ascending:false }); if (error) { console.error(error); return toast(error.message, "error"); } allStreamers = data || []; renderFilters(); render(); }

function boot() {
  if (appBooted) return;
  appBooted = true;

  const join = () => openJoin();
  $("#joinBtn")?.addEventListener("click", join);
  $("#heroJoin")?.addEventListener("click", join);
  $("#infoJoin")?.addEventListener("click", join);

  $("#userBtn")?.addEventListener("click", async () => {
    if (needsConfig()) return;
    const { data: { session } } = await getSb().auth.getSession();
    session ? openStreamerDashboard() : openLogin();
  });

  $("#adminBtn")?.addEventListener("click", openAdminLogin);
  $("#search")?.addEventListener("input", render);

  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener("click", e => {
      const id = a.getAttribute("href");
      if (id && id !== "#") {
        const target = document.querySelector(id);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: "smooth", block: "start" });
          history.replaceState(null, "", id);
        }
      }
    });
  });

  renderFilters();
  render();
  loadStreamers();
  setInterval(loadStreamers, 30000);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}

