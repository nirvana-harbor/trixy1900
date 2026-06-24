import OpenAI from "openai";
import {
  indicatorSuggestionJsonSchema,
  indicatorSuggestionSchema,
  readingDraftJsonSchema,
  readingDraftSchema,
  topicSuggestionJsonSchema,
  topicSuggestionSchema,
  type IndicatorSuggestion,
  type ReadingDraft
} from "@/lib/draft-schema";
import type { LenormandCard } from "@/lib/lenormand";
import type { OptionKey } from "@/lib/options";

function client() {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

const model = () => process.env.OPENAI_MODEL || "gpt-5.4-mini";

function parseOutputText(response: unknown) {
  const outputText =
    typeof response === "object" && response && "output_text" in response
      ? (response.output_text as string | undefined)
      : undefined;

  if (!outputText) {
    throw new Error("AI 没有返回可解析文本。");
  }
  return outputText;
}

export async function generateTopicSuggestions() {
  const openai = client();
  if (!openai) {
    return [
      "接下来七天，你最需要看清的关系信号是什么？",
      "近期事业或学业里，哪个机会值得你认真抓住？",
      "你和心里那个人之间，正在发生什么隐性的变化？",
      "六月开启前，宇宙想提醒你调整哪一种内在模式？",
      "这段时间你的财务与资源流动，会出现怎样的转机？"
    ];
  }

  const response = await openai.responses.create({
    model: model(),
    input: [
      {
        role: "system",
        content:
          "你是中文大众占卜内容策划。请生成适合雷诺曼大众占卜的每日选题，题目要具体、有吸引力、不过度承诺。"
      },
      {
        role: "user",
        content:
          "生成 5-10 个中文大众占卜选题，覆盖情感、事业、人际、自我成长、财务或近期趋势。只返回结构化 JSON。"
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "topic_suggestions",
        strict: true,
        schema: topicSuggestionJsonSchema
      }
    }
  } as Parameters<typeof openai.responses.create>[0]);

  const parsed = topicSuggestionSchema.parse(JSON.parse(parseOutputText(response)));
  return parsed.topics;
}

function topicSeed(topic: string) {
  return Array.from(topic).reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function fallbackIndicators(topic: string, optionKeys: OptionKey[]): IndicatorSuggestion {
  const sets = [
    {
      style: "物品场景" as const,
      tone: "带一点日常感的神秘物件",
      texts: [
        "一把夹在旧笔记里的银色钥匙",
        "窗台上刚冒新芽的多肉植物",
        "深夜还亮着灯的小办公室",
        "被雨水打湿的一张车票"
      ]
    },
    {
      style: "冷笑话" as const,
      tone: "轻松、无厘头，但留一点共鸣空间",
      texts: [
        "今天不想内耗，想把烦恼外包给月亮",
        "心动不是电量低，但也该充一充自己",
        "别急着破防，先看看宇宙有没有售后",
        "好运还在路上，可能是导航绕远了"
      ]
    },
    {
      style: "意象短句" as const,
      tone: "像梦里闪过的画面",
      texts: [
        "雾散前，先听见远处的铃声",
        "一束光落在还没拆封的信上",
        "旧门轻响，风把答案翻到下一页",
        "潮水退后，石阶露出新的方向"
      ]
    }
  ];
  const set = sets[topicSeed(topic) % sets.length];
  return {
    style: set.style,
    tone: set.tone,
    indicators: optionKeys.map((optionKey, index) => ({
      optionKey,
      text: set.texts[index] || set.texts[index % set.texts.length]
    }))
  };
}

function normalizeIndicatorSuggestion(
  suggestion: IndicatorSuggestion,
  topic: string,
  optionKeys: OptionKey[]
): IndicatorSuggestion {
  const fallback = fallbackIndicators(topic, optionKeys);
  const byKey = new Map(
    suggestion.indicators.map((indicator) => [
      indicator.optionKey,
      indicator.text.trim()
    ])
  );

  return {
    style: suggestion.style || fallback.style,
    tone: suggestion.tone || fallback.tone,
    indicators: optionKeys.map((optionKey, index) => ({
      optionKey,
      text: byKey.get(optionKey) || fallback.indicators[index]?.text || fallback.indicators[0].text
    }))
  };
}

export async function generateOptionIndicators(params: {
  topic: string;
  optionKeys: OptionKey[];
}): Promise<IndicatorSuggestion> {
  const openai = client();
  if (!openai) {
    return fallbackIndicators(params.topic, params.optionKeys);
  }

  const response = await openai.responses.create({
    model: model(),
    input: [
      {
        role: "system",
        content:
          "你是中文大众占卜的指示物策划。你要为同一个每日占卜主题生成一组文字指示物，用来帮助用户凭直觉选择 A/B/C/D。指示物要轻盈、有画面感、有区分度，不能像答案提示。"
      },
      {
        role: "user",
        content: [
          `今日主题：${params.topic}`,
          `需要生成的选项：${params.optionKeys.join("、")}`,
          "请只选择一种统一风格：物品场景、冷笑话、意象短句。",
          "每个选项生成 1 条文字指示物，彼此不要太像，要和主题有隐约呼应，但不要把结论说死。",
          "文字长度建议 8-28 个中文字符；冷笑话可以稍长，但保持轻松好玩。",
          "只返回结构化 JSON。"
        ].join("\n\n")
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "option_indicators",
        strict: true,
        schema: indicatorSuggestionJsonSchema
      }
    }
  } as Parameters<typeof openai.responses.create>[0]);

  const parsed = indicatorSuggestionSchema.parse(JSON.parse(parseOutputText(response)));
  return normalizeIndicatorSuggestion(parsed, params.topic, params.optionKeys);
}

export async function generateReadingDraft(params: {
  topic: string;
  optionKey: string;
  optionTitle: string;
  indicatorText?: string;
  cards: LenormandCard[];
  knowledgeContext: string;
}): Promise<ReadingDraft> {
  const openai = client();
  if (!openai) {
    const cards = params.cards.join("、");
    return {
      title: `${params.optionKey} 组：${params.topic}`,
      coreConclusion: "这是一个本地占位草稿。填入 OPENAI_API_KEY 后，系统会根据你的知识库生成完整解析。",
      cardLogic: `本组选项指示物为：${params.indicatorText || "未设置"}；牌面为：${cards}。请结合你的牌义体系补充牌与牌之间的主线、修饰和转折。`,
      love: "情感层面先保留为人工润色区。",
      career: "事业与资源层面先保留为人工润色区。",
      advice: "建议先把你的牌义、组合规则和风格样例补进 docs/knowledge 或后台知识库。",
      reminder: "发布前请务必改写为你的最终表达。",
      finalText: `【${params.optionTitle || params.optionKey + " 组选项"}】\n\n本组抽到的牌是：${cards}。\n\n当前还没有配置 OPENAI_API_KEY，所以这里先生成一版可编辑占位稿。请把你的雷诺曼牌义、组合判断、真实案例和写作风格逐步补入知识库；配置 API key 后，系统会根据这些资料输出约 600-900 字的正式大众占卜解析。\n\n这组牌的人工解读可以从三个方向展开：第一，先确认主题「${params.topic}」下最核心的状态；第二，判断牌与牌之间谁是主线、谁在修饰、谁带来阻力或转机；第三，把结论落回读者能执行的提醒，而不是停留在关键词拼接。\n\n发布前请在后台把这段文字改成你的最终文案。`
    };
  }

  const response = await openai.responses.create({
    model: model(),
    input: [
      {
        role: "system",
        content:
          "你是协助雷诺曼占卜师写大众占卜文案的中文编辑。必须优先依据用户提供的知识库、牌义体系、风格指南和案例；资料不足时要克制表达，不要编造占卜师没有提供的独家规则。"
      },
      {
        role: "user",
        content: [
          `今日主题：${params.topic}`,
          `选项：${params.optionKey} / ${params.optionTitle || params.optionKey + " 组选项"}`,
          `文字指示物：${params.indicatorText || "未设置"}`,
          `牌面：${params.cards.join("、")}`,
          "请生成一组 600-900 中文字左右的大众占卜解析。解析时要同时参考文字指示物和牌面：指示物负责提供入口意象、情绪基调或现实场景，牌面负责判断主线、阻力、转机和建议。",
          "结构要包含：开场共鸣、牌面逻辑、当前状态、情感/事业或现实层面的提醒、行动建议和一句收束提醒。",
          "不要恐吓，不要绝对化承诺，不要给医疗、法律、投资等高风险建议。",
          "知识库如下：",
          params.knowledgeContext || "暂未提供个人知识库。"
        ].join("\n\n")
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "lenormand_reading_draft",
        strict: true,
        schema: readingDraftJsonSchema
      }
    }
  } as Parameters<typeof openai.responses.create>[0]);

  return readingDraftSchema.parse(JSON.parse(parseOutputText(response)));
}
