import type { EmergencyPriority } from "@/lib/types/public";

export type SosTemplate = {
  id: string;
  label: string;
  title: string;
  description: string;
  priority: EmergencyPriority;
};

/** 被災者が素早く選べる状況プリセット（デモ台本・現場想定を反映） */
export const SOS_TEMPLATES: SosTemplate[] = [
  {
    id: "water-food",
    label: "水・食料不足",
    title: "避難所の水と食料が不足",
    description:
      "避難者多数。飲み水と保存食の追加支援が必要。到着可能な時間帯があれば記載してください。",
    priority: "high",
  },
  {
    id: "trapped-upstairs",
    label: "2階避難・閉じ込め",
    title: "2階に避難者3名、水と毛布が必要",
    description:
      "1階浸水のため2階に避難。出入り口使用不可。救急箱も不足しています。",
    priority: "high",
  },
  {
    id: "medical",
    label: "けが・体調不良",
    title: "けが人あり、医療支援が必要",
    description:
      "転倒で足を怪我。止血済みだが搬送または応急処置が必要。高齢者1名。",
    priority: "high",
  },
  {
    id: "elderly-alone",
    label: "高齢者・一人",
    title: "高齢者1名、一人で動けない",
    description:
      "自力避難困難。車椅子使用。近隣に家族不在。定期的な安否確認を希望。",
    priority: "medium",
  },
  {
    id: "infant",
    label: "乳幼児・おむつ",
    title: "乳幼児2名、おむつとミルクが必要",
    description: "避難所到着済み。おむつ・粉ミルク・哺乳瓶の支援が必要。",
    priority: "medium",
  },
  {
    id: "building-damage",
    label: "建物損傷",
    title: "建物の壁にひび、倒壊の恐れ",
    description:
      "外壁に幅10cm程度のひび。余震で倒壊リスクあり。周囲の避難誘導も必要。",
    priority: "medium",
  },
  {
    id: "power-outage",
    label: "停電・通信不通",
    title: "停電・携帯圏外、情報共有のみ",
    description:
      "近隣の安全確認済み。大きな被害報告はないが、行政情報が届いていない。",
    priority: "low",
  },
];
