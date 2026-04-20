import Link from "next/link";
import { CampaignForm } from "@/components/campaign/campaign-form";
import { getMessages, getRequestLocale } from "@/lib/i18n/translate";

export default async function NewCampaignPage() {
  const locale = await getRequestLocale();
  const m = getMessages(locale);

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
              {m.campaignNew.eyebrow}
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">
              {m.campaignNew.title}
            </h1>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              {m.campaignNew.description}
            </p>
          </div>
          <Link
            href="/"
            className="rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
          >
            {m.shared.backHome}
          </Link>
        </div>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <CampaignForm />

          <aside className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-300">
              {m.campaignNew.checklistTitle}
            </p>
            <ul className="mt-4 space-y-4 text-sm leading-7 text-slate-300">
              <li>{m.campaignNew.checklist.system}</li>
              <li>{m.campaignNew.checklist.tone}</li>
              <li>{m.campaignNew.checklist.level}</li>
              <li>{m.campaignNew.checklist.constraints}</li>
            </ul>
          </aside>
        </section>
      </div>
    </main>
  );
}
