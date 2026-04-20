import Link from "next/link";
import { db } from "@/lib/db";
import { QuestEditor } from "@/components/quests/quest-editor";
import { toQuestDraftRecord } from "@/lib/quests/draft-record";
import { getMessages, getRequestLocale } from "@/lib/i18n/translate";

type QuestDraftPageProps = {
  params: Promise<{
    campaignId: string;
    questId: string;
  }>;
};

export default async function QuestDraftPage({ params }: QuestDraftPageProps) {
  const locale = await getRequestLocale();
  const m = getMessages(locale);
  const { campaignId, questId } = await params;

  const draftRecord = await db.questDraft.findFirst({
    where: {
      id: questId,
      campaignId,
    },
  });

  if (!draftRecord) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
        <div className="mx-auto max-w-4xl rounded-3xl border border-red-500/30 bg-red-500/10 p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-red-300">
            {m.campaignOverview.notFound.eyebrow}
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">
            {m.campaignOverview.notFound.title}
          </h1>
          <p className="mt-4 text-sm leading-7 text-slate-300">
            {m.campaignOverview.notFound.description}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={`/campaigns/${campaignId}/quests/new`}
              className="rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
            >
              {m.shared.requestQuest}
            </Link>
            <Link
              href={`/campaigns/${campaignId}`}
              className="rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
            >
              {m.shared.backToOverview}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const draft = toQuestDraftRecord(draftRecord);

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
              {m.questEditor.eyebrow}
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">
              {draft.title}
            </h1>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              {m.questEditor.description}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/campaigns/${campaignId}`}
              className="rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
            >
              {m.shared.backToOverview}
            </Link>
            <Link
              href={`/campaigns/${campaignId}/quests/new`}
              className="rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
            >
              {m.shared.requestQuest}
            </Link>
          </div>
        </div>

        <div className="mt-8">
          <QuestEditor
            campaignId={campaignId}
            questId={questId}
            initialDraft={draft}
          />
        </div>
      </div>
    </main>
  );
}
