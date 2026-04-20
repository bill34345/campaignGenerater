import Link from "next/link";
import { getMessages, getRequestLocale } from "@/lib/i18n/translate";

export default async function HomePage() {
  const locale = await getRequestLocale();
  const m = getMessages(locale);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-6 py-20">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
          {m.home.eyebrow}
        </p>
        <h1 className="mt-4 max-w-3xl text-5xl font-semibold tracking-tight text-white sm:text-6xl">
          {m.home.title}
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
          {m.home.description}
        </p>
        <div className="mt-10 flex flex-wrap gap-4">
          <Link
            href="/campaigns/new"
            data-testid="home-start-campaign"
            className="rounded-full bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
          >
            {m.home.primaryCta}
          </Link>
          <a
            href="#workflow"
            className="rounded-full border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-slate-500 hover:bg-slate-900"
          >
            {m.home.secondaryCta}
          </a>
        </div>
      </section>
      <section
        id="workflow"
      className="mx-auto grid w-full max-w-5xl gap-6 px-6 pb-20 pt-2 sm:grid-cols-3"
      >
        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
            {m.home.workflow.ingestTitle}
          </p>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            {m.home.workflow.ingestText}
          </p>
        </div>
        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
            {m.home.workflow.reviewTitle}
          </p>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            {m.home.workflow.reviewText}
          </p>
        </div>
        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
            {m.home.workflow.draftTitle}
          </p>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            {m.home.workflow.draftText}
          </p>
        </div>
      </section>
      <section
        id="campaign-starter"
        className="mx-auto w-full max-w-5xl px-6 pb-24"
      >
        <div className="rounded-3xl border border-cyan-500/20 bg-cyan-500/5 p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
            {m.home.starterEyebrow}
          </p>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
            {m.home.starterDescription}
          </p>
        </div>
      </section>
    </main>
  );
}
