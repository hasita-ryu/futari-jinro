import { clearAnonymousSession, createSupabaseClient, ensureAnonymousUser, hasSupabaseConfig } from "./supabase.js";

const PLAYER_KEY = "honobono_werewolf_player_id";
const SESSION_KEY = "honobono_werewolf_online_session";

export function getOrCreatePlayerId() {
  return sessionStorage.getItem(PLAYER_KEY) || "";
}

export class OnlineGame {
  constructor() {
    const saved = readSession();
    this.client = null;
    this.roomChannel = null;
    this.presenceChannel = null;
    this.playerId = getOrCreatePlayerId();
    this.slot = saved?.slot || null;
    this.room = null;
    this.secret = null;
    this.listeners = new Set();
  }

  async ensureReady() {
    if (!hasSupabaseConfig()) {
      throw new Error("Supabase設定がまだ入っていません。READMEの手順でURLとanon keyを設定してください。");
    }
    if (!this.client) this.client = createSupabaseClient();
    const playerId = await ensureAnonymousUser(this.client);
    if (playerId !== this.playerId) {
      this.playerId = playerId;
      sessionStorage.setItem(PLAYER_KEY, playerId);
    }
  }

  async resetClientForFreshPlayer() {
    await this.unsubscribe();
    await clearAnonymousSession(this.client);
    this.client = createSupabaseClient();
    this.playerId = "";
    this.slot = null;
    this.room = null;
    this.secret = null;
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(PLAYER_KEY);
    await this.ensureReady();
  }

  onChange(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event) {
    this.listeners.forEach((listener) => listener(event));
  }

  async createRoom(playerName, selectedRoleIds) {
    await this.resetClientForFreshPlayer();
    const roomCode = await this.createUniqueCode();
    const now = new Date().toISOString();
    const room = {
      code: roomCode,
      host_player_id: this.playerId,
      guest_player_id: null,
      player_names: { p1: playerName || "プレイヤー1", p2: "" },
      selected_role_ids: selectedRoleIds,
      status: "waiting",
      round_number: 0,
      public_state: {},
      scores: { p1: 0, p2: 0 },
      updated_at: now
    };
    const { data, error } = await this.client.from("rooms").insert(room).select().single();
    if (error) throw friendlyError(error, "部屋を作れませんでした。");
    this.room = data;
    this.saveSession("p1", data.code);
    await this.subscribe(data.code);
    return data;
  }

  async joinRoom(code, playerName) {
    const cleanCode = normalizeCode(code);
    if (!/^\d{6}$/.test(cleanCode)) throw new Error("ルームコードは6桁の数字で入力してください。");

    await this.resetClientForFreshPlayer();
    const { data: room, error } = await this.client.from("rooms").select("*").eq("code", cleanCode).maybeSingle();
    if (error) throw friendlyError(error, "部屋を探せませんでした。");
    if (!room) throw new Error("そのルームコードの部屋が見つかりません。");

    if (room.host_player_id === this.playerId || room.guest_player_id === this.playerId) {
      const slot = room.host_player_id === this.playerId ? "p1" : "p2";
      this.room = room;
      this.saveSession(slot, cleanCode);
      await this.subscribe(cleanCode);
      return { room, slot };
    }
    if (room.guest_player_id && room.guest_player_id !== this.playerId) throw new Error("この部屋はすでに2人そろっています。");

    const names = { ...(room.player_names || {}), p2: playerName || "プレイヤー2" };
    const { data, error: updateError } = await this.client
      .from("rooms")
      .update({ guest_player_id: this.playerId, player_names: names, status: "ready", updated_at: new Date().toISOString() })
      .eq("code", cleanCode)
      .is("guest_player_id", null)
      .select()
      .single();

    if (updateError) throw friendlyError(updateError, "部屋に入れませんでした。");
    this.room = data;
    this.saveSession("p2", cleanCode);
    await this.subscribe(cleanCode);
    return { room: data, slot: "p2" };
  }

  async restoreSession() {
    const saved = readSession();
    if (!saved?.code) return null;
    await this.ensureReady();
    const { data, error } = await this.client.from("rooms").select("*").eq("code", saved.code).maybeSingle();
    if (error || !data) return null;
    if (data.host_player_id !== this.playerId && data.guest_player_id !== this.playerId) return null;
    this.room = data;
    this.slot = saved.slot;
    await this.fetchSecret();
    await this.subscribe(data.code);
    return { room: data, slot: saved.slot };
  }

  async updateRoom(patch, expectedUpdatedAt = null) {
    await this.ensureReady();
    if (!this.room?.code) throw new Error("部屋情報がありません。");
    let query = this.client
      .from("rooms")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("code", this.room.code);
    if (expectedUpdatedAt) query = query.eq("updated_at", expectedUpdatedAt);
    const { data, error } = await query.select().maybeSingle();
    if (error) throw friendlyError(error, "部屋の情報を更新できませんでした。");
    if (!data) return null;
    this.room = data;
    return data;
  }

  async fetchRoom() {
    await this.ensureReady();
    if (!this.room?.code) throw new Error("部屋情報がありません。");
    const { data, error } = await this.client.from("rooms").select("*").eq("code", this.room.code).single();
    if (error) throw friendlyError(error, "部屋の情報を取得できませんでした。");
    this.room = data;
    return data;
  }

  async upsertSecret(slot, roundNumber, secretState, targetPlayerId = this.playerId) {
    await this.ensureReady();
    if (!this.room?.code) throw new Error("部屋情報がありません。");
    const row = {
      room_code: this.room.code,
      player_id: targetPlayerId,
      slot,
      round_number: roundNumber,
      secret_state: secretState,
      updated_at: new Date().toISOString()
    };
    const { error } = await this.client.from("player_secrets").upsert(row, { onConflict: "room_code,player_id,round_number" });
    if (error) throw friendlyError(error, "自分用のカード情報を保存できませんでした。");
    if (targetPlayerId === this.playerId) this.secret = row;
    return row;
  }

  async fetchSecret() {
    await this.ensureReady();
    if (!this.room) return null;
    const query = this.client
      .from("player_secrets")
      .select("*")
      .eq("room_code", this.room.code)
      .eq("round_number", this.room.round_number)
      .order("updated_at", { ascending: false })
      .limit(1);
    const { data, error } = await (this.slot ? query.eq("slot", this.slot) : query.eq("player_id", this.playerId)).maybeSingle();
    if (error) throw friendlyError(error, "自分用のカード情報を取得できませんでした。");
    this.secret = data;
    return data;
  }

  async subscribe(code) {
    await this.ensureReady();
    await this.unsubscribe();

    this.roomChannel = this.client
      .channel(`room:${code}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rooms", filter: `code=eq.${code}` },
        async (payload) => {
          this.room = payload.new;
          await this.fetchSecret().catch(() => null);
          this.emit({ type: "room", room: this.room, secret: this.secret });
        }
      )
      .subscribe();

    this.presenceChannel = this.client.channel(`presence:${code}`, { config: { presence: { key: this.playerId } } });
    this.presenceChannel
      .on("presence", { event: "sync" }, async () => {
        const state = this.presenceChannel.presenceState();
        this.emit({ type: "presence", onlineIds: Object.keys(state) });
        const latestRoom = await this.fetchRoom().catch(() => null);
        if (latestRoom) {
          await this.fetchSecret().catch(() => null);
          this.emit({ type: "room", room: latestRoom, secret: this.secret });
        }
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await this.presenceChannel.track({ player_id: this.playerId, online_at: new Date().toISOString() });
        }
      });
  }

  async unsubscribe() {
    if (this.roomChannel) await this.client.removeChannel(this.roomChannel);
    if (this.presenceChannel) await this.client.removeChannel(this.presenceChannel);
    this.roomChannel = null;
    this.presenceChannel = null;
  }

  leaveLocalSession() {
    sessionStorage.removeItem(SESSION_KEY);
    this.slot = null;
    this.room = null;
    this.secret = null;
  }

  saveSession(slot, code) {
    this.slot = slot;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ slot, code, playerId: this.playerId }));
  }

  async createUniqueCode() {
    for (let i = 0; i < 10; i += 1) {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const { data, error } = await this.client.from("rooms").select("code").eq("code", code).maybeSingle();
      if (error) throw friendlyError(error, "ルームコードを作れませんでした。");
      if (!data) return code;
    }
    throw new Error("ルームコードの作成に失敗しました。もう一度お試しください。");
  }
}

export function readSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

export function normalizeCode(code) {
  return String(code || "").replace(/\D/g, "").slice(0, 6);
}

function friendlyError(error, fallback) {
  if (!error) return new Error(fallback);
  if (error.message?.includes("row-level security")) return new Error("参加権限を確認できませんでした。ページを更新してもう一度お試しください。");
  if (error.code === "23505") return new Error("同じ情報がすでに登録されています。ページを更新して続きから戻ってください。");
  return new Error(fallback);
}
