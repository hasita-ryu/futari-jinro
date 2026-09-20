export const SUPABASE_CONFIG = {
  url: "https://bowdplkotjneatcrsfpy.supabase.co",
  anonKey: "sb_publishable_-lByPaCiZb8MC8WBlP1qDA_qrS-0DYL"
};

const AUTH_STORAGE_KEY = "honobono_werewolf_auth";

export function hasSupabaseConfig() {
  return Boolean(SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey);
}

const sessionStorageAdapter = {
  getItem(key) {
    return sessionStorage.getItem(key);
  },
  setItem(key, value) {
    sessionStorage.setItem(key, value);
  },
  removeItem(key) {
    sessionStorage.removeItem(key);
  }
};

export function createSupabaseClient() {
  if (!hasSupabaseConfig()) {
    throw new Error("SupabaseのURLとanon keyが未設定です。js/supabase.js を編集してください。");
  }
  if (!window.supabase) {
    throw new Error("Supabaseライブラリを読み込めませんでした。ネットワークを確認してください。");
  }
  return window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: AUTH_STORAGE_KEY,
      storage: sessionStorageAdapter
    },
    realtime: { params: { eventsPerSecond: 8 } }
  });
}

export async function ensureAnonymousUser(client) {
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError) throw new Error("参加者IDを確認できませんでした。ページを更新してもう一度お試しください。");
  if (sessionData?.session?.user?.id) return sessionData.session.user.id;

  const { data, error } = await client.auth.signInAnonymously();
  if (error) throw new Error("匿名ログインに失敗しました。SupabaseのAnonymous sign-insを有効にしてください。");
  if (!data?.user?.id) throw new Error("参加者IDを作成できませんでした。ページを更新してもう一度お試しください。");
  return data.user.id;
}

export async function clearAnonymousSession(client) {
  if (client) {
    await client.auth.signOut().catch(() => null);
  }
  sessionStorage.removeItem(AUTH_STORAGE_KEY);
}
