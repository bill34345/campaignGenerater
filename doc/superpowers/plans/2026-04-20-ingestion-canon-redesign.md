# Ingestion Workbench And Canon Composer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign campaign ingestion into a staged batch workbench and redesign canon review into a composer flow that merges multiple candidate facts into a user-edited final canon while preserving evidence.

**Architecture:** Split ingestion into explicit batch records plus per-file staging state instead of single-shot upload/extract. Split canon into two layers: extracted candidate evidence (`CanonFact`) and resolved canon records consumed by quest context, with provider-backed merge drafting as a separate operation.

**Tech Stack:** Next.js App Router, Prisma + SQLite, Zod, existing `src/lib/llm/` provider adapters, Vitest, Playwright.

---

## Existing Files That Must Change

### Batch ingestion workbench

- `prisma/schema.prisma`
  Add ingestion batch state and source classification fields; likely add new canon resolution models here too.
- `src/types/domain.ts`
  Add source-type enums/schemas, ingestion batch DTOs, canon resolution/composer schemas, and request/response payloads for new routes.
- `src/app/campaigns/[campaignId]/page.tsx`
  Replace the inline single-file uploader with a launcher and summary cards for staged batches / latest import results.
- `src/components/campaign/document-upload-form.tsx`
  Either replace entirely or shrink into a file-drop primitive used by the new workbench; current single-file submit flow should not remain the main entry.
- `src/app/api/campaigns/[campaignId]/documents/route.ts`
  Current route is single-file, synchronous, and LLM-blocked. Either retire it or turn it into a compatibility wrapper around batch creation + processing services.
- `src/lib/files/storage.ts`
  Support staged uploads, abandoned-batch cleanup, and stable mapping from stored file to batch/document state.
- `src/lib/files/extract-text.ts`
  Keep extraction logic, but move orchestration out so it can run per-file inside batch processing.
- `src/lib/files/chunk.ts`
  No behavioral rewrite expected, but batch processing will reuse it from a new orchestration layer.
- `src/lib/i18n/messages.ts`
  Add copy for staging, per-batch defaults, per-file overrides, validation, result summary, and follow-up actions.

### Canon composer

- `src/app/campaigns/[campaignId]/canon/page.tsx`
  Change from table-first review to candidate inbox + composer surface.
- `src/components/canon/canon-review-table.tsx`
  Replace single-row status buttons with multi-select candidate picking, composer launch, and resolution display.
- `src/app/api/campaigns/[campaignId]/canon/route.ts`
  Expand GET payload beyond grouped candidates; PATCH contract cannot stay `factId + status` if final canon is a separate layer.
- `src/lib/canon/merge.ts`
  Stop pretending one `CanonFact.status === active` is the final truth. Keep grouping/conflict detection for candidate evidence only.
- `src/lib/canon/context-builder.ts`
  Switch quest context to resolved canon records instead of raw `CanonFact` rows marked active.
- `src/app/api/campaigns/[campaignId]/quests/route.ts`
  Read resolved canon from the new source of truth so quest generation does not bypass the composer.
- `src/lib/llm/provider-types.ts`
  Add a provider operation for drafting merged canon from selected candidate facts.
- `src/lib/llm/provider-resolver.ts`
  Wire the new provider operation through the shared adapter boundary.
- `src/lib/llm/providers/openai-responses.ts`
- `src/lib/llm/providers/openai-chat.ts`
- `src/lib/llm/providers/anthropic.ts`
  Each adapter will need the canon-merge drafting method if the auto-draft stays provider-backed.
- `src/lib/i18n/messages.ts`
  Add composer labels, evidence copy, merge errors, and save states.

### Downstream and shared test/support surface

- `tests/e2e/support/workbench.ts`
  Add helpers for batch upload, batch confirmation, result summary navigation, candidate multi-select, and composer save.
- `tests/unit/domain-schema.test.ts`
  Update for new enums and composer DTOs.
- `tests/unit/documents-route.test.ts`
  Replace or reduce once the single-file route is no longer primary.
- `tests/unit/canon-route.test.ts`
  Replace/update for composer draft/save APIs.
- `tests/unit/canon-review-table.test.tsx`
  Replace/update for multi-select and composer UI.
- `tests/unit/context-builder.test.ts`
  Verify only resolved canon feeds quest context.
- `tests/e2e/workflow/campaign-to-quest.spec.ts`
  Update full path to batch ingestion + composer before quest generation.
- `tests/e2e/workflow/chinese-materials.spec.ts`
  Update for source typing and composer UX in Chinese flow.
- `tests/e2e/negative/invalid-upload.spec.ts`
  Update for staged validation and batch-level failures.

## Likely New Files

### Pages and routes

- `src/app/campaigns/[campaignId]/ingestion/page.tsx`
  Batch ingestion workbench entry page.
- `src/app/campaigns/[campaignId]/ingestion/[batchId]/page.tsx`
  Batch confirmation / result summary page, or split into nested `confirm` and `results` pages.
- `src/app/api/campaigns/[campaignId]/ingestion-batches/route.ts`
  Create batch from multiple uploaded files plus batch default source type.
- `src/app/api/campaigns/[campaignId]/ingestion-batches/[batchId]/route.ts`
  Fetch batch state and patch per-file source overrides / removals.
- `src/app/api/campaigns/[campaignId]/ingestion-batches/[batchId]/process/route.ts`
  Confirm and process the batch, file by file.
- `src/app/api/campaigns/[campaignId]/canon/composer/draft/route.ts`
  Generate the merged canon draft from selected candidate fact IDs.
- `src/app/api/campaigns/[campaignId]/canon/composer/route.ts`
  Persist the final canon resolution plus evidence links.

### Components

- `src/components/campaign/ingestion-workbench.tsx`
- `src/components/campaign/ingestion-batch-table.tsx`
- `src/components/campaign/ingestion-result-summary.tsx`
- `src/components/campaign/source-type-select.tsx`
- `src/components/canon/canon-composer.tsx`
- `src/components/canon/canon-candidate-list.tsx`
- `src/components/canon/canon-resolution-card.tsx`

### Libraries

- `src/lib/ingestion/batch-schema.ts`
  Zod schemas for batch create/update/process payloads and result summaries.
- `src/lib/ingestion/batch-run.ts`
  Orchestrate staged file validation, extraction, chunking, fact extraction, and per-file status updates.
- `src/lib/ingestion/result-summary.ts`
  Aggregate batch success/failure/conflict counts for the result page.
- `src/lib/canon/composer-schema.ts`
  Zod schema for provider-generated merge draft and persisted final canon payloads.
- `src/lib/canon/composer.ts`
  Build provider prompt input from selected candidates and normalize draft/save operations.
- `src/lib/canon/resolution-query.ts`
  Shared read model for canon page and quest context.
- `tests/unit/ingestion-batches-route.test.ts`
- `tests/unit/ingestion-batch-process-route.test.ts`
- `tests/unit/canon-composer.test.ts`
- `tests/unit/canon-composer-route.test.ts`
- `tests/e2e/workflow/batch-ingestion-workbench.spec.ts`
- `tests/e2e/workflow/canon-composer.spec.ts`

## Data Model Changes

- Add `IngestionBatch` model.
  Fields likely needed: `id`, `campaignId`, `defaultSourceType`, `status`, `createdAt`, `updatedAt`, `startedAt`, `completedAt`.
- Extend `SourceDocument`.
  Add `ingestionBatchId`, `sourceType`, `ingestionStatus`, `extractionStatus`, `extractionError`, `factCount`.
- Keep `DocumentChunk` as-is unless page/section provenance needs expansion.
- Keep `CanonFact` as extracted candidate evidence, not final truth.
  Fields likely needed: `sourceTypeSnapshot` or `ingestionBatchId` for better review context; current `status` should become candidate-review state only, or be deprecated from downstream reads.
- Add resolved canon model, likely `CanonResolution` or `CanonEntry`.
  Fields likely needed: `id`, `campaignId`, `subject`, `factType`, `value`, `draftValue`, `status`, `createdAt`, `updatedAt`, `generationProvider`, `generationModel`.
- Add join model, likely `CanonResolutionSource`.
  Fields likely needed: `canonResolutionId`, `canonFactId`, optional `sortOrder`.
- Backfill rule required.
  Existing `CanonFact.status === active` rows need migration into initial resolved canon rows so current campaigns still generate quests correctly.

## API Changes

- Replace single-file POST semantics with staged batch APIs.
  `POST /api/campaigns/[campaignId]/documents` should not remain the primary workflow.
- New batch create API should accept multiple files plus `defaultSourceType`.
- New batch patch API should support per-file `sourceType` override, file removal, and possibly duplicate handling before processing.
- New batch process API should:
  save progress per file, keep extraction failures visible, and return a batch summary payload instead of one `sourceDocument + canonFacts` tuple.
- `GET /api/campaigns/[campaignId]/canon` should return:
  candidate groups, current resolved canon, and conflict metadata needed to seed the composer.
- New composer draft API should accept:
  `candidateFactIds[]`, optional operator note, and locale.
- New composer save API should accept:
  `subject`, `factType`, `candidateFactIds[]`, provider-drafted text, user-edited final text, and replacement behavior for previous canon resolution.
- `POST /api/campaigns/[campaignId]/quests` should query resolved canon, not rely on `CanonFact.status === active`.

## Tests To Add Or Update

### Unit / integration

- Update `tests/unit/domain-schema.test.ts`
  Cover `sourceType`, ingestion batch DTOs, composer draft/save schemas, and resolved canon schemas.
- Replace or split `tests/unit/documents-route.test.ts`
  Cover batch creation and batch processing separately.
- Add `tests/unit/ingestion-batches-route.test.ts`
  Validate multi-file payload parsing, default source type, and per-file override patching.
- Add `tests/unit/ingestion-batch-process-route.test.ts`
  Verify per-file success/failure accounting and visible extraction errors.
- Add `tests/unit/canon-composer-route.test.ts`
  Verify merge-draft generation request, invalid candidate selection, and save behavior.
- Add `tests/unit/canon-composer.test.ts`
  Verify selected candidates become provider input and that saved canon preserves evidence links.
- Update `tests/unit/canon-review-table.test.tsx`
  Cover multi-select, composer open/close, and disabled states during save.
- Update `tests/unit/context-builder.test.ts`
  Ensure only resolved canon records appear in working context.
- Add `tests/integration/canon-resolution-query.test.ts`
  Verify grouped candidates + current canon read model for the canon page.

### E2E

- Add `tests/e2e/workflow/batch-ingestion-workbench.spec.ts`
  Drag/select multiple files, apply batch default source type, override one file, confirm processing, inspect result summary.
- Add `tests/e2e/workflow/canon-composer.spec.ts`
  Select multiple candidates, auto-draft merge, edit final text, save, and verify the new canon appears.
- Update `tests/e2e/workflow/campaign-to-quest.spec.ts`
  Full path should go through batch ingestion and composer before quest generation.
- Update `tests/e2e/workflow/chinese-materials.spec.ts`
  Exercise Chinese copy, source typing, and composer save.
- Update `tests/e2e/negative/invalid-upload.spec.ts`
  Cover invalid file inside a batch and failed processing summary.
- Update `tests/e2e/support/workbench.ts`
  Add helper methods instead of encoding the old single-file upload path everywhere.

## Biggest Technical Risks

- **Candidate evidence vs final canon split**
  Today `CanonFact` is both candidate and source of truth. Separating those concerns without breaking `buildTownQuestContext` and quest generation is the highest-risk refactor.
- **Migration / backfill**
  Existing campaigns only have `CanonFact.status`. A migration must create initial resolved canon rows or old campaigns will lose generation context.
- **Batch staging lifecycle**
  Staged uploads introduce orphaned files, abandoned batches, and cleanup rules that do not exist today.
- **Provider interface expansion**
  Auto-drafting merged canon adds a third provider-backed workflow beyond fact extraction and quest generation. All adapters and mocks must stay consistent.
- **LLM settings gating**
  The new UX wants "upload first, process after confirmation." The current system blocks at upload time when no API key exists. That gate must move without creating silent extraction failure.
- **I18n churn on a noisy file**
  `src/lib/i18n/messages.ts` already has encoding damage. Large copy additions there are risky until the file is stabilized or split.

## Recommended Implementation Order

- [ ] Land Prisma + Zod changes for ingestion batches and canon resolutions first.
- [ ] Add batch APIs and orchestration under `src/lib/ingestion/`.
- [ ] Build ingestion workbench UI and result summary page.
- [ ] Add canon resolution read model and composer APIs.
- [ ] Replace canon page UI with candidate multi-select + composer.
- [ ] Switch quest context reads from candidate facts to resolved canon.
- [ ] Update Vitest and Playwright coverage around the new primary flow.
