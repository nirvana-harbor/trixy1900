import Link from "next/link";
import { ArrowLeft, Download, HelpCircle, Save, Upload } from "lucide-react";
import { importCardProfilesAction, updateCardProfileAction } from "@/app/admin/actions";
import { requireAdmin } from "@/lib/auth";
import { listCardProfiles, type CardProfile } from "@/lib/db";

export const dynamic = "force-dynamic";

const reviewStatuses = ["待校对", "有疑问", "已确认", "暂不使用"];
const cardFilters = [
  { key: "pending", label: "待处理" },
  { key: "question", label: "有疑问" },
  { key: "confirmed", label: "已确认" },
  { key: "unused", label: "暂不使用" },
  { key: "all", label: "全部" }
] as const;
const polarities = [
  "",
  "积极牌",
  "中性牌",
  "消极牌",
  "中性偏积极牌",
  "中性偏消极牌",
  "待确认"
];

function cardTitle(card: CardProfile) {
  return `${String(card.card_number).padStart(2, "0")} ${card.card_name}`;
}

function statusClass(status: string) {
  if (status.includes("已确认")) {
    return "border-[rgba(143,241,223,0.38)] bg-[rgba(143,241,223,0.12)] text-[var(--jade)]";
  }
  if (status.includes("疑问")) {
    return "border-[rgba(255,155,204,0.38)] bg-[rgba(255,155,204,0.12)] text-[var(--rose)]";
  }
  return "border-[var(--line)] bg-white/5 text-[var(--muted)]";
}

function cardFilterPath(filter: string) {
  return filter === "pending" ? "/admin/cards" : `/admin/cards?filter=${filter}`;
}

function visibleCardsForFilter(cards: CardProfile[], filter: string) {
  if (filter === "all") {
    return cards;
  }
  if (filter === "question") {
    return cards.filter((card) => card.review_status === "有疑问");
  }
  if (filter === "confirmed") {
    return cards.filter((card) => card.review_status === "已确认");
  }
  if (filter === "unused") {
    return cards.filter((card) => card.review_status === "暂不使用");
  }
  return cards.filter((card) => card.review_status !== "已确认" && card.review_status !== "暂不使用");
}

function TextArea({
  label,
  name,
  value,
  placeholder,
  rows = 3
}: {
  label: string;
  name: string;
  value: string;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label>
      <span className="label">{label}</span>
      <textarea
        className="field"
        name={name}
        defaultValue={value}
        placeholder={placeholder}
        rows={rows}
      />
    </label>
  );
}

export default async function AdminCardsPage({
  searchParams
}: {
  searchParams: Promise<{ message?: string; show?: string; filter?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const cards = listCardProfiles();
  const confirmedCount = cards.filter((card) => card.review_status === "已确认").length;
  const activeFilter = params.filter || (params.show === "all" ? "all" : "pending");
  const safeFilter = cardFilters.some((filter) => filter.key === activeFilter) ? activeFilter : "pending";
  const visibleCards = visibleCardsForFilter(cards, safeFilter);
  const counts = {
    pending: visibleCardsForFilter(cards, "pending").length,
    question: visibleCardsForFilter(cards, "question").length,
    confirmed: confirmedCount,
    unused: visibleCardsForFilter(cards, "unused").length,
    all: cards.length
  };

  return (
    <main className="shell py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-[var(--jade)]">给 AI 用的牌义，以这里为最高优先级</p>
          <h1 className="mt-1 text-3xl font-black">牌义校对台</h1>
          <p className="mt-2 max-w-3xl leading-8 text-[var(--muted)]">
            你可以直接改错字、补牌义、写批注，或用“校对题”把不确定的点留给自己之后判断。
            保存后，生成解析时会优先读取这里的版本。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin" className="button secondary">
            <ArrowLeft size={18} />
            返回后台
          </Link>
          <Link href="/admin/knowledge" className="button secondary">
            <HelpCircle size={18} />
            知识库
          </Link>
        </div>
      </header>

      {params.message ? (
        <div className="mb-4 rounded-lg border border-[rgba(47,118,109,0.28)] bg-[rgba(47,118,109,0.08)] p-4 text-sm font-bold text-[var(--jade)]">
          {params.message}
        </div>
      ) : null}

      <section className="panel mb-6 grid gap-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black">怎么校对</h2>
            <p className="mt-1 text-sm leading-7 text-[var(--muted)]">
              下拉选择“已确认/有疑问/待校对”，正文框里直接改。你也可以在“校对题”里写判断题或选择题，例如：
              “树牌是不是马上结束？答案：不是，它是缓慢发展、短时间断不掉。”
            </p>
          </div>
          <span className="rounded-lg border border-[var(--line)] bg-white/5 px-3 py-2 text-sm font-black text-[var(--muted)]">
            已确认 {confirmedCount} / {cards.length} · 当前显示 {visibleCards.length}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {cardFilters.map((filter) => (
            <Link
              key={filter.key}
              href={cardFilterPath(filter.key)}
              className={`button secondary ${safeFilter === filter.key ? "is-filter-active" : ""}`}
            >
              {filter.label} {counts[filter.key]}
            </Link>
          ))}
        </div>
      </section>

      <section className="panel mb-6 grid gap-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-black">备份与迁移</h2>
            <p className="mt-1 text-sm leading-7 text-[var(--muted)]">
              本地校对好的牌义可以导出成 JSON。部署到 Render 后，进入同一个页面粘贴 JSON 导入，就能把本地校对成果带过去。
            </p>
          </div>
          <Link href="/admin/cards/export" className="button secondary">
            <Download size={18} />
            导出牌义 JSON
          </Link>
        </div>
        <details className="rounded-lg border border-[var(--line)] bg-white/5">
          <summary className="cursor-pointer p-4 font-black text-[var(--muted)]">导入牌义 JSON</summary>
          <form action={importCardProfilesAction} className="grid gap-3 border-t border-[var(--line)] p-4">
            <input type="hidden" name="returnFilter" value={safeFilter} />
            <label>
              <span className="label">粘贴从“导出牌义 JSON”下载到的内容</span>
              <textarea
                className="field min-h-52"
                name="profilesJson"
                placeholder='{"version":1,"cards":[...]}'
              />
            </label>
            <button className="button w-fit" type="submit">
              <Upload size={18} />
              导入并覆盖对应牌号
            </button>
          </form>
        </details>
      </section>

      <section className="grid gap-4">
        {visibleCards.length === 0 ? (
          <div className="panel p-6 text-[var(--muted)]">
            当前筛选下没有牌。需要回看全部内容时，点击上方“全部”。
          </div>
        ) : null}
        {visibleCards.map((card) => (
          <details
            key={card.card_number}
            className="panel overflow-hidden"
            open={card.review_status !== "已确认" || card.card_number <= 6}
          >
            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3 p-5">
              <div>
                <p className="text-sm font-bold text-[var(--muted)]">第 {card.card_number} 张</p>
                <h2 className="mt-1 text-2xl font-black">{card.card_name}</h2>
              </div>
              <span className={`rounded-lg border px-3 py-2 text-sm font-black ${statusClass(card.review_status)}`}>
                {card.review_status}
              </span>
            </summary>

            <form action={updateCardProfileAction} className="grid gap-4 border-t border-[var(--line)] p-5">
              <input type="hidden" name="cardNumber" value={card.card_number} />
              <input type="hidden" name="returnFilter" value={safeFilter} />
              <div className="grid gap-4 md:grid-cols-[140px_1fr_180px_180px]">
                <label>
                  <span className="label">编号</span>
                  <input className="field" value={String(card.card_number).padStart(2, "0")} readOnly />
                </label>
                <label>
                  <span className="label">牌名</span>
                  <input className="field" name="cardName" defaultValue={card.card_name} />
                </label>
                <label>
                  <span className="label">确认状态</span>
                  <select className="field" name="reviewStatus" defaultValue={card.review_status}>
                    {reviewStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="label">牌性</span>
                  <select className="field" name="polarity" defaultValue={card.polarity}>
                    {polarities.map((polarity) => (
                      <option key={polarity || "blank"} value={polarity}>
                        {polarity || "未填写"}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <TextArea label="核心牌意" name="coreMeaning" value={card.core_meaning} />
              <div className="grid gap-4 md:grid-cols-2">
                <TextArea label="人物形象" name="personImage" value={card.person_image} />
                <TextArea label="工作" name="work" value={card.work} />
                <TextArea label="爱情" name="love" value={card.love} />
                <TextArea label="健康" name="health" value={card.health} />
                <TextArea label="金钱" name="money" value={card.money} />
                <TextArea label="时间" name="timing" value={card.timing} />
                <TextArea label="建议" name="advice" value={card.advice} />
                <TextArea label="物品/地点" name="objectsPlaces" value={card.objects_places} />
              </div>

              <TextArea
                label="批注 / 待确认问题"
                name="reviewNotes"
                value={card.review_notes}
                placeholder="例如：这里可能是“收入缩减”，照片字迹需要再看。"
                rows={4}
              />
              <div className="grid gap-4 md:grid-cols-2">
                <TextArea
                  label="校对题（可写选择题或判断题）"
                  name="quizPrompt"
                  value={card.quiz_prompt}
                  placeholder="例如：云牌在感情里是不是代表非常不对劲？"
                />
                <TextArea
                  label="校对题答案"
                  name="quizAnswer"
                  value={card.quiz_answer}
                  placeholder="例如：是。它代表关系中混沌、混乱、迷茫。"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-[var(--muted)]">
                  最后更新：{card.updated_at} · 保存后会影响后续 AI 解析知识库。
                </p>
                <button className="button" type="submit">
                  <Save size={18} />
                  保存 {cardTitle(card)}
                </button>
              </div>
            </form>
          </details>
        ))}
      </section>
    </main>
  );
}
