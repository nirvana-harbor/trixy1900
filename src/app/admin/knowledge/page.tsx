import Link from "next/link";
import { ArrowLeft, BookOpen, Plus, Trash2 } from "lucide-react";
import { createKnowledgeAction, deleteKnowledgeAction } from "@/app/admin/actions";
import { requireAdmin } from "@/lib/auth";
import { listKnowledgeEntries } from "@/lib/db";
import { readKnowledgeDocs } from "@/lib/content";

export const dynamic = "force-dynamic";

export default async function KnowledgePage({
  searchParams
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const entries = listKnowledgeEntries();
  const docs = readKnowledgeDocs();

  return (
    <main className="shell py-8">
      <div className="mb-6 flex flex-wrap gap-2">
        <Link href="/admin" className="button secondary w-fit">
          <ArrowLeft size={18} />
          返回后台
        </Link>
        <Link href="/admin/cards" className="button secondary w-fit">
          <BookOpen size={18} />
          牌义校对
        </Link>
      </div>
      <h1 className="mb-3 text-3xl font-black">雷诺曼知识库</h1>
      <p className="mb-6 max-w-3xl leading-8 text-[var(--muted)]">
        这里的内容会和 docs/knowledge 里的 Markdown 一起提供给 AI，用来贴近你的牌义体系和写作风格。
      </p>

      {params.message ? (
        <div className="mb-4 rounded-lg border border-[rgba(47,118,109,0.28)] bg-[rgba(47,118,109,0.08)] p-4 text-sm font-bold text-[var(--jade)]">
          {params.message}
        </div>
      ) : null}

      <section className="panel mb-6 p-5">
        <h2 className="mb-4 text-xl font-black">新增知识条目</h2>
        <form action={createKnowledgeAction} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
            <label>
              <span className="label">类型</span>
              <select className="field" name="type" defaultValue="牌义">
                <option value="牌义">牌义</option>
                <option value="组合">组合</option>
                <option value="流程">流程</option>
                <option value="风格">风格</option>
                <option value="案例">案例</option>
              </select>
            </label>
            <label>
              <span className="label">标题</span>
              <input className="field" name="title" placeholder="例如：心 + 戒指的关系表达" />
            </label>
          </div>
          <label>
            <span className="label">正文</span>
            <textarea className="field min-h-48" name="body" placeholder="粘贴你的释义、规则、案例或风格说明。" />
          </label>
          <button className="button w-fit" type="submit">
            <Plus size={18} />
            保存条目
          </button>
        </form>
      </section>

      <section className="mb-6 grid gap-3">
        <h2 className="text-xl font-black">后台条目</h2>
        {entries.length === 0 ? (
          <div className="panel p-5 text-[var(--muted)]">还没有后台知识条目。</div>
        ) : (
          entries.map((entry) => (
            <article key={entry.id} className="panel grid gap-3 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-[var(--jade)]">{entry.type}</p>
                  <h3 className="text-lg font-black">{entry.title}</h3>
                </div>
                <form action={deleteKnowledgeAction}>
                  <input type="hidden" name="id" value={entry.id} />
                  <button className="button danger !min-h-9 !px-3 !py-2" type="submit">
                    <Trash2 size={16} />
                  </button>
                </form>
              </div>
              <p className="reading-text text-sm leading-7 text-[var(--muted)]">{entry.body}</p>
            </article>
          ))
        )}
      </section>

      <section className="grid gap-3">
        <h2 className="text-xl font-black">Markdown 文件</h2>
        {docs.map((doc) => (
          <article key={doc.file} className="panel p-5">
            <p className="text-sm font-bold text-[var(--muted)]">docs/knowledge/{doc.file}</p>
            <h3 className="mt-1 text-lg font-black">{doc.title}</h3>
            <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
              已收录 {doc.headings.length} 个标题节点。
            </p>
          </article>
        ))}
      </section>
    </main>
  );
}
