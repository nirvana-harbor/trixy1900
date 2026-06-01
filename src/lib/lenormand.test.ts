import { describe, expect, it } from "vitest";
import { normalizeCardName, parseCardsInput } from "@/lib/lenormand";

describe("lenormand card parsing", () => {
  it("normalizes canonical names and numbered aliases", () => {
    expect(normalizeCardName("骑士")).toBe("骑士");
    expect(normalizeCardName("01 骑士")).toBe("骑士");
    expect(normalizeCardName("24心")).toBe("心");
    expect(normalizeCardName("房子")).toBe("房屋");
    expect(normalizeCardName("房屋牌")).toBe("房屋");
    expect(normalizeCardName("十字路口")).toBe("路径");
    expect(normalizeCardName("百合")).toBe("百合花");
    expect(normalizeCardName("37 灵体")).toBe("灵体");
    expect(normalizeCardName("39 床")).toBe("床");
    expect(normalizeCardName("灵体牌")).toBe("灵体");
    expect(normalizeCardName("稍纵即逝")).toBe("即逝");
    expect(normalizeCardName("香爐")).toBe("香炉");
  });

  it("accepts variable spreads from 1 to 9 cards", () => {
    const result = parseCardsInput("骑士\n心，戒指、钥匙");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.cards).toEqual(["骑士", "心", "戒指", "钥匙"]);
    }
  });

  it("rejects unknown cards and oversized spreads", () => {
    expect(parseCardsInput("魔术师").ok).toBe(false);
    expect(parseCardsInput("骑士,四叶草,船,房子,树,云,蛇,棺材,花束,镰刀").ok).toBe(false);
  });
});
