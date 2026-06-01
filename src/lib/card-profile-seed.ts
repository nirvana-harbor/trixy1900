import { readFileSync } from "node:fs";
import { join } from "node:path";

export type DefaultCardProfile = {
  cardNumber: number;
  cardName: string;
  reviewStatus: string;
  polarity: string;
  coreMeaning: string;
  personImage: string;
  work: string;
  love: string;
  health: string;
  money: string;
  timing: string;
  advice: string;
  objectsPlaces: string;
  reviewNotes: string;
};

const cardsMarkdownPath = join(process.cwd(), "docs", "knowledge", "cards.md");

const fieldMap: Record<string, keyof DefaultCardProfile> = {
  状态: "reviewStatus",
  牌性: "polarity",
  核心牌意: "coreMeaning",
  人物形象: "personImage",
  工作: "work",
  爱情: "love",
  健康: "health",
  金钱: "money",
  时间: "timing",
  建议: "advice",
  "物品/地点": "objectsPlaces"
};

function blankProfile(cardNumber: number, cardName: string): DefaultCardProfile {
  return {
    cardNumber,
    cardName,
    reviewStatus: "待校对",
    polarity: "",
    coreMeaning: "",
    personImage: "",
    work: "",
    love: "",
    health: "",
    money: "",
    timing: "",
    advice: "",
    objectsPlaces: "",
    reviewNotes: ""
  };
}

export function readDefaultCardProfiles(): DefaultCardProfile[] {
  const markdown = readFileSync(cardsMarkdownPath, "utf8");
  const headings = [...markdown.matchAll(/^##\s+(\d{2})\s+(.+?)\s*$/gm)];
  const profiles: DefaultCardProfile[] = [];

  headings.forEach((section, index) => {
    const cardNumber = Number(section[1]);
    const cardName = section[2].trim();
    const bodyStart = (section.index ?? 0) + section[0].length;
    const bodyEnd = headings[index + 1]?.index ?? markdown.length;
    const body = markdown.slice(bodyStart, bodyEnd);
    const profile = blankProfile(cardNumber, cardName);
    const notes: string[] = [];

    body
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("- "))
      .forEach((line) => {
        const content = line.slice(2);
        const separatorIndex = content.indexOf("：");
        if (separatorIndex < 0) {
          notes.push(content);
          return;
        }
        const label = content.slice(0, separatorIndex).trim();
        const value = content.slice(separatorIndex + 1).trim();
        const key = fieldMap[label];
        if (key) {
          profile[key] = value as never;
        } else {
          notes.push(`${label}：${value}`);
        }
      });

    profile.reviewNotes = notes.join("\n");
    profiles.push(profile);
  });

  return profiles;
}
