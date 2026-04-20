import type { QuestDraft } from "@/types/domain";
import { useLanguage } from "@/components/i18n/language-provider";

type GmPacketPreviewProps = {
  draft: Pick<
    QuestDraft,
    | "title"
    | "gmSummary"
    | "scenes"
    | "npcs"
    | "rewards"
    | "returnToMainPlot"
  >;
};

export function GmPacketPreview({ draft }: GmPacketPreviewProps) {
  const { messages: m } = useLanguage();

  return (
    <section
      data-testid="gm-packet-preview"
      className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6"
    >
      <div className="border-b border-slate-800 pb-4">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
          {m.gmPreview.eyebrow}
        </p>
        <h2 className="mt-3 text-2xl font-semibold text-white">
          {m.gmPreview.title}
        </h2>
        <p className="mt-2 text-lg font-semibold text-slate-100">{draft.title}</p>
      </div>

      <div className="mt-6 space-y-6">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
            {m.gmPreview.sections.summary}
          </h3>
          <p className="mt-2 text-sm leading-7 text-slate-300">{draft.gmSummary}</p>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
            {m.gmPreview.sections.sceneList}
          </h3>
          <ol className="mt-3 space-y-3">
            {draft.scenes.map((scene, index) => (
              <li
                key={`${scene.name}-${index}`}
                className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4"
              >
                <p className="font-semibold text-slate-100">{scene.name}</p>
                <p className="mt-1 text-sm text-slate-400">{scene.summary}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.15em] text-cyan-300">
                  {scene.location}
                </p>
              </li>
            ))}
          </ol>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
            {m.gmPreview.sections.npcList}
          </h3>
          <ul className="mt-3 space-y-3">
            {draft.npcs.map((npc, index) => (
              <li
                key={`${npc.name}-${index}`}
                className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4"
              >
                <p className="font-semibold text-slate-100">{npc.name}</p>
                <p className="mt-1 text-sm text-slate-400">{npc.role}</p>
                <p className="mt-2 text-xs text-slate-500">{npc.motivation}</p>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
            {m.gmPreview.sections.rewards}
          </h3>
          <ul className="mt-3 space-y-3">
            {draft.rewards.map((reward, index) => (
              <li
                key={`${reward.type}-${index}`}
                className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4"
              >
                <p className="font-semibold text-slate-100">{reward.type}</p>
                <p className="mt-1 text-sm text-slate-400">{reward.value}</p>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
            {m.gmPreview.sections.returnPath}
          </h3>
          <p className="mt-2 text-sm leading-7 text-slate-300">
            {draft.returnToMainPlot}
          </p>
        </div>
      </div>
    </section>
  );
}
