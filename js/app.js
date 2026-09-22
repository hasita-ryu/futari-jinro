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
  onlineRevealConfirmed: false,
  resultRolesRevealed: false,
  pendingFinalChoice: null,
  resultStep: "closed",
  discussionUnlockAt: 0,
  lastRoundNumber: 0,
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

const PREPARE_STATUS = "prepare";

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
  document.body.dataset.scene = sceneForScreen(state.screen);
  (routes[state.screen] || renderHome)();
}

function sceneForScreen(screen) {
  if (screen === "reveal" || screen === "ability") return "night";
  if (screen === "discussion" || screen === "finalChoice") return "day";
  if (screen === "result") return state.resultStep === "score" ? "morning" : "day";
  return "morning";
}

async function handleAction(action) {
  const actions = {
    home: () => resetToHome(),
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
    "ability-screen": () => setScreen("ability"),
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
    "start-discussion": startDiscussion,
    "start-final": startFinalChoice,
    handshake: () => selectFinalChoice(CHOICES.HANDSHAKE),
    protect: () => selectFinalChoice(CHOICES.PROTECT),
    "confirm-final": confirmFinalChoice,
    "open-result": openResultCards,
    "show-score": showScoreBoard,
    "next-round": nextRound,
    "leave-online": async () => {
      await resetToHome();
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
  state.onlineRevealConfirmed = false;
  state.resultRolesRevealed = false;
  state.pendingFinalChoice = null;
  state.resultStep = "closed";
  state.discussionUnlockAt = 0;
  state.lastRoundNumber = 0;
  state.offlineStep = { player: "p1", revealOpen: false, roleSeen: false };
  setScreen("home");
}

async function resetToHome() {
  if (isOnlineSession()) {
    await online.unsubscribe();
    online.leaveLocalSession();
  }
  goHome();
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
  const host = isHost();
  render(app, page("ルーム", `
    <div class="panel">
      <p>このコードを相手に伝えてください。</p>
      <strong class="code">${room?.code || "------"}</strong>
      ${smallButton("コピー", "copy-code")}
      <p><span class="status-dot ${ready ? "on" : ""}"></span>${ready ? "2人そろいました" : "相手を待っています"}</p>
      <p class="muted">接続中: ${state.onlinePresence.length}人</p>
      ${inGame ? `<p class="muted">現在の進行: ${phaseName(room.status)}</p>${button("ゲーム画面へ戻る", "resume-game", "primary")}` : ""}
      ${!inGame && host && ready ? button("役職を選ぶ", "go-role-select", "primary") : ""}
      ${!inGame && !host && ready ? `<p class="muted">1Pが役職を選んで開始します。</p>` : ""}
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
  if (!playerId) {
    renderPlayerResolving();
    return;
  }
  const secret = getVisibleSecret(playerId);
  if (state.mode === "online" && !secret?.roleId) {
    renderSecretWaiting();
    return;
  }
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
      ${onlineRoomNav()}
    </div>
  `));
}

function renderAbility() {
  const playerId = currentPlayerId();
  if (!playerId) {
    renderPlayerResolving();
    return;
  }
  const secret = getVisibleSecret(playerId);
  if (state.mode === "online" && !secret?.roleId) {
    renderSecretWaiting();
    return;
  }
  const round = state.game.round;
  const role = getRole(secret?.roleId);
  const log = secret?.abilityLog || round.abilityLog[playerId];
  if (round.abilityDone[playerId] || log?.length) {
    const allOnlineDone = state.mode === "online" && round.abilityDone.p1 && round.abilityDone.p2;
    const abilityDoneAction = state.mode === "online"
      ? allOnlineDone
        ? isHost()
          ? button("話し合いへ進む", "start-discussion", "primary")
          : `<h2>1Pを待っています</h2><p class="muted">2人とも能力は完了しました。1Pが話し合いへ進めます。</p>`
        : `<h2>相手の準備を待っています</h2><p class="muted">あなたのカード確認と能力は完了しました。相手も完了するまで待ちます。</p>`
      : button("完了", "finish-ability", "primary");
    render(app, page("能力結果", `
      <div class="panel">
        ${roleCard(secret?.roleId, { showCamp: true })}
        ${revealedPeek(log)}
        ${abilityDoneAction}
        ${onlineRoomNav()}
      </div>
    `));
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
      ${onlineRoomNav()}
    </div>
  `));
}

function renderDiscussion() {
  const done = state.game.round.abilityDone;
  const onlineIncomplete = isOnlineSession() && (!done.p1 || !done.p2);
  const locked = Date.now() < state.discussionUnlockAt;
  const canHostAdvance = (state.mode !== "online" || isHost()) && !onlineIncomplete && !locked;
  if (locked) setTimeout(paint, Math.min(1000, state.discussionUnlockAt - Date.now()));
  render(app, page("話し合い", `
    <div class="panel">
      <h2>話し合ってください</h2>
      <p>目安は3分です。オンラインでは通話や対面で会話してください。</p>
      <p class="muted">能力完了: ${done.p1 ? "P1 OK" : "P1 待ち"} / ${done.p2 ? "P2 OK" : "P2 待ち"}</p>
      <div class="used-card-strip">
        <strong>このラウンドのカード</strong>
        <div>${usedRoundCards(state.game.round).map((id) => `<span>${roleName(id)}</span>`).join("")}</div>
      </div>
      ${onlineIncomplete ? `<p class="muted">まだ全員の能力が終わっていません。終わっていない人は能力画面に戻ってください。</p>${button("能力画面へ戻る", "ability-screen", "primary")}` : ""}
      ${isHost() && !onlineIncomplete && locked ? `<button class="btn primary" type="button" disabled>少し話してから進む</button>` : ""}
      ${canHostAdvance ? button("最終選択へ進む", "start-final", "primary") : ""}
      ${isOnlineSession() && !isHost() && !onlineIncomplete ? `<p class="muted">1Pが最終選択へ進めます。</p>` : ""}
      ${onlineRoomNav()}
    </div>
  `));
}

function renderFinalChoice() {
  const playerId = currentPlayerId();
  if (!playerId) {
    renderPlayerResolving();
    return;
  }
  const round = state.game.round;
  const own = round.choices[playerId];
  const otherId = playerId === "p1" ? "p2" : "p1";
  if (round.result) {
    if (state.resultStep !== "revealed" && state.resultStep !== "score") state.resultStep = "closed";
    setTimeout(() => setScreen("result"), 100);
  }
  const pending = own || state.pendingFinalChoice;
  render(app, page("あくしゅの時間", `
    <div class="panel">
      <h2>${own ? `あなたは「${choiceName(own)}」で確定しました` : "カードを選んでOKしてください"}</h2>
      <p>相手と握手するか、自分をまもるかを決めましょう。</p>
      <div class="final-choice-grid">
        ${choiceCard(CHOICES.PROTECT, pending === CHOICES.PROTECT, own)}
        ${choiceCard(CHOICES.HANDSHAKE, pending === CHOICES.HANDSHAKE, own)}
      </div>
      ${own
        ? `<p class="muted">相手の選択を待っています。</p>`
        : `<button class="btn primary mega-action" data-action="confirm-final" type="button" ${pending ? "" : "disabled"}>OK</button>`}
      <p class="muted">相手: ${round.choices[otherId] ? "選択済み" : "未選択"}</p>
      ${onlineRoomNav()}
    </div>
  `));
}

function renderResult() {
  const game = state.game;
  const round = game.round;
  const result = round.result;
  if (!result) return setScreen("finalChoice");
  if (state.resultStep === "score") {
    render(app, page("得点", `
      <div class="score-ticket">
        <h2>第${round.number}ゲーム終了</h2>
        <div class="score-showdown">
          <div>
            <small>${escapeHtml(playerLabel(game.names, "p1"))}</small>
            <strong>${game.scores.p1}</strong>
            <span>ポイント</span>
          </div>
          <b>VS</b>
          <div>
            <small>${escapeHtml(playerLabel(game.names, "p2"))}</small>
            <strong>${game.scores.p2}</strong>
            <span>ポイント</span>
          </div>
        </div>
        <p class="next-call">さあ次のゲームへ！</p>
      </div>
      ${onlineRoomNav()}
    `, `${isOnlineSession() ? (isHost() ? button("次のゲーム", "next-round", "primary") : `<div class="panel"><p class="muted">1Pが次のゲームを開始します。</p></div>`) : button("次のゲーム", "next-round", "primary")} ${button("ホームへ", state.mode === "online" ? "leave-online" : "home")}`));
    return;
  }
  const revealed = state.resultStep === "revealed";
  render(app, page("結果", `
    <div class="result-stage">
      <div class="result-title">
        <span class="pill">第${round.number}ゲーム</span>
        <h2>結果発表</h2>
      </div>
      <div class="result-columns">
        ${resultPlayerColumn(game, round, result, "p1", revealed)}
        <div class="result-cross">×</div>
        ${resultPlayerColumn(game, round, result, "p2", revealed)}
      </div>
      ${revealed ? `<div class="result-summary">${escapeHtml(result.summary)}</div>` : ""}
    </div>
    ${onlineRoomNav()}
  `, resultFooter(revealed)));
}

function resultFooter(revealed) {
  if (state.mode !== "online") {
    return revealed ? button("OK", "show-score", "primary mega-action") : button("OPEN", "open-result", "primary mega-action");
  }
  if (isHost()) {
    return revealed ? button("OK", "show-score", "primary mega-action") : button("OPEN", "open-result", "primary mega-action");
  }
  return `<div class="panel"><p class="muted">${revealed ? "1Pが得点画面へ進めます。" : "1PがOPENします。"}</p></div>`;
}

function choiceCard(choice, selected, locked) {
  const action = choice === CHOICES.HANDSHAKE ? "handshake" : "protect";
  return `
    <button class="choice-card ${choice} ${selected ? "selected" : ""}" data-action="${action}" type="button" ${locked ? "disabled" : ""}>
      <span class="choice-art"><img src="assets/actions/${action}.png" alt="${choiceName(choice)}"></span>
      <strong>${choiceName(choice)}</strong>
    </button>
  `;
}

function resultPlayerColumn(game, round, result, playerId, revealed) {
  const delta = result.playerDelta[playerId] || 0;
  return `
    <article class="result-player">
      <h3>${escapeHtml(playerLabel(game.names, playerId))}</h3>
      <div class="action-reveal ${round.choices[playerId]}">
        <span><img src="assets/actions/${round.choices[playerId] === CHOICES.HANDSHAKE ? "handshake" : "protect"}.png" alt="${choiceName(round.choices[playerId])}"></span>
        <strong>${choiceName(round.choices[playerId])}</strong>
      </div>
      <div class="result-role-slot">
        ${revealed ? roleCard(round.roles[playerId], { showCamp: true }) : `<div class="role-back"><span>?</span></div>`}
      </div>
      ${revealed ? `<strong class="point-pop ${delta > 0 ? "win" : ""}">${delta}ポイント${delta > 0 ? "!" : ""}</strong>` : ""}
    </article>
  `;
}

function usedRoundCards(round) {
  return [round.roles.p1, round.roles.p2, ...round.table.map((card) => card.roleId)].filter(Boolean);
}

async function createOnlineRoom() {
  const name = document.querySelector("#hostName").value.trim() || "プレイヤー1";
  state.mode = "online";
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
  state.mode = "online";
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
  if (state.mode === "online" && !isHost()) throw new Error("オンラインでは1Pがゲームを開始します。");
  if (state.mode === "offline") {
    const p1 = document.querySelector("#p1Name")?.value?.trim() || state.game?.names?.p1 || "プレイヤー1";
    const p2 = document.querySelector("#p2Name")?.value?.trim() || state.game?.names?.p2 || "プレイヤー2";
    state.game = createInitialGame({ mode: "offline", names: { p1, p2 }, selectedRoleIds: state.selectedRoleIds });
    state.game = startNextRound(state.game);
    state.offlineStep = { player: "p1", revealOpen: false, roleSeen: false };
    state.pendingFinalChoice = null;
    state.resultStep = "closed";
    setScreen("reveal");
    return;
  }
  state.game.selectedRoleIds = state.selectedRoleIds;
  state.game = startNextRound(state.game);
  state.onlineRevealConfirmed = false;
  state.resultRolesRevealed = false;
  state.pendingFinalChoice = null;
  state.resultStep = "closed";
  state.lastRoundNumber = state.game.round.number;
  await publishOnlineRound(PREPARE_STATUS);
  setScreen("reveal");
}

async function confirmReveal() {
  if (state.mode === "offline" && !state.offlineStep.roleSeen) {
    throw new Error("先に長押しで自分の役職を確認してください。");
  }
  if (state.mode === "online") state.onlineRevealConfirmed = true;
  state.offlineStep.revealOpen = false;
  setScreen("ability");
}

async function finishAbility() {
  const playerId = currentPlayerId();
  if (!playerId) throw new Error("プレイヤー情報を確認中です。少し待ってからもう一度お試しください。");
  let indexes = [...document.querySelectorAll('input[name="tableIndex"]:checked')].map((input) => Number(input.value));
  const role = getRole(state.game.round.roles[playerId]);
  if (!indexes.length && role?.ability?.type === "peek_table") {
    indexes = state.game.round.table.slice(0, role.ability.count).map((card) => card.index);
  }
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
  await publishOnlineRound(PREPARE_STATUS);
  setScreen("ability");
}

async function startDiscussion() {
  if (state.mode !== "online") {
    setScreen("discussion");
    return;
  }
  if (!isHost()) throw new Error("話し合いへ進めるのは1Pです。");
  if (Date.now() < state.discussionUnlockAt) throw new Error("少し話してから進んでください。");
  if (!state.game.round.abilityDone.p1 || !state.game.round.abilityDone.p2) {
    throw new Error("2人とも能力を終えるまで話し合いへ進めません。");
  }
  await publishOnlineRound("discussion");
  state.discussionUnlockAt = Date.now() + 6000;
  setScreen("discussion");
}

async function startFinalChoice() {
  if (state.mode !== "online") {
    state.offlineStep.player = "p1";
    state.pendingFinalChoice = null;
    setScreen("finalChoice");
    return;
  }
  if (!isHost()) throw new Error("最終選択へ進めるのは1Pです。");
  await publishOnlineRound("finalChoice");
  state.pendingFinalChoice = null;
  setScreen("finalChoice");
}

function selectFinalChoice(choice) {
  const playerId = currentPlayerId();
  if (!playerId || state.game.round.choices[playerId]) return;
  state.pendingFinalChoice = choice;
  paint();
}

async function confirmFinalChoice() {
  const playerId = currentPlayerId();
  if (!playerId) throw new Error("プレイヤー情報を確認中です。少し待ってからもう一度お試しください。");
  const choice = state.pendingFinalChoice;
  if (!choice) throw new Error("先にカードを選んでください。");
  state.game.round = setFinalChoice(state.game.round, playerId, choice);
  state.pendingFinalChoice = null;
  if (state.mode !== "online" && playerId === "p1") {
    state.offlineStep.player = "p2";
    setScreen("finalChoice");
    return;
  }
  if (state.game.round.choices.p1 && state.game.round.choices.p2) state.game = resolveResult(state.game);
  if (state.game.round.result) {
    state.resultRolesRevealed = false;
    state.resultStep = "closed";
  }
  if (state.mode === "online") await publishOnlineRound(state.game.round.result ? "result" : "finalChoice");
  setScreen(state.game.round.result ? "result" : "finalChoice");
}

async function openResultCards() {
  if (state.mode === "online") {
    if (!isHost()) throw new Error("OPENできるのは1Pです。");
    state.resultStep = "revealed";
    await publishOnlineRound("resultOpen");
    setScreen("result");
    return;
  }
  state.resultStep = "revealed";
  paint();
}

async function showScoreBoard() {
  if (state.mode === "online") {
    if (!isHost()) throw new Error("得点画面へ進めるのは1Pです。");
    state.resultStep = "score";
    await publishOnlineRound("score");
    setScreen("result");
    return;
  }
  state.resultStep = "score";
  paint();
}

async function nextRound() {
  if (state.mode === "online" && !isHost()) throw new Error("次のゲームを始められるのは1Pです。");
  state.game = startNextRound(state.game);
  state.onlineRevealConfirmed = false;
  state.resultRolesRevealed = false;
  state.pendingFinalChoice = null;
  state.resultStep = "closed";
  state.discussionUnlockAt = 0;
  state.lastRoundNumber = state.game.round.number;
  state.offlineStep = { player: "p1", revealOpen: false, roleSeen: false };
  if (state.mode === "online") await publishOnlineRound(PREPARE_STATUS);
  setScreen("reveal");
}

async function publishOnlineRound(screen) {
  const slot = getOnlineSlot();
  if (!slot) throw new Error("プレイヤー情報を確認中です。少し待ってからもう一度お試しください。");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await mergeLatestOnlineRound();
    let targetScreen = screen;
    if (screen === "finalChoice" && state.game.round.choices.p1 && state.game.round.choices.p2 && !state.game.round.result) {
      state.game = resolveResult(state.game);
      state.resultRolesRevealed = false;
      state.resultStep = "closed";
      targetScreen = "result";
    }
    const expectedUpdatedAt = online.room?.updated_at || null;
    const roomPatch = {
      status: targetScreen,
      round_number: state.game.round.number,
      selected_role_ids: state.game.selectedRoleIds,
      player_names: state.game.names,
      public_state: publicRoundState(state.game.round),
      scores: state.game.scores
    };
    await online.upsertSecret(slot, state.game.round.number, playerSecretState(state.game.round, slot));
    if (slot === "p1" && online.room?.guest_player_id) {
      await online.upsertSecret("p2", state.game.round.number, playerSecretState(state.game.round, "p2"), online.room.guest_player_id);
    }
    const updated = await online.updateRoom(roomPatch, expectedUpdatedAt);
    if (updated) return;
  }
  await mergeLatestOnlineRound();
  let targetScreen = screen;
  if (screen === "finalChoice" && state.game.round.choices.p1 && state.game.round.choices.p2 && !state.game.round.result) {
    state.game = resolveResult(state.game);
    state.resultRolesRevealed = false;
    state.resultStep = "closed";
    targetScreen = "result";
  }
  await online.upsertSecret(slot, state.game.round.number, playerSecretState(state.game.round, slot));
  if (slot === "p1" && online.room?.guest_player_id) {
    await online.upsertSecret("p2", state.game.round.number, playerSecretState(state.game.round, "p2"), online.room.guest_player_id);
  }
  const updated = await online.updateRoom({
    status: targetScreen,
    round_number: state.game.round.number,
    selected_role_ids: state.game.selectedRoleIds,
    player_names: state.game.names,
    public_state: publicRoundState(state.game.round),
    scores: state.game.scores
  });
  if (updated) return;
  throw new Error("同時に操作がありました。もう一度ボタンを押してください。");
}

async function mergeLatestOnlineRound() {
  if (state.mode !== "online" || !online.room?.code || !state.game?.round?.number) return;
  const latest = await online.fetchRoom().catch(() => null);
  if (!latest || latest.round_number !== state.game.round.number) return;
  const remoteRound = hydrateRoomRound(latest);
  const round = structuredClone(state.game.round);
  ["p1", "p2"].forEach((playerId) => {
    if (!round.abilityDone[playerId] && remoteRound.abilityDone?.[playerId]) {
      round.abilityDone[playerId] = true;
      round.abilityLog[playerId] = remoteRound.abilityLog?.[playerId] || [];
    }
    if (!round.choices[playerId] && remoteRound.choices?.[playerId]) {
      round.choices[playerId] = remoteRound.choices[playerId];
    }
  });
  if (!round.result && remoteRound.result) {
    round.roles = remoteRound.roles;
    round.table = remoteRound.table;
    round.effectiveChoices = remoteRound.effectiveChoices;
    round.effectiveCamps = remoteRound.effectiveCamps;
    round.result = remoteRound.result;
  }
  state.game = {
    ...state.game,
    scores: latest.scores || state.game.scores,
    round
  };
}

function syncOnlineRoom(room) {
  state.mode = "online";
  const resolvedSlot = resolveOnlineSlot(room);
  if (!state.onlineSlot && resolvedSlot) state.onlineSlot = resolvedSlot;
  const names = room.player_names || { p1: "プレイヤー1", p2: "プレイヤー2" };
  state.game = {
    mode: "online",
    names,
    selectedRoleIds: room.selected_role_ids || defaultRoleIds(),
    scores: room.scores || { p1: 0, p2: 0 },
    roundNumber: room.round_number || 0,
    round: hydrateRoomRound(room)
  };
  if (state.game.round.number && state.lastRoundNumber !== state.game.round.number) {
    state.lastRoundNumber = state.game.round.number;
    state.onlineRevealConfirmed = Boolean(state.game.round.abilityDone?.[currentPlayerId()]);
    state.resultRolesRevealed = false;
    state.pendingFinalChoice = null;
    state.resultStep = "closed";
  }
  if (room.status === "result") state.resultStep = "closed";
  if (room.status === "resultOpen") state.resultStep = "revealed";
  if (room.status === "score") state.resultStep = "score";
  if (room.status === "discussion" && !state.discussionUnlockAt) state.discussionUnlockAt = Date.now() + 6000;
  if (room.status && !["waiting", "ready"].includes(room.status)) {
    state.screen = localScreenForRoomStatus(room.status, state.game.round);
  }
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
  if (state.mode === "online") return getOnlineSlot();
  return state.offlineStep.player;
}

function getVisibleSecret(playerId) {
  if (state.mode === "online") {
    return state.currentSecret || null;
  }
  return {
    roleId: state.game.round.roles[playerId],
    abilityLog: state.game.round.abilityLog[playerId]
  };
}

function onlineRoomNav() {
  return isOnlineSession() ? `<div class="inline-actions">${button("ルーム画面へ", "room-lobby")}</div>` : "";
}

function isOnlineSession() {
  return state.mode === "online" || Boolean(online.room);
}

function isOnlineGameActive(status) {
  return [PREPARE_STATUS, "discussion", "finalChoice", "result", "resultOpen", "score"].includes(status);
}

function currentOnlineGameScreen() {
  const status = online.room?.status;
  return isOnlineGameActive(status) ? localScreenForRoomStatus(status, state.game?.round || {}) : "onlineCreate";
}

function phaseName(status) {
  return {
    [PREPARE_STATUS]: "準備",
    discussion: "話し合い",
    finalChoice: "最終選択",
    result: "結果",
    resultOpen: "結果発表",
    score: "得点"
  }[status] || "待機中";
}

function isHost() {
  return getOnlineSlot() === "p1";
}

function localScreenForRoomStatus(status, round) {
  if (status === PREPARE_STATUS) {
    if (round.abilityDone?.[currentPlayerId()]) return "ability";
    return state.onlineRevealConfirmed ? "ability" : "reveal";
  }
  if (status === "discussion" && (!round.abilityDone.p1 || !round.abilityDone.p2)) return "ability";
  if (status === "resultOpen" || status === "score") return "result";
  return status;
}

function getOnlineSlot() {
  if (state.onlineSlot) return state.onlineSlot;
  const fromRoom = resolveOnlineSlot(online.room);
  if (fromRoom) return fromRoom;
  const saved = readSession();
  if (saved?.playerId === online.playerId && (saved.slot === "p1" || saved.slot === "p2")) return saved.slot;
  return null;
}

function resolveOnlineSlot(room) {
  if (!room) return null;
  if (room.host_player_id === online.playerId) return "p1";
  if (room.guest_player_id === online.playerId) return "p2";
  const saved = readSession();
  if (saved?.code === room.code && saved?.playerId === online.playerId && (saved.slot === "p1" || saved.slot === "p2")) {
    return saved.slot;
  }
  return null;
}

function renderPlayerResolving() {
  render(app, page("確認中", `
    <div class="panel">
      <h2>プレイヤー情報を確認中です</h2>
      <p class="muted">この端末が1Pか2Pかを確認しています。数秒待っても変わらない場合は、ルームに入り直してください。</p>
      ${onlineRoomNav()}
    </div>
  `));
}

function renderSecretWaiting() {
  render(app, page("準備中", `
    <div class="panel">
      <h2>あなたのカードを準備中です</h2>
      <p class="muted">少し待つと自分の役職確認画面に進みます。相手のカード情報はこの端末には表示されません。</p>
      ${onlineRoomNav()}
    </div>
  `));
}
