import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ensureReading,
  getReading,
  getPublishedReading,
  markReadingOptionReviewed,
  publishReading,
  resetDbForTests,
  setReadingOptionCount,
  setReadingTopic,
  unpublishReading,
  updateReadingOption,
  createTopicRequest,
  listTopicRequests,
  listCardProfiles,
  updateCardProfile
} from "@/lib/db";

let dir = "";

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "lenormand-test-"));
  process.env.LENORMAND_DB_PATH = join(dir, "test.sqlite");
  resetDbForTests();
});

afterEach(() => {
  resetDbForTests();
  rmSync(dir, { recursive: true, force: true });
});

describe("reading publication flow", () => {
  it("keeps drafts hidden until all options are complete and published", () => {
    const date = "2026-05-30";
    ensureReading(date);
    setReadingTopic(date, "这段关系接下来会如何发展？");

    expect(getPublishedReading(date)).toBeNull();
    expect(() => publishReading(date)).toThrow(/补齐/);

    (["A", "B", "C"] as const).forEach((optionKey) => {
      updateReadingOption({
        date,
        optionKey,
        optionTitle: `${optionKey} 组选项`,
        cards: ["骑士", "心", "戒指"],
        finalText: `${optionKey} 组完整解析。这里模拟一段已经编辑好的最终发布文案。`
      });
    });

    expect(() => publishReading(date)).toThrow(/审核通过/);

    (["A", "B", "C"] as const).forEach((optionKey) => {
      markReadingOptionReviewed(date, optionKey);
    });

    publishReading(date);
    expect(getPublishedReading(date)?.status).toBe("published");

    unpublishReading(date);
    expect(getPublishedReading(date)).toBeNull();
  });

  it("returns a published reading to draft when an approved option is edited", () => {
    const date = "2026-06-01";
    ensureReading(date);
    setReadingTopic(date, "近期事业会出现什么机会？");

    (["A", "B", "C"] as const).forEach((optionKey) => {
      updateReadingOption({
        date,
        optionKey,
        optionTitle: `${optionKey} 组选项`,
        cards: ["骑士", "心", "戒指"],
        finalText: `${optionKey} 组完整解析。这里模拟一段已经编辑好的最终发布文案。`
      });
      markReadingOptionReviewed(date, optionKey);
    });

    publishReading(date);
    expect(getPublishedReading(date)).not.toBeNull();

    updateReadingOption({
      date,
      optionKey: "A",
      optionTitle: "A 组选项",
      cards: ["骑士", "心", "戒指"],
      finalText: "A 组修改后的解析，需要重新审核。"
    });

    expect(getPublishedReading(date)).toBeNull();
    expect(getReading(date)?.options.find((option) => option.option_key === "A")?.reviewed_at).toBeNull();
  });

  it("supports two to four public options per reading", () => {
    const date = "2026-05-31";
    ensureReading(date);

    expect(getReading(date)?.options.map((option) => option.option_key)).toEqual(["A", "B", "C"]);

    setReadingOptionCount(date, 2);
    expect(getReading(date)?.options.map((option) => option.option_key)).toEqual(["A", "B"]);

    setReadingOptionCount(date, 4);
    expect(getReading(date)?.options.map((option) => option.option_key)).toEqual([
      "A",
      "B",
      "C",
      "D"
    ]);
  });
});

describe("topic requests", () => {
  it("stores public topic suggestions for the admin board", () => {
    createTopicRequest({
      nickname: "小月",
      suggestion: "想看近期暧昧对象会不会主动联系。"
    });

    const requests = listTopicRequests();

    expect(requests).toHaveLength(1);
    expect(requests[0].nickname).toBe("小月");
    expect(requests[0].suggestion).toContain("暧昧对象");
  });
});

describe("card profile review table", () => {
  it("seeds editable card profiles from the knowledge markdown", () => {
    const cards = listCardProfiles();

    expect(cards).toHaveLength(42);
    expect(cards[0].card_name).toBe("骑士");
    expect(cards.find((card) => card.card_number === 5)?.core_meaning).toContain("家族");
    expect(cards.find((card) => card.card_number === 41)?.card_name).toContain("待确认");
  });

  it("stores review edits used by the admin card review page", () => {
    listCardProfiles();
    updateCardProfile({
      cardNumber: 5,
      cardName: "树",
      reviewStatus: "已确认",
      polarity: "中性牌",
      coreMeaning: "家族、健康、灵媒。",
      personImage: "健康的人。",
      work: "医药业。",
      love: "短时间内断不掉。",
      health: "素食、平静。",
      money: "长期投资。",
      timing: "时间久。",
      advice: "保持耐心。",
      objectsPlaces: "族谱、森林。",
      reviewNotes: "已按口述校对。",
      quizPrompt: "树牌是否马上结束？",
      quizAnswer: "否。"
    });

    const tree = listCardProfiles().find((card) => card.card_number === 5);

    expect(tree?.review_status).toBe("已确认");
    expect(tree?.quiz_answer).toBe("否。");
  });
});
