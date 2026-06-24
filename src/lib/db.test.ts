import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildKnowledgeContext } from "@/lib/content";
import {
  ensureReading,
  getReading,
  getPublishedReading,
  markReadingOptionReviewed,
  publishReading,
  resetDbForTests,
  saveReadingIndicators,
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

  it("stores text indicators and keeps them when cards are edited", () => {
    const date = "2026-06-02";
    ensureReading(date);
    setReadingTopic(date, "谁正在悄悄想念你？");

    saveReadingIndicators({
      date,
      style: "意象短句 · 像梦里闪过的画面",
      indicators: [
        { optionKey: "A", text: "雾散前，先听见远处的铃声" },
        { optionKey: "B", text: "一束光落在还没拆封的信上" },
        { optionKey: "C", text: "旧门轻响，风把答案翻到下一页" }
      ]
    });

    expect(getReading(date)?.options.find((option) => option.option_key === "A")?.indicator_text).toBe(
      "雾散前，先听见远处的铃声"
    );

    updateReadingOption({
      date,
      optionKey: "A",
      optionTitle: "A 组选项",
      cards: ["骑士", "心", "戒指"],
      finalText: "A 组完整解析。"
    });

    expect(getReading(date)?.options.find((option) => option.option_key === "A")?.indicator_text).toBe(
      "雾散前，先听见远处的铃声"
    );
  });

  it("clears stale final text when indicators are regenerated", () => {
    const date = "2026-06-03";
    ensureReading(date);
    setReadingTopic(date, "近期有什么新的机会？");
    updateReadingOption({
      date,
      optionKey: "A",
      optionTitle: "A 组选项",
      cards: ["骑士", "四叶草", "鱼"],
      finalText: "这是一段旧解析。"
    });

    saveReadingIndicators({
      date,
      style: "物品场景 · 带一点日常感的神秘物件",
      indicators: [{ optionKey: "A", text: "一把夹在旧笔记里的银色钥匙" }]
    });

    const option = getReading(date)?.options.find((item) => item.option_key === "A");
    expect(option?.indicator_text).toBe("一把夹在旧笔记里的银色钥匙");
    expect(option?.final_text).toBe("");
    expect(option?.ai_draft_json).toBeNull();
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
    expect(cards[0].review_status).toBe("已确认");
    expect(cards.find((card) => card.card_number === 5)?.core_meaning).toContain("家族");
    expect(cards.find((card) => card.card_number === 7)?.review_status).toBe("AI草稿");
    expect(cards.find((card) => card.card_number === 41)?.card_name).toBe("扩展牌41");
    expect(cards.find((card) => card.card_number === 42)?.core_meaning).toContain("AI草稿占位");
    cards.forEach((card) => {
      expect(card.core_meaning.trim()).not.toBe("");
      expect(card.person_image.trim()).not.toBe("");
      expect(card.work.trim()).not.toBe("");
      expect(card.love.trim()).not.toBe("");
      expect(card.health.trim()).not.toBe("");
      expect(card.money.trim()).not.toBe("");
      expect(card.timing.trim()).not.toBe("");
      expect(card.advice.trim()).not.toBe("");
      expect(card.objects_places.trim()).not.toBe("");
    });
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

  it("includes AI draft profiles in the knowledge context", () => {
    listCardProfiles();
    const context = buildKnowledgeContext();

    expect(context).toContain("后台牌义校对台");
    expect(context).toContain("AI草稿");
    expect(context).toContain("扩展牌41");
  });
});
