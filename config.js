/*
  StreamHub V23 runtime configuration.
  The browser reads the Supabase Publishable key from Vercel's
  /api/config endpoint. No secret/service-role key belongs here.
*/
window.STREAMHUB_CONFIG = window.STREAMHUB_CONFIG || {
  SUPABASE_URL: "https://rrzglnazdppgjjtaswmd.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "",
  SUPABASE_ANON_KEY: ""
};

window.STREAMHUB_CONFIG_STATUS = "loading";

(async function loadRuntimeConfig() {
  try {
    const response = await fetch("/api/config", {
      method: "GET",
      cache: "no-store",
      headers: { "Accept": "application/json" }
    });

    if (response.ok) {
      const remote = await response.json();
      if (remote && remote.SUPABASE_URL) {
        window.STREAMHUB_CONFIG.SUPABASE_URL = remote.SUPABASE_URL;
      }
      if (remote && remote.SUPABASE_PUBLISHABLE_KEY) {
        window.STREAMHUB_CONFIG.SUPABASE_PUBLISHABLE_KEY = remote.SUPABASE_PUBLISHABLE_KEY;
      }
      if (remote && remote.SUPABASE_ANON_KEY) {
        window.STREAMHUB_CONFIG.SUPABASE_ANON_KEY = remote.SUPABASE_ANON_KEY;
      }
    }
  } catch (_) {
    // The public site must remain usable even when the optional API route is unavailable.
  }

  window.STREAMHUB_CONFIG_STATUS = "ready";
  window.dispatchEvent(new CustomEvent("streamhub-config-ready"));
})();
