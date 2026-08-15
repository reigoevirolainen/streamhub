/* =========================================================
   STREAMHUB V22
   Robust frontend: navigation and modals NEVER depend on
   Supabase being configured. Backend actions do.
   ========================================================= */

(() => {
  "use strict";

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const modalRoot = () => $("#modalRoot");
  let sb = null;
  let allStreamers = [];
  let selectedPlatform = "Kõik";
  let booted = false;

  function escapeHtml(value = "") {
    return String(value).replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[c]));
  }

  function safeUrl(value = "") {
    try {
      const u = new URL(value);
      return ["http:", "https:"].includes(u.protocol) ? u.href : "";
    } catch (_) { return ""; }
  }

  function toast(message, kind = "") {
    const el = $("#toast");
    if (!el) return;
    el.innerHTML = `<div class="toast ${kind}">${escapeHtml(message)}</div>`;
    clearTimeout(window.__streamhubToastTimer);
    window.__streamhubToastTimer = setTimeout(() => { el.innerHTML = ""; }, 5000);
  }

  function closeModal() {
    const root = modalRoot();
    if (root) root.innerHTML = "";
  }

  function openModal(content) {
    const root = modalRoot();
    if (!root) return;
    root.innerHTML = `<div class="modal-backdrop" id="backdrop"><div class="modal">${content}</div></div>`;
    $("#backdrop")?.addEventListener("click", e => {
      if (e.target.id === "backdrop") closeModal();
    });
    $(".modal .close")?.addEventListener("click", closeModal);
    $$('[data-close]').forEach(b => b.addEventListener("click", closeModal));
  }

  function getConfig() {
    return window.STREAMHUB_CONFIG || {};
  }

  function cfgReady() {
    const c = getConfig();
    const key = c.SUPABASE_PUBLISHABLE_KEY || c.SUPABASE_ANON_KEY || "";
    return Boolean(window.supabase && c.SUPABASE_URL && key && !/^PASTE_|^YOUR_/i.test(key));
  }

  function getSb() {
    if (sb) return sb;
    if (!cfgReady()) return null;
    const c = getConfig();
    const key = c.SUPABASE_PUBLISHABLE_KEY || c.SUPABASE_ANON_KEY;
    try {
      sb = window.supabase.createClient(c.SUPABASE_URL, key);
      return sb;
    } catch (err) {
      console.error("Supabase init failed", err);
      return null;
    }
  }

  function backendRequired() {
    if (getSb()) return true;
    return false;
  }

  function backendNotice(container) {
    if (!container) return;
    let box = container.querySelector(".backend-notice");
    if (!box) {
      box = document.createElement("div");
      box.className = "backend-notice";
      box.innerHTML =
        "<strong>Ühendus seadistamisel</strong>" +
        "<span>Veebileht töötab, kuid konto- ja taotlusefunktsioonid vajavad Supabase Publishable key'd.</span>";
      container.prepend(box);
    }
  }

  // ---------- PUBLIC NAVIGATION ----------

  function scrollToId(id) {
    const target = document.getElementById(id);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", `#${id}`);
  }

  function openJoin() {
    openModal(`
      <button class="close" aria-label="Sulge">×</button>
      <div class="eyebrow">STREAMHUB</div>
      <h2>Liitu striimerina</h2>
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
    $("#joinForm")?.addEventListener("submit", submitApplication);
  }

  async function submitApplication(e) {
    e.preventDefault();
    if (!backendRequired()) {
      backendNotice(e.currentTarget.closest(".modal"));
      return;
    }
    const form = e.currentTarget;
    const btn = form.querySelector('button[type="submit"]');
    const payload = Object.fromEntries(new FormData(form).entries());
    if (!safeUrl(payload.channel_url)) {
      toast("Kanali URL peab algama http:// või https://", "error");
      return;
    }
    btn.disabled = true;
    btn.textContent = "SAADAN...";
    try {
      const { data, error } = await getSb().functions.invoke("submit-application", { body: payload });
      if (error || data?.error) throw new Error(data?.error || error.message || "Taotluse saatmine ebaõnnestus");
      closeModal();
      toast(data?.mailWarning ? `Taotlus saadetud. E-maili hoiatus: ${data.mailWarning}` : "Taotlus saadetud. Admin vaatab selle üle.", data?.mailWarning ? "error" : "ok");
    } catch (err) {
      toast(err.message || "Taotluse saatmine ebaõnnestus", "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "SAADA TAOTLUS";
    }
  }

  function openLogin() {
    openModal(`
      <button class="close" aria-label="Sulge">×</button>
      <div class="eyebrow">KASUTAJA</div>
      <h2>Striimeri sisselogimine</h2>
      <p>Kasuta StreamHubi kinnituskirjas saadud kasutajanime ja parooli.</p>
      <form id="loginForm" class="form">
        <div class="field"><label>KASUTAJANIMI</label><input name="username" required autocomplete="username"></div>
        <div class="field"><label>PAROOL</label><input name="password" type="password" required autocomplete="current-password"></div>
        <div class="modal-actions"><button type="button" class="btn secondary" data-close>Tühista</button><button class="btn primary" type="submit">LOGI SISSE</button></div>
      </form>`);
    $("#loginForm")?.addEventListener("submit", streamerLogin);
  }

  async function streamerLogin(e) {
    e.preventDefault();
    if (!backendRequired()) {
      backendNotice(e.currentTarget.closest(".modal"));
      return;
    }
    const form = e.currentTarget;
    const f = new FormData(form);
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = "LOGIN...";
    try {
      const { data, error } = await getSb().functions.invoke("streamer-login", { body: { username: f.get("username"), password: f.get("password") } });
      if (error || data?.error) throw new Error(data?.error || error.message || "Login ebaõnnestus");
      const { error: sessionError } = await getSb().auth.setSession({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
      if (sessionError) throw sessionError;
      closeModal();
      await openStreamerDashboard();
    } catch (err) {
      toast(err.message || "Login ebaõnnestus", "error");
    } finally {
      btn.disabled = false; btn.textContent = "LOGI SISSE";
    }
  }

  async function openUser() {
    if (!backendRequired()) { openLogin(); return; }
    try {
      const { data: { session } } = await getSb().auth.getSession();
      if (session) return openStreamerDashboard();
    } catch (_) {}
    openLogin();
  }

  function openAdminLogin() {
    // The modal ALWAYS opens. Supabase is only needed when submitting it.
    openModal(`
      <button class="close" aria-label="Sulge">×</button>
      <div class="eyebrow">ADMIN PANEL</div>
      <h2>Admini sisselogimine</h2>
      <form id="adminLogin" class="form">
        <div class="field"><label>E-MAIL</label><input name="email" type="email" required autocomplete="email"></div>
        <div class="field"><label>PAROOL</label><input name="password" type="password" required autocomplete="current-password"></div>
        <div class="modal-actions"><button type="button" class="btn secondary" data-close>Tühista</button><button class="btn primary" type="submit">LOGI SISSE</button></div>
      </form>`);
    $("#adminLogin")?.addEventListener("submit", adminLogin);
  }

  async function adminLogin(e) {
    e.preventDefault();
    if (!backendRequired()) {
      backendNotice(e.currentTarget.closest(".modal"));
      return;
    }
    const form = e.currentTarget;
    const f = new FormData(form);
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = "LOGIN...";
    try {
      const { error } = await getSb().auth.signInWithPassword({ email: f.get("email"), password: f.get("password") });
      if (error) throw error;
      if (!(await isAdmin())) {
        await getSb().auth.signOut();
        throw new Error("Sellel kontol ei ole adminiõigusi.");
      }
      closeModal();
      await openAdminPanel();
    } catch (err) {
      toast(err.message || "Admini login ebaõnnestus", "error");
    } finally {
      btn.disabled = false; btn.textContent = "LOGI SISSE";
    }
  }

  async function isAdmin() {
    const { data, error } = await getSb().rpc("is_admin");
    return !error && data === true;
  }

  async function openAdminPanel() {
    if (!backendRequired()) {
      openModal(`<button class="close" aria-label="Sulge">×</button><div class="eyebrow">ADMIN PANEL</div><h2>Admin</h2><div class="backend-notice"><strong>Ühendus seadistamisel</strong><span>Admini andmed muutuvad kättesaadavaks pärast Supabase Publishable key lisamist Verceli keskkonnamuutujasse.</span></div>`);
      return;
    }
    if (!(await isAdmin())) return toast("Ainult admin saab seda avada.", "error");
    const { data, error } = await getSb().from("streamer_applications").select("*").order("created_at", { ascending: false });
    if (error) return toast(error.message, "error");
    openModal(`
      <button class="close" aria-label="Sulge">×</button>
      <div class="eyebrow">ADMIN PANEL</div><h2>Liitumistaotlused</h2>
      <p>Siin kinnitad või lükkad striimerite taotlused tagasi.</p>
      <div id="applicationList" class="admin-list"></div>
      <div class="modal-actions"><button class="btn secondary" id="adminLogout">LOGI VÄLJA</button></div>`);
    $("#adminLogout")?.addEventListener("click", async () => { await getSb().auth.signOut(); closeModal(); });
    const list = $("#applicationList");
    if (!data?.length) { list.innerHTML = `<div class="empty-state">Taotlusi pole.</div>`; return; }
    list.innerHTML = data.map(a => {
      const channel = safeUrl(a.channel_url);
      return `<div class="application"><b>${escapeHtml(a.name)}</b><small>${escapeHtml(a.email)} • ${escapeHtml(a.platform)} • ${escapeHtml(a.game || "Mäng määramata")}</small>${channel ? `<a class="application-url" href="${escapeHtml(channel)}" target="_blank" rel="noopener">${escapeHtml(a.channel_url)}</a>` : ""}${a.message ? `<small>${escapeHtml(a.message)}</small>` : ""}<div class="modal-actions"><span class="status ${a.status === "pending" ? "off" : "on"}">${escapeHtml(a.status)}</span>${a.status === "pending" ? `<button class="btn secondary" data-reject="${escapeHtml(a.id)}">KEELDU</button><button class="btn primary" data-approve="${escapeHtml(a.id)}">AKSEPTEERI</button>` : ""}</div></div>`;
    }).join("");
    $$('[data-approve]', list).forEach(b => b.addEventListener("click", () => approveApplication(b.dataset.approve)));
    $$('[data-reject]', list).forEach(b => b.addEventListener("click", () => rejectApplication(b.dataset.reject)));
  }

  async function approveApplication(id) {
    if (!confirm("Kinnitan taotluse ja loon striimerile konto?")) return;
    const { data, error } = await getSb().functions.invoke("approve-streamer", { body: { application_id: id } });
    if (error || data?.error) return toast(data?.error || error.message, "error");
    toast(data?.warning ? `Konto loodud, e-maili hoiatus: ${data.warning}` : "Konto loodud ja e-mail saadetud.", data?.warning ? "error" : "ok");
    await openAdminPanel();
  }

  async function rejectApplication(id) {
    if (!confirm("Lükkan taotluse tagasi?")) return;
    const { error } = await getSb().from("streamer_applications").update({ status: "rejected", reviewed_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast(error.message, "error");
    toast("Taotlus tagasi lükatud.", "ok");
    await openAdminPanel();
  }

  async function openStreamerDashboard() {
    if (!backendRequired()) {
      openModal(`<button class="close" aria-label="Sulge">×</button><div class="eyebrow">KASUTAJA</div><h2>Minu konto</h2><div class="backend-notice"><strong>Ühendus seadistamisel</strong><span>Kasutajakonto vajab Supabase Publishable key'd. Avalik leht ise töötab.</span></div>`);
      return;
    }
    const { data: { user } } = await getSb().auth.getUser();
    if (!user) return openLogin();
    const { data: profile, error: pe } = await getSb().from("profiles").select("*").eq("id", user.id).single();
    if (pe || !profile || profile.user_type !== "streamer") {
      await getSb().auth.signOut();
      return toast("See konto ei ole striimeri konto.", "error");
    }
    const { data: streamer, error: se } = await getSb().from("streamers").select("*").eq("user_id", user.id).single();
    if (se || !streamer) return toast("Striimeri profiili ei leitud.", "error");
    openModal(`
      <button class="close" aria-label="Sulge">×</button>
      <div class="eyebrow">MINU KONTO</div>
      <h2>${escapeHtml(profile.display_name || streamer.name)}</h2>
      <p>${escapeHtml(profile.username || "")} • ${escapeHtml(streamer.platform)}</p>
      <div class="dash-row"><div><div class="status ${streamer.is_live ? "on" : "off"}">${streamer.is_live ? "● ONLINE" : "● OFFLINE"}</div><small>${Number(streamer.viewers || 0).toLocaleString("et-EE")} vaatajat</small></div><button id="presenceBtn" class="btn ${streamer.is_live ? "secondary" : "primary"}">${streamer.is_live ? "MINE OFFLINE" : "MINE ONLINE"}</button></div>
      <form id="profileForm" class="form"><div class="field"><label>KASUTAJANIMI</label><input name="username" value="${escapeHtml(profile.username || "")}" required></div><div class="field"><label>NIMI</label><input name="display_name" value="${escapeHtml(profile.display_name || streamer.name)}"></div><div class="field"><label>AVATARI URL</label><input name="avatar_url" value="${escapeHtml(profile.avatar_url || streamer.avatar_url || "")}"></div><button class="btn secondary">SALVESTA PROFIIL</button></form>
      <form id="passwordForm" class="form"><div class="field"><label>UUS PAROOL</label><input name="password" type="password" minlength="8" required></div><button class="btn secondary">MUUDA PAROOL</button></form>
      <div class="modal-actions"><button id="streamerLogout" class="btn secondary">LOGI VÄLJA</button></div>`);
    $("#presenceBtn")?.addEventListener("click", () => setPresence(!streamer.is_live));
    $("#streamerLogout")?.addEventListener("click", async () => { await getSb().auth.signOut(); closeModal(); });
    $("#profileForm")?.addEventListener("submit", async e => {
      e.preventDefault(); const f = new FormData(e.currentTarget);
      const { error } = await getSb().rpc("update_streamer_profile", { p_username: f.get("username"), p_display_name: f.get("display_name"), p_avatar_url: f.get("avatar_url") });
      if (error) return toast(error.message, "error");
      toast("Profiil salvestatud.", "ok"); await openStreamerDashboard();
    });
    $("#passwordForm")?.addEventListener("submit", async e => {
      e.preventDefault(); const f = new FormData(e.currentTarget);
      const { error } = await getSb().auth.updateUser({ password: f.get("password") });
      if (error) return toast(error.message, "error");
      toast("Parool muudetud.", "ok"); e.currentTarget.reset();
    });
  }

  async function setPresence(isLive) {
    const { error } = await getSb().rpc("set_streamer_presence", { p_is_live: isLive });
    if (error) return toast(error.message, "error");
    toast(isLive ? "Oled nüüd ONLINE." : "Oled nüüd OFFLINE.", "ok");
    await loadStreamers(); await openStreamerDashboard();
  }

  // ---------- DIRECTORY ----------

  function renderFilters() {
    const root = $("#platformFilters");
    if (!root) return;
    const platforms = ["Kõik", "Twitch", "YouTube", "Kick", "TikTok"];
    root.innerHTML = platforms.map(p => `<button type="button" class="filter ${p === selectedPlatform ? "active" : ""}" data-platform="${escapeHtml(p)}">${escapeHtml(p)}</button>`).join("");
    $$('button[data-platform]', root).forEach(b => b.addEventListener("click", () => { selectedPlatform = b.dataset.platform; renderFilters(); render(); }));
  }

  function previewEmbed(s) {
    const url = safeUrl(s.channel_url);
    if (!url || !s.is_live) return "";
    try {
      const u = new URL(url);
      const host = u.hostname.toLowerCase();
      if (s.platform === "Twitch" && host.includes("twitch.tv")) {
        const ch = u.pathname.split("/").filter(Boolean)[0];
        if (ch) return `<iframe class="live-embed" title="${escapeHtml(s.name)} LIVE" src="https://player.twitch.tv/?channel=${encodeURIComponent(ch)}&parent=${encodeURIComponent(location.hostname || "localhost")}&muted=true" allow="autoplay; fullscreen" allowfullscreen></iframe>`;
      }
      if (s.platform === "YouTube" && (host.includes("youtube.com") || host.includes("youtu.be")) && s.live_video_id) {
        return `<iframe class="live-embed" title="${escapeHtml(s.name)} LIVE" src="https://www.youtube.com/embed/${encodeURIComponent(s.live_video_id)}?autoplay=1&mute=1" allow="autoplay; encrypted-media; fullscreen" allowfullscreen></iframe>`;
      }
    } catch (_) {}
    return "";
  }

  function card(s) {
    const live = Boolean(s.is_live);
    const thumb = safeUrl(s.thumbnail_url) || safeUrl(s.avatar_url);
    return `<article class="card"><div class="preview">${thumb ? `<img src="${escapeHtml(thumb)}" alt="" loading="lazy">` : ""}${live ? previewEmbed(s) : ""}<div class="shade"></div><span class="badge ${live ? "" : "offline"}">${live ? "LIVE" : "OFFLINE"}</span><span class="viewers">👁 ${Number(s.viewers || 0).toLocaleString("et-EE")}</span><span class="platform">${escapeHtml(s.platform)}</span></div><div class="card-body"><h3>${escapeHtml(s.name)}</h3><div class="meta">${escapeHtml(s.game || "Mäng määramata")}</div><a class="watch" href="${escapeHtml(safeUrl(s.channel_url) || "#")}" target="_blank" rel="noopener">${live ? "VAATA LIVE →" : "AVA KANAL →"}</a></div></article>`;
  }

  function render() {
    const search = $("#search");
    const q = (search?.value || "").toLowerCase();
    const filtered = allStreamers.filter(s => (selectedPlatform === "Kõik" || s.platform === selectedPlatform) && (!q || `${s.name} ${s.game || ""}`.toLowerCase().includes(q)));
    const live = filtered.filter(s => s.is_live);
    const liveGrid = $("#liveGrid"); const streamerGrid = $("#streamerGrid");
    if (liveGrid) liveGrid.innerHTML = live.length ? live.map(card).join("") : `<div class="empty-state" style="grid-column:1/-1">Hetkel pole ühtegi kinnitatud LIVE striimerit.</div>`;
    if (streamerGrid) streamerGrid.innerHTML = filtered.length ? filtered.map(card).join("") : `<div class="empty-state" style="grid-column:1/-1">Striimerit ei leitud.</div>`;
  }

  async function loadStreamers() {
    const client = getSb();
    if (!client) { allStreamers = []; renderFilters(); render(); return; }
    const { data, error } = await client.from("streamers").select("id,user_id,name,platform,channel_url,game,avatar_url,thumbnail_url,live_video_id,is_live,viewers,last_checked_at,last_live_at").order("is_live", { ascending: false }).order("viewers", { ascending: false });
    if (error) { console.error(error); return; }
    allStreamers = data || [];
    renderFilters(); render();
  }

  function boot() {
    if (booted) return;
    booted = true;

    // Buttons are deliberately bound without checking Supabase.
    $("#joinBtn")?.addEventListener("click", openJoin);
    $("#heroJoin")?.addEventListener("click", openJoin);
    $("#infoJoin")?.addEventListener("click", openJoin);
    $("#userBtn")?.addEventListener("click", openUser);
    $("#adminBtn")?.addEventListener("click", openAdminLogin);
    $("#search")?.addEventListener("input", render);

    // Hash navigation is independent of backend/config.
    document.addEventListener("click", e => {
      const a = e.target.closest?.('a[href^="#"]');
      if (!a) return;
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

    renderFilters();
    render();
    loadStreamers();
    window.addEventListener("streamhub-config-ready", () => { loadStreamers(); });
    window.setInterval(loadStreamers, 30000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
