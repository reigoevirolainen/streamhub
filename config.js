/*
  StreamHub V22 browser configuration.

  Preferred production setup:
  set SUPABASE_PUBLISHABLE_KEY in Vercel Environment Variables.
  /api/config.js will provide it to the browser at runtime.

  Local/static fallback: paste the Supabase Publishable key below.
  NEVER put a sb_secret_... key here.
*/
window.STREAMHUB_CONFIG = window.STREAMHUB_CONFIG || {
  SUPABASE_URL: "https://rrzglnazdppgjjtaswmd.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "",
  SUPABASE_ANON_KEY: ""
};

(async function loadRuntimeConfig() {
  try {
    const response = await fetch("/api/config", { cache: "no-store" });
    if (!response.ok) return;
    const remote = await response.json();
    if (remote?.SUPABASE_URL) window.STREAMHUB_CONFIG.SUPABASE_URL = remote.SUPABASE_URL;
    if (remote?.SUPABASE_PUBLISHABLE_KEY) window.STREAMHUB_CONFIG.SUPABASE_PUBLISHABLE_KEY = remote.SUPABASE_PUBLISHABLE_KEY;
    window.dispatchEvent(new CustomEvent("streamhub-config-ready"));
  } catch (_) {
    // Static hosting without /api/config is supported; local config.js can be used.
  }
})();
