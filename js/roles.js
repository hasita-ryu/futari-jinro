export const CAMPS = {
  VILLAGE: "village",
  WEREWOLF: "werewolf"
};

export const ROLE_DEFINITIONS = [
  {
    id: "villager",
    name: "村人",
    camp: CAMPS.VILLAGE,
    color: "#38BDF8",
    icon: "circle",
    ability: {
      type: "none",
      text: "効果はありません。相手の発言を読んで、最後の選択を決めます。"
    }
  },
  {
    id: "seer",
    name: "占い師",
    camp: CAMPS.VILLAGE,
    color: "#22D3EE",
    icon: "eye",
    ability: {
      type: "peek_table",
      count: 2,
      text: "伏せカード3枚から2枚を確認できます。"
    }
  },
  {
    id: "seer_apprentice",
    name: "見習い占い師",
    camp: CAMPS.VILLAGE,
    color: "#7DD3FC",
    icon: "dot",
    ability: {
      type: "peek_table",
      count: 1,
      text: "伏せカード3枚から1枚を確認できます。"
    }
  },
  {
    id: "wizard",
    name: "魔法使い",
    camp: CAMPS.VILLAGE,
    color: "#A78BFA",
    icon: "swap",
    ability: {
      type: "swap_self_table",
      text: "自分のカードと伏せ札1枚を入れ替えられます。入れ替えないこともできます。"
    }
  },
  {
    id: "witch_apprentice",
    name: "見習い魔女",
    camp: CAMPS.VILLAGE,
    color: "#818CF8",
    icon: "flip",
    ability: {
      type: "flip_opponent_camp",
      text: "相手のチーム判定をしろ/くろの間で反転させます。"
    }
  },
  {
    id: "wolf_boy",
    name: "子人狼",
    camp: CAMPS.VILLAGE,
    color: "#F59E0B",
    icon: "edge",
    tags: ["wolf_friendly"],
    ability: {
      type: "none",
      text: "効果はありません。くろチームとのなかよし成立で追加点を得ます。"
    }
  },
  {
    id: "wolf_man",
    name: "人狼男",
    camp: CAMPS.VILLAGE,
    color: "#FB923C",
    icon: "shift",
    tags: ["turns_wolf_if_wolf_in_table"],
    ability: {
      type: "passive",
      text: "伏せカードにくろチームがあると、判定時にくろチームになります。"
    }
  },
  {
    id: "werewolf",
    name: "人狼",
    camp: CAMPS.WEREWOLF,
    color: "#F43F5E",
    icon: "mask",
    ability: {
      type: "peek_table",
      count: 1,
      text: "伏せカード3枚から1枚を確認できます。"
    }
  },
  {
    id: "werewolf_senpai",
    name: "先輩人狼",
    camp: CAMPS.WEREWOLF,
    color: "#E11D48",
    icon: "mask",
    ability: {
      type: "peek_table",
      count: 2,
      text: "伏せカード3枚から2枚を確認できます。"
    }
  },
  {
    id: "werewolf_boss",
    name: "キング人狼",
    camp: CAMPS.WEREWOLF,
    color: "#BE123C",
    icon: "crown",
    tags: ["high_risk"],
    ability: {
      type: "peek_table",
      count: 3,
      text: "伏せカード3枚すべてを確認できます。ただし失敗時の減点が大きくなります。"
    }
  },
  {
    id: "werewolf_magician",
    name: "人狼マジシャン",
    camp: CAMPS.WEREWOLF,
    color: "#C084FC",
    icon: "mirror",
    ability: {
      type: "reverse_opponent_choice",
      text: "相手の最後の選択を「なかよし」と「ガード」で反転させます。"
    }
  },
  {
    id: "werewolf_wizard",
    name: "人狼魔法使い",
    camp: CAMPS.WEREWOLF,
    color: "#64748B",
    icon: "fog",
    ability: {
      type: "cloud_table_peek",
      text: "相手の確認効果に干渉します。伏せカードの一部を読みづらくします。"
    }
  }
];

export function getRole(roleId) {
  return ROLE_DEFINITIONS.find((role) => role.id === roleId);
}

export function roleName(roleId) {
  return getRole(roleId)?.name || "不明なカード";
}

export function isWerewolfRole(roleId) {
  return getRole(roleId)?.camp === CAMPS.WEREWOLF;
}

export function defaultRoleIds() {
  return ROLE_DEFINITIONS.map((role) => role.id);
}
