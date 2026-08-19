"use strict";

// SISSESTA SIIA OMA SUPABASE ANDMED (Samad, mis app.js failis)
const SUPABASE_URL = "https://SINU-PROJEKTI-ID.supabase.co"; 
const SUPABASE_KEY = "SINU-ANON-KEY";
const ADMIN_UID = "56a4036e-b37d-4928-abf2-8f49d709f5b7";
const EDGE_URL = `${SUPABASE_URL}/functions/v1/streamer-workflow`;

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = s => document.querySelector(s);

let currentUser = null;

// Teavitused
function toast(msg, isError = false) {
    const t = $("#toast");
    t.textContent = msg;
    t.className = `toast show ${isError ? "error" : ""}`;
    setTimeout(() => t.className = "toast", 3000);
}

// Käivitamine
async function init() {
    const { data: { session } } = await db.auth.getSession();
    currentUser = session?.user;

    if (currentUser && currentUser.id === ADMIN_UID) {
        showDashboard();
    } else {
        $("#loginScreen").classList.remove("hidden");
    }

    setupEvents();
}

// Sündmused
function setupEvents() {
    // Sisselogimine
    $("#adminLoginForm").onsubmit = async (e) => {
        e.preventDefault();
        const email = e.target.email.value;
        const password = e.target.password.value;
        
        const { data, error } = await db.auth.signInWithPassword({ email, password });
        if (error) return toast(error.message, true);
        
        if (data.user.id !== ADMIN_UID) {
            await db.auth.signOut();
            return toast("Sul puuduvad admini õigused!", true);
        }

        currentUser = data.user;
        showDashboard();
    };

    // Väljalogimine
    $("#logoutBtn").onclick = async () => {
        await db.auth.signOut();
        location.reload();
    };

    // Tabi vahetus
    document.querySelectorAll(".nav-btn[data-tab]").forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
            document.querySelectorAll(".tab-content").forEach(t => t.classList.add("hidden"));
            
            btn.classList.add("active");
            $(`#tab-${btn.dataset.tab}`).classList.remove("hidden");
            
            loadTabData(btn.dataset.tab);
        };
    });
}

function showDashboard() {
    $("#loginScreen").classList.add("hidden");
    $("#adminDashboard").classList.remove("hidden");
    loadTabData("streamers"); // Lae esimene tab
}

// Andmete laadimine vastavalt tabile
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
    if (error) return toast("Viga: " + error.message, true);

    const container = $("#streamersList");
    if (!data.length) return container.innerHTML = "Striimereid pole.";

    container.innerHTML = data.map(s => `
        <div class="data-row">
            <div class="data-info">
                <strong>${s.name} ${s.is_live ? "🔴 LIVE" : "⚫ OFFLINE"}</strong>
                <span class="data-meta">${s.platform} | Mäng: ${s.game || "Puudub"}</span>
            </div>
            <div>
                <button class="action-btn ${s.is_live ? "" : "success"}" onclick="toggleStatus('${s.id}', ${s.is_live})">
                    ${s.is_live ? "Tee Offline" : "Tee Online"}
                </button>
                <button class="action-btn danger" onclick="deleteStreamer('${s.id}')">Kustuta</button>
            </div>
        </div>
    `).join("");
}

async function toggleStatus(id, currentStatus) {
    // 1. Muuda staatus
    await db.from("streamers").update({ is_live: !currentStatus }).eq("id", id);
    
    // 2. Salvesta Logi
    await db.from("streamer_logs").insert({
        streamer_id: id,
        action: !currentStatus ? 'ADMIN_SET_ONLINE' : 'ADMIN_SET_OFFLINE'
    });

    toast("Staatus muudetud!");
    fetchStreamers();
}

async function deleteStreamer(id) {
    if (!confirm("Oled kindel, et tahad striimerit kustutada?")) return;
    await db.from("streamers").delete().eq("id", id);
    toast("Kustutatud!");
    fetchStreamers();
}

// ==========================================
// 2. TAOTLUSED
// ==========================================
async function fetchApplications() {
    const { data, error } = await db.from("streamer_applications").select("*").order("created_at", { ascending: false });
    if (error) return toast("Viga: " + error.message, true);

    const container = $("#appsList");
    if (!data.length) return container.innerHTML = "Taotlusi pole.";

    container.innerHTML = data.map(a => `
        <div class="data-row">
            <div class="data-info">
                <strong>${a.name} (${a.status})</strong>
                <span class="data-meta">${a.email} | ${a.platform} | ${a.channel_url}</span>
            </div>
            ${a.status === 'pending' ? `
            <div>
                <button class="action-btn success" onclick="handleApp('${a.id}', 'approve')">Kinnita</button>
                <button class="action-btn danger" onclick="handleApp('${a.id}', 'reject')">Keeldu</button>
            </div>` : ""}
        </div>
    `).join("");
}

async function handleApp(id, action) {
    toast("Töötlen...");
    const { data: { session } } = await db.auth.getSession();
    
    const res = await fetch(EDGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: action, application_id: id })
    });

    if (!res.ok) return toast("Viga Edge funktsiooniga", true);
    toast("Edukalt tehtud!");
    fetchApplications();
}

// ==========================================
// 3. LOGID & AJALUGU
// ==========================================
async function fetchLogs() {
    // Teeb join päringu streamer_logs ja streamers tabelite vahel, et näha striimeri nime
    const { data, error } = await db.from("streamer_logs")
        .select("*, streamers(name)")
        .order("created_at", { ascending: false })
        .limit(50);
        
    if (error) return toast("Viga: " + error.message, true);

    const container = $("#logsList");
    if (!data.length) return container.innerHTML = "Logisid pole veel tekkinud.";

    container.innerHTML = data.map(log => {
        const time = new Date(log.created_at).toLocaleString("et-EE");
        const streamerName = log.streamers?.name || "Tundmatu/Kustutatud striimer";
        
        return `
        <div class="data-row">
            <div class="data-info">
                <strong>${streamerName}</strong>
                <span class="data-meta">${log.action}</span>
            </div>
            <div class="data-meta">${time}</div>
        </div>
        `;
    }).join("");
}

// Käivita süsteem, kui leht laeb
document.addEventListener("DOMContentLoaded", init);