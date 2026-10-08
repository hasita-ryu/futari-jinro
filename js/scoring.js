import { CAMPS, getRole } from "./roles.js";

export const SCORE_RULES = {
  sameChoiceBonus: 1,
  handshakeSameCamp: 2,
  handshakeDifferentCamp: {
    village: -1,
    werewolf: 3
  },
  protectAgainstDifferentCamp: {
    village: 2,
    werewolf: -1
  },
  bothProtect: 0,
  wolfBoyHandshakeWithWolf: 2,
  werewolfBossLosePenalty: -2,
  roundParticipation: 1
};

export function calculateRoundScore(round) {
  const players = ["p1", "p2"];
  const result = {
    summary: "",
    playerDelta: { p1: 0, p2: 0 },
    winners: [],
    finalChoices: { ...round.choices },
    camps: {}
  };

  players.forEach((playerId) => {
    result.playerDelta[playerId] += SCORE_RULES.roundParticipation;
    result.camps[playerId] = round.effectiveCamps[playerId];
  });

  const p1Choice = round.effectiveChoices.p1;
  const p2Choice = round.effectiveChoices.p2;
  result.finalChoices = { ...round.effectiveChoices };

  if (p1Choice === p2Choice) {
    result.playerDelta.p1 += SCORE_RULES.sameChoiceBonus;
    result.playerDelta.p2 += SCORE_RULES.sameChoiceBonus;
  }

  if (p1Choice === "handshake" && p2Choice === "handshake") {
    if (round.effectiveCamps.p1 === round.effectiveCamps.p2) {
      result.playerDelta.p1 += SCORE_RULES.handshakeSameCamp;
      result.playerDelta.p2 += SCORE_RULES.handshakeSameCamp;
      result.winners = ["p1", "p2"];
      result.summary = "同じ所属で協定成立。両者にボーナスが入ります。";
    } else {
      players.forEach((playerId) => {
        const camp = round.effectiveCamps[playerId];
        result.playerDelta[playerId] += SCORE_RULES.handshakeDifferentCamp[camp];
      });
      result.winners = players.filter((playerId) => round.effectiveCamps[playerId] === CAMPS.WEREWOLF);
      result.summary = "違う所属で協定成立。シャドウ側が主導権を取りました。";
    }
  } else if (p1Choice === "protect" && p2Choice === "protect") {
    result.summary = "両者とも警戒。大きな変化はありません。";
  } else {
    players.forEach((playerId) => {
      const otherId = playerId === "p1" ? "p2" : "p1";
      if (round.effectiveChoices[playerId] === "protect") {
        if (round.effectiveCamps[playerId] !== round.effectiveCamps[otherId]) {
          result.playerDelta[playerId] += SCORE_RULES.protectAgainstDifferentCamp[round.effectiveCamps[playerId]];
          result.winners.push(playerId);
        }
      }
    });
    result.summary = result.winners.length
      ? "読みが的中しました。警戒を選んだ側にボーナスが入ります。"
      : "読みは外れました。今回は大きな変化なしです。";
  }

  players.forEach((playerId) => {
    const otherId = playerId === "p1" ? "p2" : "p1";
    if (
      round.roles[playerId] === "wolf_boy" &&
      round.effectiveChoices[playerId] === "handshake" &&
      round.effectiveChoices[otherId] === "handshake" &&
      round.effectiveCamps[otherId] === CAMPS.WEREWOLF
    ) {
      result.playerDelta[playerId] += SCORE_RULES.wolfBoyHandshakeWithWolf;
      result.summary += " 境界者はシャドウ側との協定成立で追加点を得ました。";
    }

    const role = getRole(round.roles[playerId]);
    if (role?.tags?.includes("high_risk") && !result.winners.includes(playerId)) {
      result.playerDelta[playerId] += SCORE_RULES.werewolfBossLosePenalty;
    }
  });

  return result;
}
