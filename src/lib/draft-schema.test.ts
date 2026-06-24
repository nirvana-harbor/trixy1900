import { describe, expect, it } from "vitest";
import { indicatorSuggestionSchema, readingDraftSchema } from "@/lib/draft-schema";

describe("reading draft schema", () => {
  it("validates the AI draft wire shape", () => {
    const parsed = readingDraftSchema.parse({
      title: "A 组",
      coreConclusion: "核心结论",
      cardLogic: "牌面逻辑",
      love: "情感提醒",
      career: "事业提醒",
      advice: "行动建议",
      reminder: "收束提醒",
      finalText: "这是一段足够长的最终文案，用于模拟 AI 返回的中文大众占卜解析。它需要超过最小长度，确保后台不会把空泛或残缺的结构发布出去。这里继续补充一些内容，让结构化校验能够覆盖真实的中等长度文案场景。"
    });

    expect(parsed.title).toBe("A 组");
  });

  it("validates the option indicator wire shape", () => {
    const parsed = indicatorSuggestionSchema.parse({
      style: "意象短句",
      tone: "像梦里闪过的画面",
      indicators: [
        { optionKey: "A", text: "雾散前，先听见远处的铃声" },
        { optionKey: "B", text: "一束光落在还没拆封的信上" },
        { optionKey: "C", text: "旧门轻响，风把答案翻到下一页" }
      ]
    });

    expect(parsed.indicators).toHaveLength(3);
  });
});
