import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { listCardProfiles, listKnowledgeEntries } from "@/lib/db";

const knowledgeDir = join(process.cwd(), "docs", "knowledge");

export type MarkdownDoc = {
  file: string;
  title: string;
  body: string;
  headings: string[];
};

function readMarkdownDoc(dir: string, file: string): MarkdownDoc {
  const body = readFileSync(join(dir, file), "utf8");
  const headings = body
    .split("\n")
    .filter((line) => line.startsWith("#"))
    .map((line) => line.replace(/^#+\s*/, "").trim());
  return {
    file,
    title: headings[0] || file,
    body,
    headings
  };
}

export function readKnowledgeDocs() {
  return readdirSync(knowledgeDir)
    .filter((file) => file.endsWith(".md"))
    .sort()
    .map((file) => readMarkdownDoc(knowledgeDir, file));
}

export function buildKnowledgeContext() {
  const cardProfiles = listCardProfiles()
    .filter((card) => card.review_status !== "暂不使用")
    .map(
      (card) => `## ${String(card.card_number).padStart(2, "0")} ${card.card_name}

- 校对状态：${card.review_status}
- 牌性：${card.polarity || "待确认"}
- 核心牌意：${card.core_meaning || "待补充"}
- 人物形象：${card.person_image || "待补充"}
- 工作：${card.work || "待补充"}
- 爱情：${card.love || "待补充"}
- 健康：${card.health || "待补充"}
- 金钱：${card.money || "待补充"}
- 时间：${card.timing || "待补充"}
- 建议：${card.advice || "待补充"}
- 物品/地点：${card.objects_places || "待补充"}
- 批注：${card.review_notes || "无"}`
    )
    .join("\n\n");

  const cardDoc = cardProfiles ? `# 后台牌义校对台（优先使用）\n\n${cardProfiles}` : "";

  const fileDocs = readKnowledgeDocs()
    .map((doc) => `# ${doc.title}\n\n${doc.body}`)
    .join("\n\n---\n\n");

  const dbDocs = listKnowledgeEntries()
    .map((entry) => `# ${entry.type}：${entry.title}\n\n${entry.body}`)
    .join("\n\n---\n\n");

  return [cardDoc, dbDocs, fileDocs].filter(Boolean).join("\n\n---\n\n").slice(0, 45000);
}
