export const SUPABASE_CONFIG = {
  url: "https://bowdplkotjneatcrsfpy.supabase.co",
  anonKey: "sb_publishable_-lByPaCiZb8MC8WBlP1qDA_qrS-0DYL"
};

export function hasSupabaseConfig() {
  return Boolean(SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey);
}

export function createSupabaseClient() {
  if (!hasSupabaseConfig()) {
    throw new Error("SupabaseのURLとanon keyが未設定です。js/supabase.js を編集してください。");
  }
  if (!window.supabase) {
    throw new Error("Supabaseライブラリを読み込めませんでした。ネットワークを確認してください。");
  }
  return window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
    global: {
      headers: {
        "x-player-id": localStorage.getItem("honobono_werewolf_player_id") || ""
      }
    },
    auth: { persistSession: false },
    realtime: { params: { eventsPerSecond: 8 } }
  });
}
