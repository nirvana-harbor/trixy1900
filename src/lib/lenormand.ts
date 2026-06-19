export const LENORMAND_CARDS = [
  "骑士",
  "四叶草",
  "船",
  "房屋",
  "树",
  "云",
  "蛇",
  "棺材",
  "花束",
  "镰刀",
  "鞭子",
  "鸟",
  "孩子",
  "狐狸",
  "熊",
  "星星",
  "鹳",
  "狗",
  "塔",
  "花园",
  "山",
  "路径",
  "老鼠",
  "心",
  "戒指",
  "书",
  "信",
  "男士",
  "女士",
  "百合花",
  "太阳",
  "月亮",
  "钥匙",
  "鱼",
  "锚",
  "十字架",
  "灵体",
  "香炉",
  "床",
  "即逝",
  "扩展牌41",
  "扩展牌42"
] as const;

export type LenormandCard = (typeof LENORMAND_CARDS)[number];

const cardLookup = new Map<string, LenormandCard>();

const CARD_ALIASES: Record<string, LenormandCard> = {
  骑士牌: "骑士",
  四叶草牌: "四叶草",
  船牌: "船",
  房子: "房屋",
  房子牌: "房屋",
  房屋牌: "房屋",
  十字路口: "路径",
  路口: "路径",
  岔路: "路径",
  男: "男士",
  男人: "男士",
  男性: "男士",
  男牌: "男士",
  女: "女士",
  女人: "女士",
  女性: "女士",
  女牌: "女士",
  百合: "百合花",
  百合牌: "百合花",
  床牌: "床",
  床铺: "床",
  灵体牌: "灵体",
  靈體: "灵体",
  靈體牌: "灵体",
  即逝牌: "即逝",
  稍纵即逝: "即逝",
  香炉牌: "香炉",
  香爐: "香炉",
  香爐牌: "香炉",
  未知扩展牌一: "扩展牌41",
  待确认扩展牌一: "扩展牌41",
  第41张扩展牌: "扩展牌41",
  未知扩展牌二: "扩展牌42",
  待确认扩展牌二: "扩展牌42",
  第42张扩展牌: "扩展牌42"
};

LENORMAND_CARDS.forEach((card, index) => {
  const number = String(index + 1).padStart(2, "0");
  const simpleNumber = String(index + 1);
  [
    number,
    simpleNumber,
    card,
    `${number}${card}`,
    `${simpleNumber}${card}`,
    `${number} ${card}`,
    `${simpleNumber} ${card}`,
    `${number}.${card}`,
    `${simpleNumber}.${card}`,
    `${number}、${card}`,
    `${simpleNumber}、${card}`
  ].forEach((alias) => cardLookup.set(normalizeToken(alias), card));
});

Object.entries(CARD_ALIASES).forEach(([alias, card]) => {
  cardLookup.set(normalizeToken(alias), card);
});

export function normalizeToken(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "").replace(/[.。]/g, ".");
}

export function normalizeCardName(value: string): LenormandCard | null {
  return cardLookup.get(normalizeToken(value)) ?? null;
}

export type CardParseResult =
  | { ok: true; cards: LenormandCard[] }
  | { ok: false; errors: string[] };

export function parseCardsInput(input: string): CardParseResult {
  const tokens = input
    .split(/[\n,，、;；]+/)
    .map((token) => token.trim())
    .filter(Boolean);

  if (tokens.length < 1 || tokens.length > 9) {
    return { ok: false, errors: ["每组选项需要录入 1-9 张雷诺曼牌。"] };
  }

  const errors: string[] = [];
  const cards = tokens.flatMap((token) => {
    const card = normalizeCardName(token);
    if (!card) {
      errors.push(`无法识别牌名：${token}`);
      return [];
    }
    return [card];
  });

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, cards };
}

export function isPublishableOption(cardsJson: string, finalText: string) {
  try {
    const cards = JSON.parse(cardsJson) as unknown;
    return Array.isArray(cards) && cards.length >= 1 && cards.length <= 9 && finalText.trim().length > 0;
  } catch {
    return false;
  }
}
