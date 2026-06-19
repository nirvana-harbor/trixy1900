"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminSession, destroyAdminSession, requireAdmin, verifyPassword } from "@/lib/auth";
import { buildKnowledgeContext } from "@/lib/content";
import { todayKey } from "@/lib/dates";
import {
  createKnowledgeEntry,
  deleteKnowledgeEntry,
  ensureReading,
  markReadingOptionReviewed,
  publishReading,
  saveOptionDraft,
  saveTopicSuggestions,
  setReadingOptionCount,
  setReadingTopic,
  unpublishReading,
  updateCardProfile,
  updateReadingOption
} from "@/lib/db";
import { generateReadingDraft, generateTopicSuggestions } from "@/lib/ai";
import { parseCardsInput } from "@/lib/lenormand";
import { deleteOptionImage, hasUploadedImage, saveOptionImage } from "@/lib/option-images";
import { isOptionKey } from "@/lib/options";

function adminRedirect(path = "/admin", message?: string): never {
  if (!message) {
    redirect(path);
  }
  const separator = path.includes("?") ? "&" : "?";
  redirect(`${path}${separator}message=${encodeURIComponent(message)}`);
}

function optionKeyFromForm(formData: FormData) {
  const value = String(formData.get("optionKey") || "");
  if (!isOptionKey(value)) {
    throw new Error("无效的选项。");
  }
  return value;
}

export async function loginAction(formData: FormData) {
  const password = String(formData.get("password") || "");
  if (!(await verifyPassword(password))) {
    redirect("/admin/login?error=1");
  }
  await createAdminSession();
  redirect("/admin");
}

export async function logoutAction() {
  await destroyAdminSession();
  redirect("/admin/login");
}

export async function generateTopicsAction() {
  await requireAdmin();
  const date = todayKey();
  ensureReading(date);
  try {
    const topics = await generateTopicSuggestions();
    saveTopicSuggestions(date, topics);
    revalidatePath("/admin");
    adminRedirect("/admin", "已生成今日候选选题。");
  } catch (error) {
    adminRedirect("/admin", error instanceof Error ? error.message : "生成选题失败。");
  }
}

export async function selectTopicAction(formData: FormData) {
  await requireAdmin();
  const topic = String(formData.get("topic") || "").trim();
  if (!topic) {
    adminRedirect("/admin", "请选择一个主题。");
  }
  setReadingTopic(todayKey(), topic);
  revalidatePath("/admin");
  revalidatePath("/");
  adminRedirect("/admin", "今日主题已更新。");
}

export async function setOptionCountAction(formData: FormData) {
  await requireAdmin();
  const date = todayKey();
  const optionCount = Number(formData.get("optionCount"));
  const removedImages = setReadingOptionCount(date, optionCount);
  await Promise.all(removedImages.map((filename) => deleteOptionImage(filename)));
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/archive");
  adminRedirect("/admin", "组选项数量已更新。");
}

export async function optionFormAction(formData: FormData) {
  await requireAdmin();
  const date = todayKey();
  const optionKey = optionKeyFromForm(formData);
  const intent = String(formData.get("intent") || "save");
  const optionTitle = String(formData.get("optionTitle") || `${optionKey} 组选项`).trim();
  const cardsInput = String(formData.get("cards") || "");
  const finalText = String(formData.get("finalText") || "");
  const imageAltInput = String(formData.get("imageAlt") || "").trim();
  const deleteImage = String(formData.get("deleteImage") || "") === "1";
  const imageInput = formData.get("indicatorImage");
  const parsed = parseCardsInput(cardsInput);

  if (!parsed.ok) {
    adminRedirect("/admin", parsed.errors.join("；"));
  }

  const currentReading = ensureReading(date);
  const currentOption = currentReading.options.find((option) => option.option_key === optionKey);
  let imageFilename: string | null | undefined;
  let imageMimeType: string | null | undefined;
  let imageAlt: string | null | undefined;

  try {
    if (hasUploadedImage(imageInput)) {
      const saved = await saveOptionImage({
        file: imageInput,
        date,
        optionKey,
        oldFilename: currentOption?.image_filename
      });
      imageFilename = saved.filename;
      imageMimeType = saved.mimeType;
      imageAlt = imageAltInput || `${optionKey} 组指示物`;
    } else if (deleteImage) {
      await deleteOptionImage(currentOption?.image_filename);
      imageFilename = null;
      imageMimeType = null;
      imageAlt = null;
    } else if (currentOption?.image_filename) {
      imageAlt = imageAltInput || `${optionKey} 组指示物`;
    }
  } catch (error) {
    adminRedirect("/admin", error instanceof Error ? error.message : "指示物图片上传失败。");
  }

  updateReadingOption({
    date,
    optionKey,
    optionTitle,
    cards: parsed.cards,
    finalText,
    imageFilename,
    imageMimeType,
    imageAlt
  });

  if (intent === "approve") {
    try {
      markReadingOptionReviewed(date, optionKey);
      revalidatePath("/admin");
      revalidatePath("/");
      revalidatePath("/archive");
      adminRedirect("/admin", `${optionKey} 组已审核通过。`);
    } catch (error) {
      adminRedirect("/admin", error instanceof Error ? error.message : "审核失败。");
    }
  }

  if (intent === "generate") {
    const reading = ensureReading(date);
    if (!reading?.topic.trim()) {
      adminRedirect("/admin", "生成解析前需要先选择今日主题。");
    }
    try {
      const draft = await generateReadingDraft({
        topic: reading.topic,
        optionKey,
        optionTitle,
        cards: parsed.cards,
        knowledgeContext: buildKnowledgeContext()
      });
      saveOptionDraft({
        date,
        optionKey,
        draftJson: JSON.stringify(draft),
        finalText: draft.finalText
      });
      revalidatePath("/admin");
      adminRedirect("/admin", `${optionKey} 组解析草稿已生成。`);
    } catch (error) {
      adminRedirect("/admin", error instanceof Error ? error.message : "生成解析失败。");
    }
  }

  revalidatePath("/admin");
  revalidatePath("/");
  adminRedirect("/admin", `${optionKey} 组已保存。`);
}

export async function publishAction() {
  await requireAdmin();
  try {
    publishReading(todayKey());
    revalidatePath("/");
    revalidatePath("/archive");
    revalidatePath("/admin");
    adminRedirect("/admin", "今日大众占卜已发布。");
  } catch (error) {
    adminRedirect("/admin", error instanceof Error ? error.message : "发布失败。");
  }
}

export async function unpublishAction() {
  await requireAdmin();
  unpublishReading(todayKey());
  revalidatePath("/");
  revalidatePath("/archive");
  revalidatePath("/admin");
  adminRedirect("/admin", "已撤回今日内容。");
}

export async function createKnowledgeAction(formData: FormData) {
  await requireAdmin();
  const type = String(formData.get("type") || "牌义").trim();
  const title = String(formData.get("title") || "").trim();
  const body = String(formData.get("body") || "").trim();

  if (!title || !body) {
    adminRedirect("/admin/knowledge", "标题和正文不能为空。");
  }

  createKnowledgeEntry({ type, title, body });
  revalidatePath("/admin/knowledge");
  adminRedirect("/admin/knowledge", "知识条目已保存。");
}

export async function deleteKnowledgeAction(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  if (Number.isFinite(id)) {
    deleteKnowledgeEntry(id);
  }
  revalidatePath("/admin/knowledge");
  adminRedirect("/admin/knowledge", "知识条目已删除。");
}

export async function updateCardProfileAction(formData: FormData) {
  await requireAdmin();
  const cardNumber = Number(formData.get("cardNumber"));
  const returnFilter = sanitizeCardFilter(formData);
  if (!Number.isInteger(cardNumber) || cardNumber < 1 || cardNumber > 42) {
    adminRedirect("/admin/cards", "牌号无效。");
  }

  updateCardProfile({
    cardNumber,
    cardName: String(formData.get("cardName") || "").trim() || `第 ${cardNumber} 张`,
    reviewStatus: String(formData.get("reviewStatus") || "待校对").trim(),
    polarity: String(formData.get("polarity") || "").trim(),
    coreMeaning: String(formData.get("coreMeaning") || "").trim(),
    personImage: String(formData.get("personImage") || "").trim(),
    work: String(formData.get("work") || "").trim(),
    love: String(formData.get("love") || "").trim(),
    health: String(formData.get("health") || "").trim(),
    money: String(formData.get("money") || "").trim(),
    timing: String(formData.get("timing") || "").trim(),
    advice: String(formData.get("advice") || "").trim(),
    objectsPlaces: String(formData.get("objectsPlaces") || "").trim(),
    reviewNotes: String(formData.get("reviewNotes") || "").trim(),
    quizPrompt: String(formData.get("quizPrompt") || "").trim(),
    quizAnswer: String(formData.get("quizAnswer") || "").trim()
  });

  revalidatePath("/admin/cards");
  adminRedirect(cardFilterPath(returnFilter), `${String(cardNumber).padStart(2, "0")} 号牌已保存。`);
}

function sanitizeCardFilter(formData: FormData) {
  const filter = String(formData.get("returnFilter") || "pending");
  return ["pending", "draft", "question", "confirmed", "unused", "all"].includes(filter)
    ? filter
    : "pending";
}

function cardFilterPath(filter: string) {
  return filter === "pending" ? "/admin/cards" : `/admin/cards?filter=${encodeURIComponent(filter)}`;
}

function profileString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function importCardProfilesAction(formData: FormData) {
  await requireAdmin();
  const returnFilter = sanitizeCardFilter(formData);
  const rawJson = String(formData.get("profilesJson") || "").trim();
  if (!rawJson) {
    adminRedirect(cardFilterPath(returnFilter), "请先粘贴导出的 JSON。");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    adminRedirect(cardFilterPath(returnFilter), "JSON 格式不正确，无法导入。");
  }

  const source = parsed as { cards?: unknown };
  const cards = Array.isArray(source.cards) ? source.cards : Array.isArray(parsed) ? parsed : [];
  let importedCount = 0;

  for (const item of cards) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const record = item as Record<string, unknown>;
    const cardNumber = Number(record.card_number ?? record.cardNumber);
    if (!Number.isInteger(cardNumber) || cardNumber < 1 || cardNumber > 42) {
      continue;
    }

    updateCardProfile({
      cardNumber,
      cardName: profileString(record.card_name ?? record.cardName) || `第 ${cardNumber} 张`,
      reviewStatus: profileString(record.review_status ?? record.reviewStatus) || "待校对",
      polarity: profileString(record.polarity),
      coreMeaning: profileString(record.core_meaning ?? record.coreMeaning),
      personImage: profileString(record.person_image ?? record.personImage),
      work: profileString(record.work),
      love: profileString(record.love),
      health: profileString(record.health),
      money: profileString(record.money),
      timing: profileString(record.timing),
      advice: profileString(record.advice),
      objectsPlaces: profileString(record.objects_places ?? record.objectsPlaces),
      reviewNotes: profileString(record.review_notes ?? record.reviewNotes),
      quizPrompt: profileString(record.quiz_prompt ?? record.quizPrompt),
      quizAnswer: profileString(record.quiz_answer ?? record.quizAnswer)
    });
    importedCount += 1;
  }

  if (importedCount === 0) {
    adminRedirect(cardFilterPath(returnFilter), "没有找到可导入的牌义记录。");
  }

  revalidatePath("/admin/cards");
  adminRedirect(cardFilterPath(returnFilter), `已导入 ${importedCount} 张牌义。`);
}
