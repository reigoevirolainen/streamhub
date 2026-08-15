// StreamHub V10 - Supabase Edge Function
// Deploy: supabase functions deploy sync-streamers
//
// Secrets:
// TWITCH_CLIENT_ID
// TWITCH_CLIENT_SECRET
// YOUTUBE_API_KEY
//
// The function never marks a streamer LIVE based on guesswork.
// Unsupported platforms receive a clear sync_error instead of fake LIVE data.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(supabaseUrl, serviceKey);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function twitchLogin(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.replace(/^www\./, "").endsWith("twitch.tv")) return null;
    return u.pathname.split("/").filter(Boolean)[0] ?? null;
  } catch { return null; }
}

function youtubeChannelId(url: string): string | null {
  try {
    const u = new URL(url);
    const p = u.pathname.split("/").filter(Boolean);
    if (p[0] === "channel" && p[1]) return p[1];
    return null;
  } catch { return null; }
}

async function twitchToken() {
  const id = Deno.env.get("TWITCH_CLIENT_ID");
  const secret = Deno.env.get("TWITCH_CLIENT_SECRET");
  if (!id || !secret) throw new Error("Twitch API secrets puuduvad");
  const r = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${encodeURIComponent(id)}&client_secret=${encodeURIComponent(secret)}&grant_type=client_credentials`, { method: "POST" });
  if (!r.ok) throw new Error(`Twitch token HTTP ${r.status}`);
  return { token: (await r.json()).access_token, id };
}

async function syncTwitch(s: any) {
  const login = twitchLogin(s.channel_url);
  if (!login) throw new Error("Twitch kanali URL ei ole korrektne");
  const auth = await twitchToken();
  const r = await fetch(`https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(login)}`, {
    headers: { "Client-ID": auth.id, "Authorization": `Bearer ${auth.token}` }
  });
  if (!r.ok) throw new Error(`Twitch streams HTTP ${r.status}`);
  const data = await r.json();
  const stream = data.data?.[0];
  if (!stream) return { is_live:false, viewers:0, game:null, thumbnail:null, live_video_id:null, error:null };
  return {
    is_live:true,
    viewers:Number(stream.viewer_count || 0),
    game:stream.game_name || null,
    thumbnail:String(stream.thumbnail_url || "").replace("{width}","640").replace("{height}","360"),
    live_video_id:String(stream.id || ""),
    error:null
  };
}

async function syncYouTube(s: any) {
  const key = Deno.env.get("YOUTUBE_API_KEY");
  if (!key) throw new Error("YouTube API key puudub");
  const channelId = youtubeChannelId(s.channel_url);
  if (!channelId) throw new Error("YouTube jaoks kasuta /channel/UC... URL-i või lisa hiljem channel_id väli");
  const q = new URL("https://www.googleapis.com/youtube/v3/search");
  q.searchParams.set("part","snippet");
  q.searchParams.set("channelId",channelId);
  q.searchParams.set("eventType","live");
  q.searchParams.set("type","video");
  q.searchParams.set("maxResults","1");
  q.searchParams.set("key",key);
  const r = await fetch(q);
  if (!r.ok) throw new Error(`YouTube search HTTP ${r.status}`);
  const d = await r.json();
  const v = d.items?.[0];
  if (!v) return { is_live:false, viewers:0, game:null, thumbnail:null, live_video_id:null, error:null };
  const id = v.id.videoId;
  const q2 = new URL("https://www.googleapis.com/youtube/v3/videos");
  q2.searchParams.set("part","snippet,liveStreamingDetails");
  q2.searchParams.set("id",id);
  q2.searchParams.set("key",key);
  const r2 = await fetch(q2);
  if (!r2.ok) throw new Error(`YouTube videos HTTP ${r2.status}`);
  const d2 = await r2.json();
  const item = d2.items?.[0];
  const details = item?.liveStreamingDetails;
  if (!item || !details || !details.concurrentViewers) return { is_live:false, viewers:0, game:null, thumbnail:null, live_video_id:null, error:null };
  return {
    is_live:true,
    viewers:Number(details.concurrentViewers || 0),
    game:item.snippet?.title || null,
    thumbnail:item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url || null,
    live_video_id:id,
    error:null
  };
}

Deno.serve(async (req) => {
  if (req.method !== "POST" && req.method !== "GET") return json({error:"Method not allowed"},405);

  const { data: streamers, error: readError } = await db.from("streamers").select("*");
  if (readError) return json({error:readError.message},500);

  const results = [];
  for (const s of streamers || []) {
    let result;
    try {
      if (s.platform === "Twitch") result = await syncTwitch(s);
      else if (s.platform === "YouTube") result = await syncYouTube(s);
      else result = {
        is_live: false,
        viewers: 0,
        game: null,
        thumbnail: null,
        live_video_id: null,
        error: `${s.platform}: automaatne API kontroll ei ole V10-s veel ühendatud`
      };

      const { error } = await db.rpc("sync_streamer_status", {
        p_id:s.id,
        p_is_live:result.is_live,
        p_viewers:result.viewers,
        p_game:result.game,
        p_thumbnail_url:result.thumbnail,
        p_live_video_id:result.live_video_id,
        p_error:result.error
      });
      results.push({id:s.id,name:s.name,ok:!error,error:error?.message||result.error||null,is_live:result.is_live,viewers:result.viewers});
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await db.rpc("sync_streamer_status", {
        p_id:s.id,p_is_live:false,p_viewers:0,p_game:null,p_thumbnail_url:null,p_live_video_id:null,p_error:message
      });
      results.push({id:s.id,name:s.name,ok:false,error:message,is_live:false,viewers:0});
    }
  }

  return json({ok:true,checked:results.length,results});
});
