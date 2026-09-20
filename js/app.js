import { CHOICES, createInitialGame, publicRoundState, resolveAbility, resolveResult, setFinalChoice, startNextRound, playerSecretState } from "./game.js";
import { defaultRoleIds, getRole, ROLE_DEFINITIONS, roleName } from "./roles.js";
import { OnlineGame, normalizeCode, readSession } from "./online.js";
import { hasSupabaseConfig } from "./supabase.js";
import { button, choiceName, escapeHtml, holdRevealButton, page, playerLabel, revealedPeek, render, roleCard, roleToggleList, smallButton, tablePicker, toast } from "./ui.js";

const app = document.querySelector("#app");
const online = new OnlineGame();
let holdRevealActive = false;

const state = {
  mode: null,
  screen: "home",
  game: null,
  selectedRoleIds: defaultRoleIds(),
  offlineStep: { player: "p1", revealOpen: false, roleSeen: false },
  onlineSlot: null,
  onlinePresence: [],
  currentSecret: null
};

const routes = {
  home: renderHome,
  howto: renderHowto,
  roleGuide: renderRoleGuide,
  offlineNames: renderOfflineNames,
  onlineHome: renderOnlineHome,
  onlineCreate: renderOnlineCreate,
  onlineJoin: renderOnlineJoin,
  roleSelect: renderRoleSelect,
  reveal: renderReveal,
  ability: renderAbility,
  discussion: renderDiscussion,
  finalChoice: renderFinalChoice,
  result: renderResult
};

online.onChange((event) => {
  if (event.type === "presence") {
    state.onlinePresence = event.onlineIds;
    paint();
  }
  if (event.type === "room") {
    state.currentSecret = event.secret?.secret_state || null;
    syncOnlineRoom(event.room);
    paint();
  }
});

document.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  try {
    await handleAction(target.dataset.action, target);
  } catch (error) {
    toast(error.message || "うまく処理できませんでした。");
  }
});

document.addEventListener("pointerdown", (event) => {
  if (!event.target.closest("[data-hold-reveal]")) return;
  holdRevealActive = true;
  state.offlineStep.revealOpen = true;
  state.offlineStep.roleSeen = true;
  paint();
});

["pointerup", "pointercancel", "pointerleave"].forEach((eventName) => {
  document.addEventListener(eventName, () => {
    if (!holdRevealActive) return;
    holdRevealActive = false;
    state.offlineStep.revealOpen = false;
    paint();
  });
});

document.addEventListener("change", (event) => {
  if (event.target.name === "role") {
    state.selectedRoleIds = [...document.querySelectorAll('input[name="role"]:checked')].map((input) => input.value);
    const start = document.querySelector('[data-action="start-selected-roles"]');
    if (start) start.disabled = state.selectedRoleIds.length < 5;
  }
});

window.addEventListener("load", async () => {
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./service-worker.js").catch(() => null);
  if (hasSupabaseConfig() && readSession()) {
    try {
      const restored = await online.restoreSession();
      if (restored) {
        state.mode = "online";
        state.onlineSlot = restored.slot;
        syncOnlineRoom(restored.room);
        state.screen = restored.room.status === "waiting" || restored.room.status === "ready" ? "onlineCreate" : "reveal";
      }
    } catch {
      online.leaveLocalSession();
    }
  }
  paint();
});

function paint() {
  (routes[state.screen] || renderHome)();
}

async function handleAction(action) {
  const actions = {
    home: () => goHome(),
    howto: () => setScreen("howto"),
    "role-guide": () => setScreen("roleGuide"),
    offline: () => {
      state.mode = "offline";
      setScreen("offlineNames");
    },
    online: () => setScreen("onlineHome"),
    "online-create-screen": () => setScreen("onlineCreate"),
    "online-join-screen": () => setScreen("onlineJoin"),
    "room-lobby": () => setScreen("onlineCreate"),
    "resume-game": () => setScreen(currentOnlineGameScreen()),
    "create-room": createOnlineRoom,
    "join-room": joinOnlineRoom,
    "copy-code": copyCode,
    "go-role-select": () => {
      if (state.mode === "offline") {
        state.game = createInitialGame({
          mode: "offline",
          names: {
            p1: document.querySelector("#p1Name")?.value?.trim() || "プレイヤー1",
            p2: document.querySelector("#p2Name")?.value?.trim() || "プレイヤー2"
          },
          selectedRoleIds: state.selectedRoleIds
        });
      }
      setScreen("roleSelect");
    },
    "start-selected-roles": startSelectedRoles,
    "confirm-reveal": confirmReveal,
    "finish-ability": finishAbility,
    "start-final": () => setScreen("finalChoice"),
    handshake: () => chooseFinal(CHOICES.HANDSHAKE),
    protect: () => chooseFinal(CHOICES.PROTECT),
    "next-round": nextRound,
    "leave-online": async () => {
      await online.unsubscribe();
      online.leaveLocalSession();
      goHome();
    }
  };
  await actions[action]?.();
}

function setScreen(screen) {
  state.screen = screen;
  paint();
}

function goHome() {
  state.mode = null;
  state.game = null;
  state.onlineSlot = null;
  state.currentSecret = null;
  state.offlineStep = { player: "p1", revealOpen: false, roleSeen: false };
  setScreen("home");
}

function renderHome() {
  render(app, page("ふたりのほのぼの人狼", `
    <div class="panel">
      <p>1台でも、2台でも。相手を信じるか、そっとまもるかを選ぶ2人用ゲームです。</p>
      <div class="actions wide">
        ${button("オフラインで遊ぶ", "offline", "primary")}
        ${button("オンラインで遊ぶ", "online")}
        ${button("役職一覧", "role-guide")}
        ${button("遊び方", "howto")}
      </div>
    </div>
  `));
}

function renderHowto() {
  render(app, page("遊び方", `
    <div class="panel">
      <ol>
        <li>5枚の役職カードから、2人に1枚ずつ、場に3枚が配られます。</li>
        <li>自分の役職だけを確認し、能力を使います。</li>
        <li>実際に会話して、最後に「あくしゅ」か「まもる」を選びます。</li>
        <li>同じ陣営であくしゅ、または違う陣営を見抜いてまもると得点です。</li>
      </ol>
    </div>
  `, button("ホームへ", "home")));
}

function renderRoleGuide() {
  render(app, page("役職一覧", `<div class="role-list">${ROLE_DEFINITIONS.map((role) => roleCard(role.id, { showCamp: true })).join("")}</div>`, button("ホームへ", "home")));
}

function renderOfflineNames() {
  render(app, page("名前を決める", `
    <div class="panel">
      <label>プレイヤー1<input id="p1Name" type="text" value="プレイヤー1"></label>
      <label>プレイヤー2<input id="p2Name" type="text" value="プレイヤー2"></label>
      ${button("役職を選ぶ", "go-role-select", "primary")}
    </div>
  `, button("ホームへ", "home")));
}

function renderOnlineHome() {
  render(app, page("オンライン", `
    <div class="panel">
      <p>${hasSupabaseConfig() ? "Supabase設定を確認しました。" : "オンラインで遊ぶには js/supabase.js にSupabase URLとanon keyを設定してください。"}</p>
      <div class="actions">
        ${button("部屋を作る", "online-create-screen", "primary")}
        ${button("部屋に入る", "online-join-screen")}
      </div>
    </div>
  `, button("ホームへ", "home")));
}

function renderOnlineCreate() {
  if (!state.game && !online.room) {
    render(app, page("部屋を作る", `
      <div class="panel">
        <label>あなたの名前<input id="hostName" type="text" value="プレイヤー1"></label>
        <p class="muted">役職は次の画面で選びます。</p>
        ${button("ルームコードを発行", "create-room", "primary")}
      </div>
    `, button("戻る", "online")));
    return;
  }
  const room = online.room;
  const ready = Boolean(room?.guest_player_id);
  const inGame = isOnlineGameActive(room?.status);
  render(app, page("ルーム", `
    <div class="panel">
      <p>このコードを相手に伝えてください。</p>
      <strong class="code">${room?.code || "------"}</strong>
      ${smallButton("コピー", "copy-code")}
      <p><span class="status-dot ${ready ? "on" : ""}"></span>${ready ? "2人そろいました" : "相手を待っています"}</p>
      <p class="muted">接続中: ${state.onlinePresence.length}人</p>
      ${inGame ? `<p class="muted">現在の進行: ${phaseName(room.status)}</p>${button("ゲーム画面へ戻る", "resume-game", "primary")}` : ""}
      ${!inGame && state.onlineSlot === "p1" && ready ? button("役職を選ぶ", "go-role-select", "primary") : ""}
    </div>
  `, button("ホームへ戻る", "leave-online")));
}

function renderOnlineJoin() {
  render(app, page("部屋に入る", `
    <div class="panel">
      <label>ルームコード<input id="roomCode" inputmode="numeric" type="tel" maxlength="6" placeholder="381529"></label>
      <label>あなたの名前<input id="guestName" type="text" value="プレイヤー2"></label>
      ${button("参加する", "join-room", "primary")}
    </div>
  `, button("戻る", "online")));
}

function renderRoleSelect() {
  render(app, page("役職を選ぶ", `
    <div class="panel">
      <p>5種類以上をONにしてください。選んだ中から毎ラウンド5枚が使われます。</p>
    </div>
    <div class="role-list">${roleToggleList(state.selectedRoleIds)}</div>
  `, `${button("開始", "start-selected-roles", "primary")} ${button("ホームへ", "home")}`));
  const start = document.querySelector('[data-action="start-selected-roles"]');
  if (start) start.disabled = state.selectedRoleIds.length < 5;
}

function renderReveal() {
  const playerId = currentPlayerId();
  const secret = getVisibleSecret(playerId);
  const name = playerLabel(state.game?.names, playerId);
  const roleId = secret?.roleId;
  const open = state.mode === "online" || state.offlineStep.revealOpen;
  const revealControl = state.mode === "online"
    ? button("能力へ進む", "confirm-reveal", "primary")
    : open
      ? `<p class="muted">指を離すとカードは隠れます。</p>`
      : `${holdRevealButton()}${state.offlineStep.roleSeen ? button("覚えたので能力へ進む", "confirm-reveal", "primary") : ""}<p class="muted">オフラインでは、長押ししている間だけ役職を表示します。</p>`;
  render(app, page("役職確認", `
    <div class="panel">
      <h2>${escapeHtml(name)}だけが画面を見てください</h2>
      ${open && roleId ? roleCard(roleId, { showCamp: true }) : `<p class="muted">準備ができたら、自分だけで役職を開いてください。</p>`}
      ${revealControl}
    </div>
  `, onlineRoomFooter()));
}

function renderAbility() {
  const playerId = currentPlayerId();
  const secret = getVisibleSecret(playerId);
  const round = state.game.round;
  const role = getRole(secret?.roleId);
  const log = secret?.abilityLog || round.abilityLog[playerId];
  if (round.abilityDone[playerId] || log?.length) {
    const otherId = playerId === "p1" ? "p2" : "p1";
    const onlineWaiting = state.mode === "online" && !round.abilityDone[otherId];
    render(app, page("能力結果", `
      <div class="panel">
        ${roleCard(secret?.roleId, { showCamp: true })}
        ${revealedPeek(log)}
        ${onlineWaiting ? `<h2>相手の準備を待っています</h2><p class="muted">あなたのカード確認と能力は完了しました。相手も完了すると話し合いへ進みます。</p>` : button("話し合いへ", "finish-ability", "primary")}
      </div>
    `, onlineRoomFooter()));
    return;
  }
  const ability = role?.ability;
  let controls = `<p>${ability?.text || "能力はありません。"}</p>`;
  if (ability?.type === "peek_table") controls += tablePicker(round, ability.count);
  if (ability?.type === "swap_self_table") controls += tablePicker(round, 1) + smallButton("入れ替えない", "finish-ability");
  render(app, page("能力", `
    <div class="panel">
      ${roleCard(secret?.roleId, { showCamp: true })}
      ${controls}
      ${button("能力を使う", "finish-ability", "primary")}
    </div>
  `, onlineRoomFooter()));
}

function renderDiscussion() {
  const done = state.game.round.abilityDone;
  render(app, page("話し合い", `
    <div class="panel">
      <h2>話し合ってください</h2>
      <p>目安は3分です。オンラインでは通話や対面で会話してください。</p>
      <p class="muted">能力完了: ${done.p1 ? "P1 OK" : "P1 待ち"} / ${done.p2 ? "P2 OK" : "P2 待ち"}</p>
      ${done.p1 && done.p2 ? button("最終選択へ", "start-final", "primary") : ""}
    </div>
  `, onlineRoomFooter()));
}

function renderFinalChoice() {
  const playerId = currentPlayerId();
  const round = state.game.round;
  const own = round.choices[playerId];
  const otherId = playerId === "p1" ? "p2" : "p1";
  render(app, page("最終選択", `
    <div class="panel">
      <h2>${own ? `あなたは「${choiceName(own)}」を選びました` : "どちらにしますか？"}</h2>
      ${own ? `<p class="muted">相手の選択を待っています。</p>` : `<div class="grid-2">${button("あくしゅ", "handshake", "primary")}${button("まもる", "protect")}</div>`}
      <p class="muted">相手: ${round.choices[otherId] ? "選択済み" : "未選択"}</p>
    </div>
  `, onlineRoomFooter()));
  if (round.result) setTimeout(() => setScreen("result"), 150);
}

function renderResult() {
  const game = state.game;
  const round = game.round;
  const result = round.result;
  render(app, page("結果", `
    <div class="panel">
      <h2>${result.summary}</h2>
      <div class="result-row"><strong>${playerLabel(game.names, "p1")}</strong>${roleCard(round.roles.p1, { showCamp: true })}<p>選択: ${choiceName(round.choices.p1)} → 判定: ${choiceName(round.effectiveChoices.p1)} / +${result.playerDelta.p1}点</p></div>
      <div class="result-row"><strong>${playerLabel(game.names, "p2")}</strong>${roleCard(round.roles.p2, { showCamp: true })}<p>選択: ${choiceName(round.choices.p2)} → 判定: ${choiceName(round.effectiveChoices.p2)} / +${result.playerDelta.p2}点</p></div>
      <p><strong>累計</strong> ${game.scores.p1} - ${game.scores.p2}</p>
    </div>
  `, `${button("次のゲーム", "next-round", "primary")} ${onlineRoomFooter()} ${button("ホームへ", state.mode === "online" ? "leave-online" : "home")}`));
}

async function createOnlineRoom() {
  const name = document.querySelector("#hostName").value.trim() || "プレイヤー1";
  state.game = createInitialGame({ mode: "online", names: { p1: name, p2: "" }, selectedRoleIds: state.selectedRoleIds });
  const room = await online.createRoom(name, state.selectedRoleIds);
  state.onlineSlot = "p1";
  syncOnlineRoom(room);
  paint();
}

async function joinOnlineRoom() {
  const code = normalizeCode(document.querySelector("#roomCode").value);
  const name = document.querySelector("#guestName").value.trim() || "プレイヤー2";
  const { room, slot } = await online.joinRoom(code, name);
  state.onlineSlot = slot;
  syncOnlineRoom(room);
  state.screen = "onlineCreate";
  paint();
}

async function copyCode() {
  if (!online.room?.code) return;
  await navigator.clipboard.writeText(online.room.code);
  toast("ルームコードをコピーしました。");
}

async function startSelectedRoles() {
  if (state.selectedRoleIds.length < 5) throw new Error("役職は5種類以上選んでください。");
  if (state.mode === "offline") {
    const p1 = document.querySelector("#p1Name")?.value?.trim() || state.game?.names?.p1 || "プレイヤー1";
    const p2 = document.querySelector("#p2Name")?.value?.trim() || state.game?.names?.p2 || "プレイヤー2";
    state.game = createInitialGame({ mode: "offline", names: { p1, p2 }, selectedRoleIds: state.selectedRoleIds });
    state.game = startNextRound(state.game);
    state.offlineStep = { player: "p1", revealOpen: false, roleSeen: false };
    setScreen("reveal");
    return;
  }
  state.game.selectedRoleIds = state.selectedRoleIds;
  state.game = startNextRound(state.game);
  await publishOnlineRound("reveal");
  setScreen("reveal");
}

async function confirmReveal() {
  if (state.mode === "offline" && !state.offlineStep.roleSeen) {
    throw new Error("先に長押しで自分の役職を確認してください。");
  }
  state.offlineStep.revealOpen = false;
  setScreen("ability");
}

async function finishAbility() {
  const playerId = currentPlayerId();
  const indexes = [...document.querySelectorAll('input[name="tableIndex"]:checked')].map((input) => Number(input.value));
  if (!state.game.round.abilityDone[playerId]) {
    state.game.round = resolveAbility(state.game.round, playerId, { indexes, index: indexes[0] });
  }
  if (state.mode === "offline") {
    if (playerId === "p1") {
      state.offlineStep = { player: "p2", revealOpen: false, roleSeen: false };
      setScreen("reveal");
    } else {
      setScreen("discussion");
    }
    return;
  }
  const nextScreen = state.game.round.abilityDone.p1 && state.game.round.abilityDone.p2 ? "discussion" : "ability";
  await publishOnlineRound(nextScreen);
  setScreen(nextScreen);
}

async function chooseFinal(choice) {
  const playerId = currentPlayerId();
  state.game.round = setFinalChoice(state.game.round, playerId, choice);
  if (state.game.round.choices.p1 && state.game.round.choices.p2) state.game = resolveResult(state.game);
  if (state.mode === "online") await publishOnlineRound(state.game.round.result ? "result" : "finalChoice");
  setScreen(state.game.round.result ? "result" : "finalChoice");
}

async function nextRound() {
  state.game = startNextRound(state.game);
  state.offlineStep = { player: "p1", revealOpen: false, roleSeen: false };
  if (state.mode === "online") await publishOnlineRound("reveal");
  setScreen("reveal");
}

async function publishOnlineRound(screen) {
  const roomPatch = {
    status: screen,
    round_number: state.game.round.number,
    selected_role_ids: state.game.selectedRoleIds,
    player_names: state.game.names,
    public_state: publicRoundState(state.game.round),
    scores: state.game.scores
  };
  await online.updateRoom(roomPatch);
  await online.upsertSecret(state.onlineSlot, state.game.round.number, playerSecretState(state.game.round, state.onlineSlot));
  if (state.onlineSlot === "p1" && online.room?.guest_player_id) {
    await online.upsertSecret("p2", state.game.round.number, playerSecretState(state.game.round, "p2"), online.room.guest_player_id);
  }
}

function syncOnlineRoom(room) {
  const names = room.player_names || { p1: "プレイヤー1", p2: "プレイヤー2" };
  state.game = {
    mode: "online",
    names,
    selectedRoleIds: room.selected_role_ids || defaultRoleIds(),
    scores: room.scores || { p1: 0, p2: 0 },
    roundNumber: room.round_number || 0,
    round: hydrateRoomRound(room)
  };
  if (room.status && !["waiting", "ready"].includes(room.status)) state.screen = room.status;
}

function hydrateRoomRound(room) {
  const publicState = room.public_state || {};
  const result = publicState.result;
  return {
    number: publicState.number || room.round_number || 0,
    roles: result?.roles || publicState.roles || {},
    table: result?.table || publicState.table || [],
    abilityLog: publicState.abilityLog || { p1: [], p2: [] },
    abilityDone: publicState.abilityDone || { p1: false, p2: false },
    choices: {
      p1: null,
      p2: null,
      ...(publicState.choices || {}),
      ...(result?.choices || {})
    },
    effectiveChoices: result?.effectiveChoices || {},
    effectiveCamps: result?.effectiveCamps || {},
    result: result?.result || null
  };
}

function currentPlayerId() {
  if (state.mode === "online") return state.onlineSlot || "p1";
  return state.offlineStep.player;
}

function getVisibleSecret(playerId) {
  if (state.mode === "online") {
    return state.currentSecret || { roleId: state.game?.round?.roles?.[playerId], abilityLog: [] };
  }
  return {
    roleId: state.game.round.roles[playerId],
    abilityLog: state.game.round.abilityLog[playerId]
  };
}

function onlineRoomFooter() {
  return state.mode === "online" ? button("ルーム画面へ", "room-lobby") : "";
}

function isOnlineGameActive(status) {
  return ["reveal", "ability", "discussion", "finalChoice", "result"].includes(status);
}

function currentOnlineGameScreen() {
  const status = online.room?.status;
  return isOnlineGameActive(status) ? status : "onlineCreate";
}

function phaseName(status) {
  return {
    reveal: "役職確認",
    ability: "能力",
    discussion: "話し合い",
    finalChoice: "最終選択",
    result: "結果"
  }[status] || "待機中";
}
