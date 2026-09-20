import { CAMPS, getRole, isWerewolfRole } from "./roles.js";
import { calculateRoundScore } from "./scoring.js";

export const CHOICES = {
  HANDSHAKE: "handshake",
  PROTECT: "protect"
};

export function createInitialGame({ mode, names, selectedRoleIds }) {
  return {
    mode,
    names: { p1: names.p1 || "プレイヤー1", p2: names.p2 || "プレイヤー2" },
    selectedRoleIds: [...selectedRoleIds],
    scores: { p1: 0, p2: 0 },
    roundNumber: 0,
    round: null
  };
}

export function createRound(game, seed = Date.now()) {
  const picked = shuffleWithSeed(game.selectedRoleIds, seed).slice(0, 5);
  const cards = shuffleWithSeed(picked, seed + 17);
  return {
    number: game.roundNumber + 1,
    seed,
    roles: { p1: cards[0], p2: cards[1] },
    table: [
      { index: 0, roleId: cards[2] },
      { index: 1, roleId: cards[3] },
      { index: 2, roleId: cards[4] }
    ],
    originalTable: [cards[2], cards[3], cards[4]],
    abilityLog: { p1: [], p2: [] },
    abilityDone: { p1: false, p2: false },
    choices: { p1: null, p2: null },
    effectiveChoices: { p1: null, p2: null },
    effectiveCamps: { p1: null, p2: null },
    result: null
  };
}

export function startNextRound(game, seed) {
  const round = createRound(game, seed);
  return {
    ...game,
    roundNumber: round.number,
    round
  };
}

export function resolveAbility(round, playerId, payload = {}) {
  const next = structuredClone(round);
  const role = getRole(next.roles[playerId]);
  const otherId = playerId === "p1" ? "p2" : "p1";
  const log = [];

  if (!role) return next;

  switch (role.ability.type) {
    case "peek_table": {
      const chosenIndexes = normalizeIndexes(payload.indexes).slice(0, role.ability.count);
      chosenIndexes.forEach((index) => {
        const card = next.table.find((item) => item.index === index);
        if (card) {
          log.push({ type: "peek", index, roleId: card.roleId });
        }
      });
      break;
    }
    case "swap_self_table": {
      const index = Number(payload.index);
      const card = next.table.find((item) => item.index === index);
      if (card) {
        const oldSelf = next.roles[playerId];
        next.roles[playerId] = card.roleId;
        card.roleId = oldSelf;
        log.push({ type: "swap", index, gainedRoleId: next.roles[playerId], placedRoleId: oldSelf });
      } else {
        log.push({ type: "skip", text: "入れ替えませんでした。" });
      }
      break;
    }
    case "flip_opponent_camp":
      log.push({ type: "camp_flip", target: otherId });
      break;
    case "reverse_opponent_choice":
      log.push({ type: "reverse_choice", target: otherId });
      break;
    case "cloud_table_peek":
      log.push({ type: "cloud_table_peek" });
      break;
    case "passive":
      log.push({ type: "passive", text: role.ability.text });
      break;
    default:
      log.push({ type: "none", text: "能力はありません。" });
  }

  next.abilityLog[playerId] = log;
  next.abilityDone[playerId] = true;
  return next;
}

export function setFinalChoice(round, playerId, choice) {
  const next = structuredClone(round);
  next.choices[playerId] = choice;
  return next;
}

export function canResolveResult(round) {
  return Boolean(round.choices.p1 && round.choices.p2);
}

export function resolveResult(game) {
  const round = structuredClone(game.round);
  round.effectiveChoices = computeEffectiveChoices(round);
  round.effectiveCamps = computeEffectiveCamps(round);
  round.result = calculateRoundScore(round);
  return {
    ...game,
    scores: {
      p1: game.scores.p1 + round.result.playerDelta.p1,
      p2: game.scores.p2 + round.result.playerDelta.p2
    },
    round
  };
}

export function publicRoundState(round) {
  return {
    number: round.number,
    roles: round.roles,
    table: round.table,
    abilityLog: round.abilityLog,
    abilityDone: round.abilityDone,
    choices: round.choices,
    choicesDone: { p1: Boolean(round.choices.p1), p2: Boolean(round.choices.p2) },
    result: round.result
      ? {
          roles: round.roles,
          table: round.table,
          choices: round.choices,
          effectiveChoices: round.effectiveChoices,
          effectiveCamps: round.effectiveCamps,
          result: round.result
        }
      : null
  };
}

export function playerSecretState(round, playerId) {
  return {
    playerId,
    roundNumber: round.number,
    roleId: round.roles[playerId],
    abilityLog: round.abilityLog[playerId] || []
  };
}

export function hydrateRoundFromPublicAndSecret(publicData, secretData) {
  return { publicData, secretData };
}

function computeEffectiveChoices(round) {
  const choices = { ...round.choices };
  ["p1", "p2"].forEach((playerId) => {
    const otherId = playerId === "p1" ? "p2" : "p1";
    if (round.abilityLog[playerId]?.some((item) => item.type === "reverse_choice")) {
      choices[otherId] = choices[otherId] === CHOICES.HANDSHAKE ? CHOICES.PROTECT : CHOICES.HANDSHAKE;
    }
  });
  return choices;
}

function computeEffectiveCamps(round) {
  const camps = {};
  ["p1", "p2"].forEach((playerId) => {
    const role = getRole(round.roles[playerId]);
    camps[playerId] = role?.camp || CAMPS.VILLAGE;
  });

  ["p1", "p2"].forEach((playerId) => {
    const role = getRole(round.roles[playerId]);
    if (role?.tags?.includes("turns_wolf_if_wolf_in_table") && round.table.some((card) => isWerewolfRole(card.roleId))) {
      camps[playerId] = CAMPS.WEREWOLF;
    }
    const otherId = playerId === "p1" ? "p2" : "p1";
    if (round.abilityLog[playerId]?.some((item) => item.type === "camp_flip")) {
      camps[otherId] = camps[otherId] === CAMPS.VILLAGE ? CAMPS.WEREWOLF : CAMPS.VILLAGE;
    }
  });

  return camps;
}

function normalizeIndexes(indexes) {
  if (!Array.isArray(indexes)) return [];
  return indexes.map((index) => Number(index)).filter((index) => Number.isInteger(index) && index >= 0 && index <= 2);
}

function shuffleWithSeed(items, seed) {
  const result = [...items];
  let state = Number(seed) || 1;
  for (let i = result.length - 1; i > 0; i -= 1) {
    state = (state * 1664525 + 1013904223) % 4294967296;
    const j = state % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
