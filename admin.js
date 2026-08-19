"use strict";

const C = window.STREAMHUB_CONFIG || {};
const ADMIN_UID = "56a4036e-b37d-4928-abf2-8f49d709f5b7";
const EDGE_URL = (C.SUPABASE_URL) ? `${String(C.SUPABASE_URL).replace(/\/+$/, "")}/functions/v1/streamer-workflow` : "";

const db = (window.supabase && C.SUPABASE_URL && C.SUPABASE_PUBLISHABLE_KEY)
  ? window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    })
  : null;

const $ = s => document.querySelector(s);
let currentUser = null;
let currentStreamers = []; // Hoiab laetud striimereid mälus

// --- TEAVITUSED ---
function toast(msg, isError = false) {
    const t = $("#toast");
    if (!t) return;
    t.textContent = msg;
    t.className = `toast show ${isError ? "error" : ""}`;
    clearTimeout(window.__adminToast);
    window.__adminToast = setTimeout(() => t.className = "toast", 4000);
}

// --- KÄIVITAMINE ---
async function init() {
    if (!db) {
        toast("Andmebaasi ühendus puudub. Kontrolli, kas config.js on olemas.", true);
        return;
    }

    const { data: { session } } = await db.auth.getSession();
    currentUser = session?.user;

    if (currentUser && currentUser.id === ADMIN_UID) {
        showDashboard();
    } else {
        $("#loginScreen").classList.remove("hidden");
    }

    setupEvents();
}

// --- SÜNDMUSED ---
function setupEvents() {
    // Sisselogimine
    if ($("#adminLoginForm")) {
        $("#adminLoginForm").onsubmit = async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button');
            btn.textContent = "LOGIM SISSE...";
            btn.disabled = true;

            const email = e.target.email.value;
            const password = e.target.password.value;
            
            const { data, error } = await db.auth.signInWithPassword({ email, password });
            
            if (error) {
                btn.textContent = "LOGI SISSE";
                btn.disabled = false;
                return toast(error.message, true);
            }
            
            if (data.user.id !== ADMIN_UID) {
                await db.auth.signOut();
                btn.textContent = "LOGI SISSE";
                btn.disabled = false;
                return toast("See konto ei oma admini õigusi!", true);
            }

            currentUser = data.user;
            showDashboard();
        };
    }

    // Väljalogimine
    if ($("#logoutBtn")) {
        $("#logoutBtn").onclick = async () => {
            await db.auth.signOut();
            window.location.href = "/"; 
        };
    }

    // Tabide vahetus
    document.querySelectorAll(".nav-btn[data-tab]").forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
            document.querySelectorAll(".tab-content").forEach(t => t.classList.add("hidden"));
            
            btn.classList.add("active");
            $(`#tab-${btn.dataset.tab}`).classList.remove("hidden");
            
            loadTabData(btn.dataset.tab);
        };
    });

    // Striimeri andmete muutmise vormi salvestamine
    if ($("#editStreamerForm")) {
        $("#editStreamerForm").onsubmit = async (e) => {
            e.preventDefault();
            const id = $("#editId").value;
            const updates = {
                name: $("#editName").value.trim(),
                platform: $("#editPlatform").value,
                game: $("#editGame").value.trim() || null,
                channel_url: $("#editUrl").value.trim(),
                thumbnail_url: $("#editThumb").value.trim() || null,
                updated_at: new Date().toISOString()
            };

            toast("Salvestan andmeid...");
            const { error } = await db.from("streamers").update(updates).eq("id", id);
            
            if (error) return toast("Viga salvestamisel: " + error.message, true);
            
            toast("Muudatused edukalt salvestatud!");
            closeEditModal();
            fetchStreamers(); // Laeb nimekirja uuesti
        };
    }
}

function showDashboard() {
    $("#loginScreen").classList.add("hidden");
    $("#adminDashboard").classList.remove("hidden");
    loadTabData("streamers");
}

function loadTabData(tab) {
    if (tab === "streamers") fetchStreamers();
    if (tab === "applications") fetchApplications();
    if (tab === "logs") fetchLogs();
}

// ==========================================
// 1. STRIIMERID
// ==========================================
async function fetchStreamers() {
    const { data, error } = await db.from("streamers").select("*").order("name");
    if (error) return toast("Viga striimerite laadimisel: " + error.message, true);

    currentStreamers = data || []; // Salvestame andmed, et modaal saaks neid lugeda
    const container = $("#streamersList");
    
    if (!currentStreamers.length) {
        container.innerHTML = "Andmebaasis pole ühtegi striimerit.";
        return;
    }

    container.innerHTML = currentStreamers.map(s => `
        <div class="data-row">
            <div class="data-info">
                <strong>${s.name} ${s.is_live ? "🔴 LIVE" : "⚫ OFFLINE"}</strong>
                <span class="data-meta">${s.platform} | Mäng: ${s.game || "Määramata"}</span>
            </div>
            <div style="display: flex; gap: 8px;">
                <button class="action-btn" onclick="openEditModal('${s.id}')">Muuda</button>
                <button class="action-btn ${s.is_live ? "" : "success"}" onclick="toggleStatus('${s.id}', ${s.is_live})">
                    ${s.is_live ? "Tee Offline" : "Tee Online"}
                </button>
                <button class="action-btn danger" onclick="deleteStreamer('${s.id}')">Kustuta</button>
            </div>
        </div>
    `).join("");
}

// --- MODAALI JUHTIMINE ---
window.openEditModal = function(id) {
    const s = currentStreamers.find(x => x.id === id);
    if (!s) return;
    
    // Täidame lahtrid striimeri praeguste andmetega
    $("#editId").value = s.id;
    $("#editName").value = s.name || "";
    $("#editPlatform").value = s.platform || "Twitch";
    $("#editGame").value = s.game || "";
    $("#editUrl").value = s.channel_url || "";
    $("#editThumb").value = s.thumbnail_url || "";
    
    $("#editModal").style.display = "flex";
};

window.closeEditModal = function() {
    $("#editModal").style.display = "none";
};
// -------------------------

window.toggleStatus = async function(id, currentStatus) {
    toast("Muudan staatust...");
    const { error } = await db.from("streamers").update({ is_live: !currentStatus }).eq("id", id);
    
    if (error) return toast("Viga: " + error.message, true);

    await db.from("streamer_logs").insert({
        streamer_id: id,
        action: !currentStatus ? 'ADMIN_SET_ONLINE' : 'ADMIN_SET_OFFLINE'
    });

    toast("Staatus muudetud!");
    fetchStreamers();
};

window.deleteStreamer = async function(id) {
    if (!confirm("Oled sa kindel, et soovid selle striimeri andmebaasist lõplikult kustutada?")) return;
    const { error } = await db.from("streamers").delete().eq("id", id);
    
    if (error) return toast("Viga kustutamisel: " + error.message, true);
    
    toast("Striimer edukalt kustutatud!");
    fetchStreamers();
};

// ==========================================
// 2. TAOTLUSED
// ==========================================
async function fetchApplications() {
    const { data, error } = await db.from("streamer_applications").select("*").order("created_at", { ascending: false });
    if (error) return toast("Viga taotluste laadimisel: " + error.message, true);

    const container = $("#appsList");
    if (!data.length) {
        container.innerHTML = "Ühtegi taotlust ei leitud.";
        return;
    }

    container.innerHTML = data.map(a => `
        <div class="data-row">
            <div class="data-info">
                <strong>${a.name} (Staatus: ${a.status})</strong>
                <span class="data-meta">${a.email} | ${a.platform} | ${a.channel_url}</span>
            </div>
            ${a.status === 'pending' ? `
            <div>
                <button class="action-btn success" onclick="handleApp('${a.id}', 'approve')">Aksepteeri</button>
                <button class="action-btn danger" onclick="handleApp('${a.id}', 'reject')">Keeldu</button>
            </div>` : ""}
        </div>
    `).join("");
}

window.handleApp = async function(id, action) {
    toast(action === 'approve' ? "Kinnitan taotlust..." : "Lükkan taotlust tagasi...");
    const { data: { session } } = await db.auth.getSession();
    
    try {
        const res = await fetch(EDGE_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
            body: JSON.stringify({ action: action, application_id: id })
        });

        if (!res.ok) throw new Error("Viga Edge funktsiooniga suhtlemisel");
        
        toast("Toiming edukalt sooritatud!");
        fetchApplications();
    } catch (err) {
        toast(err.message, true);
    }
};

// ==========================================
// 3. LOGID & AJALUGU
// ==========================================
async function fetchLogs() {
    const { data, error } = await db.from("streamer_logs")
        .select("*, streamers(name)")
        .order("created_at", { ascending: false })
        .limit(100);
        
    if (error) return toast("Viga logide laadimisel: " + error.message, true);

    const container = $("#logsList");
    if (!data || !data.length) {
        container.innerHTML = "Logisid ei ole veel tekkinud.";
        return;
    }

    container.innerHTML = data.map(log => {
        const time = new Date(log.created_at).toLocaleString("et-EE");
        const streamerName = log.streamers?.name || "Tundmatu / Kustutatud";
        
        let actionColor = "var(--text-muted)";
        if (log.action.includes("ONLINE")) actionColor = "var(--success)";
        if (log.action.includes("OFFLINE")) actionColor = "var(--danger)";
        
        return `
        <div class="data-row">
            <div class="data-info">
                <strong>${streamerName}</strong>
                <span class="data-meta" style="color: ${actionColor}; font-weight: bold;">${log.action}</span>
            </div>
            <div class="data-meta">${time}</div>
        </div>
        `;
    }).join("");
}

document.addEventListener("DOMContentLoaded", init);