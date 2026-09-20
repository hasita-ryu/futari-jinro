export const CAMPS = {
  VILLAGE: "village",
  WEREWOLF: "werewolf"
};

export const ROLE_DEFINITIONS = [
  {
    id: "villager",
    name: "村人",
    camp: CAMPS.VILLAGE,
    color: "#c9e8d2",
    icon: "seed",
    ability: {
      type: "none",
      text: "特殊能力はありません。相手の言葉をよく聞いて、最後の選択を決めましょう。"
    }
  },
  {
    id: "seer",
    name: "占い師",
    camp: CAMPS.VILLAGE,
    color: "#bfe7f5",
    icon: "star",
    ability: {
      type: "peek_table",
      count: 2,
      text: "場に残った3枚から2枚を見ることができます。"
    }
  },
  {
    id: "seer_apprentice",
    name: "占い師の弟子",
    camp: CAMPS.VILLAGE,
    color: "#d7ecff",
    icon: "dot",
    ability: {
      type: "peek_table",
      count: 1,
      text: "場に残った3枚から1枚を見ることができます。"
    }
  },
  {
    id: "wizard",
    name: "魔法使い",
    camp: CAMPS.VILLAGE,
    color: "#f7d7ef",
    icon: "wand",
    ability: {
      type: "swap_self_table",
      text: "自分のカードと場のカード1枚を入れ替えられます。入れ替えないこともできます。"
    }
  },
  {
    id: "witch_apprentice",
    name: "見習い魔女",
    camp: CAMPS.VILLAGE,
    color: "#ead9ff",
    icon: "moon",
    ability: {
      type: "flip_opponent_camp",
      text: "相手の陣営を村人陣営と人狼陣営の間で変化させます。"
    }
  },
  {
    id: "wolf_boy",
    name: "狼少年",
    camp: CAMPS.VILLAGE,
    color: "#f8e3a2",
    icon: "ear",
    tags: ["wolf_friendly"],
    ability: {
      type: "none",
      text: "特殊能力はありません。人狼側との「あくしゅ」で特別に加点されます。"
    }
  },
  {
    id: "wolf_man",
    name: "狼男",
    camp: CAMPS.VILLAGE,
    color: "#f3c6a2",
    icon: "ear",
    tags: ["turns_wolf_if_wolf_in_table"],
    ability: {
      type: "passive",
      text: "場に人狼系カードが残っていると、判定時に人狼陣営になります。"
    }
  },
  {
    id: "werewolf",
    name: "人狼",
    camp: CAMPS.WEREWOLF,
    color: "#f4b4b1",
    icon: "fang",
    ability: {
      type: "peek_table",
      count: 1,
      text: "場に残った3枚から1枚を見ることができます。"
    }
  },
  {
    id: "werewolf_senpai",
    name: "人狼先輩",
    camp: CAMPS.WEREWOLF,
    color: "#f0aaa7",
    icon: "fang",
    ability: {
      type: "peek_table",
      count: 2,
      text: "場に残った3枚から2枚を見ることができます。"
    }
  },
  {
    id: "werewolf_boss",
    name: "人狼親方",
    camp: CAMPS.WEREWOLF,
    color: "#e9958f",
    icon: "fang",
    tags: ["high_risk"],
    ability: {
      type: "peek_table",
      count: 3,
      text: "場に残った3枚すべてを見ることができます。ただし負けた時の失点が大きくなります。"
    }
  },
  {
    id: "werewolf_magician",
    name: "人狼マジシャン",
    camp: CAMPS.WEREWOLF,
    color: "#d7c2f3",
    icon: "wand",
    ability: {
      type: "reverse_opponent_choice",
      text: "相手の最終選択を「あくしゅ」と「まもる」で反転させます。"
    }
  },
  {
    id: "werewolf_wizard",
    name: "人狼魔法使い",
    camp: CAMPS.WEREWOLF,
    color: "#c7b4e8",
    icon: "moon",
    ability: {
      type: "cloud_table_peek",
      text: "カードを見る能力に干渉します。相手が場を見る時、1枚だけ「もやもや」として隠します。"
    }
  }
];

export function getRole(roleId) {
  return ROLE_DEFINITIONS.find((role) => role.id === roleId);
}

export function roleName(roleId) {
  return getRole(roleId)?.name || "不明な役職";
}

export function isWerewolfRole(roleId) {
  return getRole(roleId)?.camp === CAMPS.WEREWOLF;
}

export function defaultRoleIds() {
  return ROLE_DEFINITIONS.map((role) => role.id);
}
