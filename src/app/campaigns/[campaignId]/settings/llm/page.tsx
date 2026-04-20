import Link from "next/link";
import { db } from "@/lib/db";
import { LlmSettingsForm } from "@/components/campaign/llm-settings-form";
import { getLlmSettingsCopy } from "@/lib/i18n/llm-copy";
import { getRequestLocale } from "@/lib/i18n/translate";
import { llmProviderSchema } from "@/types/domain";

type CampaignLlmSettingsPageProps = {
  params: Promise<{
    campaignId: string;
  }>;
};

export default async function CampaignLlmSettingsPage({
  params,
}: CampaignLlmSettingsPageProps) {
  const locale = await getRequestLocale();
  const copy = getLlmSettingsCopy(locale);
  const { campaignId } = await params;

  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    select: {
      id: true,
      name: true,
      llmProvider: true,
      llmApiKey: true,
      llmModel: true,
      llmBaseUrl: true,
    },
  });

  if (!campaign) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
        <div className="mx-auto max-w-4xl rounded-3xl border border-red-500/30 bg-red-500/10 p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-300">
            {copy.settingsNotFoundEyebrow}
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">
            {copy.settingsNotFoundTitle}
          </h1>
          <p className="mt-4 text-sm leading-7 text-slate-300">
            {copy.settingsNotFoundDescription}
          </p>
          <div className="mt-6">
            <Link
              href="/campaigns/new"
              className="rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
            >
              {copy.backToOverview}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
              {copy.settingsPageTitle}
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">
              {campaign.name}
            </h1>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              {copy.settingsPageDescription}
            </p>
          </div>
          <Link
            href={`/campaigns/${campaignId}`}
            className="rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-slate-500 hover:bg-slate-900"
          >
            {copy.backToOverview}
          </Link>
        </div>

        <div className="mt-8">
          <LlmSettingsForm
            campaignId={campaignId}
            initialSettings={{
              llmProvider: llmProviderSchema.parse(campaign.llmProvider),
              llmApiKey: campaign.llmApiKey,
              llmModel: campaign.llmModel,
              llmBaseUrl: campaign.llmBaseUrl,
            }}
          />
        </div>
      </div>
    </main>
  );
}
