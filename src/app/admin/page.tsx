import Link from "next/link";
import Image from "next/image";
import {
  BookOpen,
  Check,
  LogOut,
  MessageSquareText,
  PencilLine,
  RefreshCw,
  Send,
  Sparkles,
  Trash2
} from "lucide-react";
import {
  generateTopicsAction,
  logoutAction,
  optionFormAction,
  publishAction,
  selectTopicAction,
  setOptionCountAction,
  unpublishAction
} from "@/app/admin/actions";
import { isUsingDefaultAdminPassword, requireAdmin } from "@/lib/auth";
import { formatChineseDate, todayKey } from "@/lib/dates";
import { ensureReading, getLatestTopicSuggestion, listTopicRequests } from "@/lib/db";

export const dynamic = "force-dynamic";

function cardsText(cardsJson: string) {
  try {
    const cards = JSON.parse(cardsJson) as string[];
    return cards.join("\n");
  } catch {
    return "";
  }
}

function draftSummary(aiDraftJson: string | null) {
  if (!aiDraftJson) {
    return null;
  }
  try {
    const draft = JSON.parse(aiDraftJson) as { coreConclusion?: string };
    return draft.coreConclusion || "已有 AI 草稿。";
  } catch {
    return "已有 AI 草稿。";
  }
}

function optionImageSrc(date: string, optionKey: string) {
  return `/reading-images/${encodeURIComponent(date)}/${encodeURIComponent(optionKey)}`;
}

export default async function AdminPage({
  searchParams
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const date = todayKey();
  const reading = ensureReading(date);
  const suggestions = getLatestTopicSuggestion(date);
  const topics = suggestions ? (JSON.parse(suggestions.suggestions_json) as string[]) : [];
  const published = reading.status === "published";
  const topicRequests = listTopicRequests(8);

  return (
    <main className="shell py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-[var(--jade)]">{formatChineseDate(date)}</p>
          <h1 className="mt-1 text-3xl font-black">每日占卜后台</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/cards" className="button secondary">
            <BookOpen size={18} />
            牌义校对
          </Link>
          <Link href="/admin/knowledge" className="button secondary">
            <PencilLine size={18} />
            知识库
          </Link>
          <form action={logoutAction}>
            <button className="button secondary" type="submit">
              <LogOut size={18} />
              退出
            </button>
          </form>
        </div>
      </header>

      {isUsingDefaultAdminPassword() ? (
        <div className="mb-4 rounded-lg border border-[rgba(183,121,31,0.35)] bg-[rgba(183,121,31,0.08)] p-4 text-sm font-bold text-[var(--amber)]">
          当前使用默认后台密码 admin123。正式使用前请在 .env 设置 ADMIN_PASSWORD。
        </div>
      ) : null}

      {params.message ? (
        <div className="mb-4 rounded-lg border border-[rgba(47,118,109,0.28)] bg-[rgba(47,118,109,0.08)] p-4 text-sm font-bold text-[var(--jade)]">
          {params.message}
        </div>
      ) : null}

      <section className="panel mb-6 grid gap-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-[var(--muted)]">今日主题</p>
            <h2 className="mt-1 text-2xl font-black">{reading.topic || "尚未选择主题"}</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              状态：{published ? "已发布" : "草稿"}{reading.published_at ? ` · ${reading.published_at}` : ""}
            </p>
          </div>
          <form action={generateTopicsAction}>
            <button className="button" type="submit">
              <Sparkles size={18} />
              生成今日选题
            </button>
          </form>
        </div>

        <form action={setOptionCountAction} className="flex flex-wrap items-end gap-3">
          <label className="w-full max-w-44">
            <span className="label">今日组选项数量</span>
            <select className="field" name="optionCount" defaultValue={reading.option_count}>
              <option value="2">2 组</option>
              <option value="3">3 组</option>
              <option value="4">4 组</option>
            </select>
          </label>
          <button className="button secondary" type="submit">
            <Check size={18} />
            更新组选项
          </button>
        </form>

        {topics.length > 0 ? (
          <div className="grid gap-3">
            {topics.map((topic) => (
              <form key={topic} action={selectTopicAction} className="flex items-center gap-3">
                <input type="hidden" name="topic" value={topic} />
                <button className="button secondary flex-1 !justify-start" type="submit">
                  <Check size={18} />
                  {topic}
                </button>
              </form>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--muted)]">还没有候选选题，点击上方按钮生成。</p>
        )}
      </section>

      <section className="mb-6 grid gap-5">
        {reading.options.map((option) => (
          <form
            key={option.option_key}
            action={optionFormAction}
            className="panel grid gap-4 p-5"
            encType="multipart/form-data"
          >
            <input type="hidden" name="optionKey" value={option.option_key} />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black">{option.option_key} 组</h2>
                <p className="mt-1 text-sm font-bold text-[var(--muted)]">
                  {option.reviewed_at ? `已审核通过 · ${option.reviewed_at}` : "待审核：生成或编辑后需要审核通过"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="button secondary" name="intent" value="save" type="submit">
                  <Check size={18} />
                  保存
                </button>
                <button className="button secondary" name="intent" value="approve" type="submit">
                  <Check size={18} />
                  审核通过
                </button>
                <button className="button" name="intent" value="generate" type="submit">
                  <RefreshCw size={18} />
                  生成解析
                </button>
              </div>
            </div>

            {draftSummary(option.ai_draft_json) ? (
              <p className="rounded-lg bg-[rgba(47,118,109,0.08)] p-3 text-sm leading-6 text-[var(--jade)]">
                {draftSummary(option.ai_draft_json)}
              </p>
            ) : null}

            <label>
              <span className="label">选项标题</span>
              <input className="field" name="optionTitle" defaultValue={option.option_title} />
            </label>
            <div className="grid gap-4 md:grid-cols-[180px_1fr]">
              <div>
                <span className="label">当前指示物</span>
                {option.image_filename ? (
                  <span className="admin-option-image">
                    <Image
                      src={optionImageSrc(date, option.option_key)}
                      alt={option.image_alt || `${option.option_key} 组指示物`}
                      fill
                      sizes="180px"
                      unoptimized
                    />
                  </span>
                ) : (
                  <div className="admin-option-image-empty">
                    <span className="card-back h-24 w-16" aria-hidden="true" />
                  </div>
                )}
              </div>
              <div className="grid content-start gap-3">
                <label>
                  <span className="label">上传/替换指示物图片（JPG、PNG、WEBP，最大 5MB）</span>
                  <input
                    className="field"
                    name="indicatorImage"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                  />
                </label>
                <label>
                  <span className="label">图片描述（可选，用于无障碍说明）</span>
                  <input
                    className="field"
                    name="imageAlt"
                    defaultValue={option.image_alt || `${option.option_key} 组指示物`}
                  />
                </label>
                {option.image_filename ? (
                  <label className="flex items-center gap-2 text-sm font-bold text-[var(--muted)]">
                    <input type="checkbox" name="deleteImage" value="1" />
                    删除当前指示物图片
                  </label>
                ) : null}
              </div>
            </div>
            <label>
              <span className="label">牌面，每行一张或用逗号分隔，支持 1-9 张</span>
              <textarea className="field min-h-28" name="cards" defaultValue={cardsText(option.cards_json)} />
            </label>
            <label>
              <span className="label">最终发布文案</span>
              <textarea className="field min-h-72" name="finalText" defaultValue={option.final_text} />
            </label>
          </form>
        ))}
      </section>

      <section className="panel mb-6 grid gap-4 p-5">
        <div className="flex items-center gap-3">
          <MessageSquareText className="text-[var(--amber)]" size={22} />
          <div>
            <h2 className="text-xl font-black">用户选题建议</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">公开选题采集页收到的最新留言。</p>
          </div>
        </div>
        {topicRequests.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">还没有收到用户选题建议。</p>
        ) : (
          <div className="grid gap-3">
            {topicRequests.map((request) => (
              <article
                key={request.id}
                className="rounded-lg border border-[var(--line)] bg-white/5 p-4"
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-black text-[var(--amber)]">{request.nickname}</span>
                  <span className="text-[var(--muted)]">{request.created_at}</span>
                </div>
                <p className="leading-7 text-[var(--ink)]">{request.suggestion}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <h2 className="text-xl font-black">发布控制</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            发布后，今日内容会出现在前台和历史列表。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={publishAction}>
            <button className="button" type="submit">
              <Send size={18} />
              发布今日内容
            </button>
          </form>
          <form action={unpublishAction}>
            <button className="button danger" type="submit">
              <Trash2 size={18} />
              撤回
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
