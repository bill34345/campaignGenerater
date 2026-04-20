# Ingestion And Canon Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-file upload and single-winner canon workflow with a batch ingestion workbench and a canon composer that preserves evidence while letting the GM create the final canonical summary.

**Architecture:** Split ingestion into two phases: staged import batches for review and a processing phase that turns approved staged files into `SourceDocument`, `DocumentChunk`, and candidate `CanonFact` records. Split canon into two layers: candidate facts remain evidence, while new canonical entry records hold the GM-approved truth assembled from one or more candidates. Add a projection helper so canonical entries can feed the existing town, NPC, faction, and delta-aware context builder shape. Quest context and generation must read the canonical layer first, not raw candidate status.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind CSS, Prisma + SQLite, Zod, Vitest, Playwright

---

## File Structure

### Modify

- `prisma/schema.prisma`
  - add staged import batch models and canonical resolution models
- `src/types/domain.ts`
  - add Zod schemas for import batches, staged files, canonical entries, composer payloads
- `src/app/campaigns/[campaignId]/page.tsx`
  - replace the current upload strip with a workbench entry card and richer ingestion summary
- `src/app/api/campaigns/[campaignId]/documents/route.ts`
  - stop acting as the direct file-processing endpoint, or narrow it to compatibility-only behavior
- `src/app/api/campaigns/[campaignId]/canon/route.ts`
  - return candidate groups plus canonical entries and composer metadata
- `src/app/api/campaigns/[campaignId]/quests/route.ts`
  - read canonical entries during working-context assembly and draft generation
- `src/lib/canon/merge.ts`
  - stop normalizing to a single active candidate, emit candidate groups suitable for composition
- `src/lib/canon/context-projection.ts`
  - project canonical entries and linked evidence into a context-builder-friendly read shape
- `src/lib/canon/context-builder.ts`
  - prefer canonical entries, fall back to reviewed candidate facts only where needed
- `src/lib/i18n/messages.ts`
  - add copy for import workbench, import result summary, and canon composer flows
- `src/components/canon/canon-review-table.tsx`
  - replace single-row status toggles with candidate selection, composition launch, and canonical result display
- `tests/e2e/support/workbench.ts`
  - add helpers for staged import batches and canon composer flows
- `tests/unit/documents-route.test.ts`
  - update or retire direct-upload assumptions
- `tests/unit/canon-route.test.ts`
  - update route expectations for candidate groups, canonical entries, and composer metadata
- `tests/unit/canon-review-table.test.tsx`
  - update UI expectations from status toggles to composition workflow
- `tests/integration/quest-generation.test.ts`
  - verify quest generation reads canonical entries rather than raw candidate rows alone
- `tests/e2e/workflow/campaign-to-quest.spec.ts`
  - move to the new batch import and canonical entry flow
- `tests/e2e/workflow/chinese-materials.spec.ts`
  - cover mixed-source import plus merged canon draft behavior
- `tests/e2e/negative/invalid-upload.spec.ts`
  - assert staging validation and batch-level error handling

### Create

- `prisma/migrations/*`
  - schema migration for staged imports and canonical entries
- `src/app/campaigns/[campaignId]/imports/[batchId]/page.tsx`
  - import confirmation and processing page
- `src/app/campaigns/[campaignId]/imports/[batchId]/results/page.tsx`
  - post-processing summary page with CTA into canon inbox
- `src/app/api/campaigns/[campaignId]/imports/route.ts`
  - create staged import batches and upload staged files
- `src/app/api/campaigns/[campaignId]/imports/[batchId]/route.ts`
  - fetch/update batch metadata, file source types, and batch readiness state
- `src/app/api/campaigns/[campaignId]/imports/[batchId]/process/route.ts`
  - convert approved staged files into source documents, chunks, and candidate facts
- `src/app/api/campaigns/[campaignId]/canon/composer/route.ts`
  - generate a merged canon draft from selected candidate facts
- `src/app/api/campaigns/[campaignId]/canon/entries/route.ts`
  - persist the edited canonical entry plus evidence links
- `src/components/campaign/import-workbench-entry.tsx`
  - overview CTA, latest import batch status, and summary counts
- `src/components/import/import-dropzone.tsx`
  - drag-and-drop plus multi-file picker
- `src/components/import/import-batch-editor.tsx`
  - batch default source type and per-file overrides
- `src/components/import/import-results-summary.tsx`
  - success/failure/conflict/fact counts and next-step actions
- `src/components/canon/canon-composer-drawer.tsx`
  - selected candidates, evidence panel, auto-merged draft, editable final canon
- `src/lib/imports/source-type.ts`
  - source type constants, labels, and helpers
- `src/lib/imports/staging.ts`
  - save staged uploads to disk, checksum helpers, duplicate detection
- `src/lib/imports/process-batch.ts`
  - orchestrate staged-file processing into source documents and candidate facts
- `src/lib/canon/composer.ts`
  - draft merged canonical summaries from selected candidates
- `src/lib/canon/context-projection.ts`
  - adapt canonical entries into the context-builder read model
- `tests/unit/import-staging.test.ts`
  - staged file validation and batch source type behavior
- `tests/unit/import-process-batch.test.ts`
  - process orchestration, partial failure handling, and summary calculation
- `tests/unit/canon-composer.test.ts`
  - multi-candidate merge draft generation and evidence preservation
- `tests/integration/import-batch-routes.test.ts`
  - create/update/process batch route contracts
- `tests/integration/canon-entry-routes.test.ts`
  - compose/save canonical entry route contracts

---

## Assumptions

- The plan keeps `SourceDocument` as the processed evidence layer and adds a separate staged-import layer so users can confirm a batch before extraction starts.
- `CanonFact` remains the candidate evidence record produced by extraction. It is no longer the single source of truth for generation.
- The first version of the composer uses the existing provider configuration to draft merged canon text. If provider access is missing, the UI should still support manual merge via an empty editor state.
- Existing campaigns need an explicit migration path. Current `CanonFact.status === "active"` facts should be backfilled into canonical entries by an idempotent script or a one-time repair path, not by implication.

---

## Task 1: Add Staged Import And Canon Entry Schema

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/*`
- Test: `tests/unit/import-staging.test.ts`
- Test: `tests/unit/canon-composer.test.ts`

- [ ] **Step 1: Write the failing schema-oriented tests**

Add tests that describe the new shapes at the application boundary:

```ts
expect(importBatchSchema.parse({
  id: "batch_1",
  campaignId: "cmp_1",
  status: "staged",
  defaultSourceType: "official_module",
  files: [{
    id: "file_1",
    originalName: "chapter-1.pdf",
    sourceType: "official_module",
    status: "staged",
  }],
})).toBeTruthy();

expect(canonicalEntrySchema.parse({
  id: "canon_1",
  campaignId: "cmp_1",
  subject: "Father Lucian",
  factType: "npc_state",
  canonicalValue: "Alive, hiding relic evidence in the church cellar.",
  sourceFactIds: ["fact_a", "fact_b"],
})).toBeTruthy();
```

- [ ] **Step 2: Run the new unit tests to verify they fail**

Run: `pnpm vitest run tests/unit/import-staging.test.ts tests/unit/canon-composer.test.ts`

Expected: FAIL because the schemas and model assumptions do not exist yet.

- [ ] **Step 3: Update Prisma schema with the new persistence model**

Add these tables or equivalent names:

- `ImportBatch`
  - `id`, `campaignId`, `status`, `defaultSourceType`, `startedAt`, `completedAt`, `createdAt`, `updatedAt`
- `ImportBatchFile`
  - `id`, `importBatchId`, `campaignId`, `originalName`, `storedPath`, `mimeType`, `checksum`, `sizeBytes`, `sourceType`, `status`, `errorCode`, `errorMessage`, `createdAt`, `updatedAt`
- `CanonicalEntry`
  - `id`, `campaignId`, `subject`, `factType`, `canonicalValue`, `notes`, `createdAt`, `updatedAt`
- `CanonicalEntrySourceFact`
  - `canonicalEntryId`, `canonFactId`

Add the indexes and fields needed to support the current context-builder use cases cleanly:

- `CanonicalEntry @@index([campaignId, subject])`
- `CanonicalEntry @@index([campaignId, factType])`
- `CanonicalEntrySourceFact @@unique([canonicalEntryId, canonFactId])`

If the current `CanonFact`-shaped read path needs more than `subject`, `factType`, and `canonicalValue`, specify those supporting fields now rather than hiding them in a later refactor.

Also extend `SourceDocument` with fields that make the processed layer observable:

- `sourceType`
- `importBatchId`
- `processingStatus`
- `extractionError`

- [ ] **Step 4: Generate and inspect the migration**

Run: `pnpm prisma migrate dev --name ingestion_canon_workbench`

Expected: Prisma creates the migration and updates the local SQLite schema without manual drift.

- [ ] **Step 5: Add or update the application-level Zod schemas**

Implement matching Zod contracts in `src/types/domain.ts` for:

- `importBatchSchema`
- `importBatchFileSchema`
- `canonicalEntrySchema`
- `canonComposerRequestSchema`
- `canonComposerDraftSchema`

- [ ] **Step 6: Re-run the targeted unit tests**

Run: `pnpm vitest run tests/unit/import-staging.test.ts tests/unit/canon-composer.test.ts`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/types/domain.ts tests/unit/import-staging.test.ts tests/unit/canon-composer.test.ts
git commit -m "feat: add staged import and canonical entry schema"
```

---

## Task 2: Build Import Staging Domain Helpers

**Files:**
- Create: `src/lib/imports/source-type.ts`
- Create: `src/lib/imports/staging.ts`
- Modify: `src/lib/files/storage.ts`
- Test: `tests/unit/import-staging.test.ts`

- [ ] **Step 1: Extend the failing staging tests for the behavior**

Add tests for:

- allowed source types
- batch default inheritance
- per-file override
- checksum-based duplicate warnings
- unsupported file rejection before processing

- [ ] **Step 2: Run the staging tests**

Run: `pnpm vitest run tests/unit/import-staging.test.ts`

Expected: FAIL because the new helpers are not implemented.

- [ ] **Step 3: Implement source type constants**

In `src/lib/imports/source-type.ts`, add a narrow enum-like helper set:

```ts
export const SOURCE_TYPES = [
  "official_module",
  "gm_notes",
  "session_record",
  "custom_reference",
] as const;
```

Add UI labels for both locales in this file or a nearby i18n helper.

- [ ] **Step 4: Implement staged upload persistence helpers**

In `src/lib/imports/staging.ts`, implement helpers such as:

- `saveStagedImportFiles`
- `inferSourceType`
- `detectDuplicateStagedFiles`
- `summarizeImportBatchReadiness`

Store staged files separately from processed `SourceDocument` storage so a batch can be discarded cleanly before extraction.

- [ ] **Step 5: Reuse existing storage primitives where possible**

Refactor `src/lib/files/storage.ts` only enough to avoid duplicated checksum and file-save logic. Keep staging and processed storage paths explicit and separate.

- [ ] **Step 6: Re-run the staging tests**

Run: `pnpm vitest run tests/unit/import-staging.test.ts`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/imports/source-type.ts src/lib/imports/staging.ts src/lib/files/storage.ts tests/unit/import-staging.test.ts
git commit -m "feat: add import staging helpers"
```

---

## Task 3: Add Import Batch APIs

**Files:**
- Create: `src/app/api/campaigns/[campaignId]/imports/route.ts`
- Create: `src/app/api/campaigns/[campaignId]/imports/[batchId]/route.ts`
- Test: `tests/integration/import-batch-routes.test.ts`

- [ ] **Step 1: Write the failing integration tests**

Cover these route contracts:

- create a staged batch from multiple files
- apply batch default source type
- update per-file source type
- reject unsupported files and oversize uploads
- return a batch summary payload shaped for the confirmation UI

- [ ] **Step 2: Run the integration test file**

Run: `pnpm vitest run tests/integration/import-batch-routes.test.ts`

Expected: FAIL because the routes do not exist.

- [ ] **Step 3: Implement `POST /api/campaigns/[campaignId]/imports`**

Accept a multipart payload with multiple files and `defaultSourceType`.

Return:

```json
{
  "batch": {
    "id": "batch_123",
    "status": "staged",
    "defaultSourceType": "official_module",
    "files": [...]
  }
}
```

- [ ] **Step 4: Implement `GET/PATCH /api/campaigns/[campaignId]/imports/[batchId]`**

Support:

- reading staged batch details
- updating batch default source type
- updating per-file `sourceType`
- removing staged files from the batch

- [ ] **Step 5: Preserve explicit error behavior**

Keep the API loud, not magical:

- unsupported file types return visible validation errors
- unreadable staged files return visible file-level errors
- duplicate warnings are warnings, not auto-deletions

- [ ] **Step 6: Re-run the integration tests**

Run: `pnpm vitest run tests/integration/import-batch-routes.test.ts`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/app/api/campaigns/[campaignId]/imports/route.ts src/app/api/campaigns/[campaignId]/imports/[batchId]/route.ts tests/integration/import-batch-routes.test.ts
git commit -m "feat: add import batch routes"
```

---

## Task 4: Build The Import Workbench UI

**Files:**
- Modify: `src/app/campaigns/[campaignId]/page.tsx`
- Create: `src/app/campaigns/[campaignId]/imports/[batchId]/page.tsx`
- Create: `src/components/campaign/import-workbench-entry.tsx`
- Create: `src/components/import/import-dropzone.tsx`
- Create: `src/components/import/import-batch-editor.tsx`
- Modify: `src/components/campaign/document-upload-form.tsx` or replace its usage entirely
- Test: `tests/e2e/negative/invalid-upload.spec.ts`

- [ ] **Step 1: Update or add failing browser coverage**

Cover:

- selecting multiple files in one action
- applying a batch default source type
- overriding a single file source type
- seeing staged file warnings before processing

- [ ] **Step 2: Run the focused E2E negative test**

Run: `pnpm playwright test tests/e2e/negative/invalid-upload.spec.ts`

Expected: FAIL because the new staging UI and flow are not present.

- [ ] **Step 3: Replace the overview upload strip with a workbench entry**

In `src/app/campaigns/[campaignId]/page.tsx`, replace the current inline upload form with:

- latest import batch summary
- CTA to start a new import batch
- processed file counts that are not clipped to the latest 5 records

Fix the existing top-card count bug by querying true totals, not limited arrays.

- [ ] **Step 4: Build the batch confirmation page**

The new page must show:

- dropzone / file picker
- staged file cards
- batch default source type selector
- per-file source type selector
- remove-file action
- disabled `Start extraction` until the batch is valid

- [ ] **Step 5: Keep the first-time user path obvious**

Empty-state copy should explain:

- upload a batch
- confirm file source types
- start extraction
- review the batch result summary

- [ ] **Step 6: Re-run the focused E2E test**

Run: `pnpm playwright test tests/e2e/negative/invalid-upload.spec.ts`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/app/campaigns/[campaignId]/page.tsx src/app/campaigns/[campaignId]/imports/[batchId]/page.tsx src/components/campaign/import-workbench-entry.tsx src/components/import/import-dropzone.tsx src/components/import/import-batch-editor.tsx src/components/campaign/document-upload-form.tsx tests/e2e/negative/invalid-upload.spec.ts
git commit -m "feat: add import workbench UI"
```

---

## Task 5: Process Import Batches And Show Result Summaries

**Files:**
- Create: `src/app/api/campaigns/[campaignId]/imports/[batchId]/process/route.ts`
- Create: `src/lib/imports/process-batch.ts`
- Create: `src/app/campaigns/[campaignId]/imports/[batchId]/results/page.tsx`
- Create: `src/components/import/import-results-summary.tsx`
- Modify: `src/app/api/campaigns/[campaignId]/documents/route.ts`
- Test: `tests/unit/import-process-batch.test.ts`
- Test: `tests/integration/import-batch-routes.test.ts`

- [ ] **Step 1: Write failing processing tests**

Cover:

- converting staged files into `SourceDocument` and `DocumentChunk`
- preserving `sourceType` and `importBatchId`
- collecting per-file processing errors without silently losing the batch
- computing result summary fields such as success count, failure count, candidate fact count, and conflict count

- [ ] **Step 2: Run the import processing tests**

Run: `pnpm vitest run tests/unit/import-process-batch.test.ts tests/integration/import-batch-routes.test.ts`

Expected: FAIL because processing orchestration does not exist yet.

- [ ] **Step 3: Implement batch processing orchestration**

In `src/lib/imports/process-batch.ts`, orchestrate:

- text extraction per staged file
- source document creation
- chunk creation
- provider-backed fact extraction
- candidate `CanonFact` creation with `status: "uncertain"`
- batch and file status updates

Do not silently fake successful extraction if the provider fails.

- [ ] **Step 4: Implement the process route**

`POST /api/campaigns/[campaignId]/imports/[batchId]/process` should:

- validate batch state
- start processing once
- return the results-page URL or result payload

- [ ] **Step 5: Implement the results page**

Show:

- success/failure counts
- facts extracted
- conflict-heavy subjects to review first
- CTA to `Open canon inbox`
- CTA to `Import more files`

- [ ] **Step 6: Preserve backward compatibility intentionally**

Either:

- keep `documents/route.ts` as a compatibility wrapper that creates a one-file import batch, or
- remove its usage from the UI and test coverage, leaving only API compatibility if external callers depend on it

Be explicit in code comments about which path is chosen.

- [ ] **Step 7: Re-run the processing tests**

Run: `pnpm vitest run tests/unit/import-process-batch.test.ts tests/integration/import-batch-routes.test.ts`

Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/app/api/campaigns/[campaignId]/imports/[batchId]/process/route.ts src/lib/imports/process-batch.ts src/app/campaigns/[campaignId]/imports/[batchId]/results/page.tsx src/components/import/import-results-summary.tsx src/app/api/campaigns/[campaignId]/documents/route.ts tests/unit/import-process-batch.test.ts tests/integration/import-batch-routes.test.ts
git commit -m "feat: add import batch processing and results summary"
```

---

## Task 6: Add Canon Composer Domain And APIs

**Files:**
- Create: `src/lib/canon/composer.ts`
- Create: `src/app/api/campaigns/[campaignId]/canon/composer/route.ts`
- Create: `src/app/api/campaigns/[campaignId]/canon/entries/route.ts`
- Modify: `src/app/api/campaigns/[campaignId]/canon/route.ts`
- Modify: `src/lib/canon/merge.ts`
- Test: `tests/unit/canon-composer.test.ts`
- Test: `tests/integration/canon-entry-routes.test.ts`

- [ ] **Step 1: Expand the failing composer tests**

Cover:

- selecting multiple candidate facts from one fact group
- generating an auto-merged canonical draft
- preserving evidence and source fact ids
- saving a final canonical entry without deleting original candidates

- [ ] **Step 2: Run the composer tests**

Run: `pnpm vitest run tests/unit/canon-composer.test.ts tests/integration/canon-entry-routes.test.ts`

Expected: FAIL because the composer helpers and routes do not exist.

- [ ] **Step 3: Refactor `mergeCanonFacts` away from single-winner normalization**

Stop rewriting multiple active candidates into one winner. Emit candidate groups with:

- all candidates
- current canonical entry, if any
- conflict metadata
- selectable candidate ids

- [ ] **Step 4: Implement the composer helper**

In `src/lib/canon/composer.ts`, add helpers like:

- `buildCanonComposerDraft`
- `deriveCanonicalSummary`
- `validateCanonicalEntryDraft`

Behavior:

- if provider config is available, generate a draft merged summary
- otherwise return a blank editable value plus ordered evidence blocks

- [ ] **Step 5: Implement composer draft API**

`POST /api/campaigns/[campaignId]/canon/composer` should accept:

```json
{
  "subject": "Father Lucian",
  "factType": "npc_state",
  "selectedFactIds": ["fact_a", "fact_b"]
}
```

Return selected candidates, evidence snippets, and the auto-drafted canonical summary.

- [ ] **Step 6: Implement canonical entry save API**

`POST /api/campaigns/[campaignId]/canon/entries` should persist:

- final canonical summary
- selected source fact links
- optional editor notes

Do not delete or mutate the original candidate evidence beyond any explicit review-state updates you intentionally choose.

- [ ] **Step 7: Re-run the composer tests**

Run: `pnpm vitest run tests/unit/canon-composer.test.ts tests/integration/canon-entry-routes.test.ts`

Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/lib/canon/composer.ts src/app/api/campaigns/[campaignId]/canon/composer/route.ts src/app/api/campaigns/[campaignId]/canon/entries/route.ts src/app/api/campaigns/[campaignId]/canon/route.ts src/lib/canon/merge.ts tests/unit/canon-composer.test.ts tests/integration/canon-entry-routes.test.ts
git commit -m "feat: add canon composer domain and routes"
```

---

## Task 7: Rebuild Canon Review Into A Composition Workflow

**Files:**
- Modify: `src/app/campaigns/[campaignId]/canon/page.tsx`
- Modify: `src/components/canon/canon-review-table.tsx`
- Create: `src/components/canon/canon-composer-drawer.tsx`
- Test: `tests/e2e/workflow/chinese-materials.spec.ts`
- Test: `tests/e2e/workflow/campaign-to-quest.spec.ts`

- [ ] **Step 1: Extend the failing E2E workflow tests**

Cover:

- selecting multiple candidate facts
- launching the composer
- seeing an auto-generated merged draft
- editing the canonical summary
- saving it and seeing the canonical result on the review screen

- [ ] **Step 2: Run the two workflow tests**

Run: `pnpm playwright test tests/e2e/workflow/chinese-materials.spec.ts tests/e2e/workflow/campaign-to-quest.spec.ts`

Expected: FAIL because the current UI only exposes row-level status toggles.

- [ ] **Step 3: Replace row-level status buttons with candidate selection**

In `canon-review-table.tsx`, each fact group should support:

- checkbox selection per candidate
- current canonical summary card
- `Compose current canon` action
- evidence preview

- [ ] **Step 4: Build the composer drawer**

The drawer must show:

- selected candidate list
- per-candidate evidence and source file metadata
- auto-generated canonical draft in an editor
- save action

Keep the candidate evidence visible while editing. Do not collapse everything into one textarea with no provenance.

- [ ] **Step 5: Preserve fast review for simple cases**

If a fact group only has one good candidate, the reviewer can still promote it quickly, but the system should save it as a canonical entry, not just flip a candidate row into sole truth.

- [ ] **Step 6: Re-run the two workflow tests**

Run: `pnpm playwright test tests/e2e/workflow/chinese-materials.spec.ts tests/e2e/workflow/campaign-to-quest.spec.ts`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/app/campaigns/[campaignId]/canon/page.tsx src/components/canon/canon-review-table.tsx src/components/canon/canon-composer-drawer.tsx tests/e2e/workflow/chinese-materials.spec.ts tests/e2e/workflow/campaign-to-quest.spec.ts
git commit -m "feat: rebuild canon review as composition workflow"
```

---

## Task 8: Wire Canonical Entries Into Quest Generation And Finish Regression Coverage

**Files:**
- Modify: `src/app/api/campaigns/[campaignId]/quests/route.ts`
- Create: `src/lib/canon/context-projection.ts`
- Modify: `src/lib/canon/context-builder.ts`
- Modify: `src/app/campaigns/[campaignId]/quests/new/page.tsx`
- Modify: `src/components/quests/quest-request-form.tsx`
- Modify: `src/lib/i18n/messages.ts`
- Modify: `tests/e2e/support/workbench.ts`
- Test: `tests/integration/quest-generation.test.ts`
- Test: `tests/unit/canon-route.test.ts`
- Test: `tests/unit/canon-review-table.test.tsx`
- Test: `tests/unit/documents-route.test.ts`
- Test: `tests/unit/context-builder.test.ts`
- Test: `tests/e2e/workflow/campaign-to-quest.spec.ts`
- Test: `tests/e2e/workflow/chinese-materials.spec.ts`

- [ ] **Step 1: Write the failing context-builder assertions**

Add tests proving that:

- canonical entries are preferred over raw candidate rows
- evidence-linked canon still yields the same town/npc/faction context shape expected by quest generation
- missing canonical entries fall back safely to reviewed candidates for legacy campaigns
- the quest draft creation route reads canonical entries rather than only querying `CanonFact`
- old direct-upload and canon-review unit tests are either rewritten or explicitly retired

- [ ] **Step 2: Run the focused tests**

Run: `pnpm vitest run tests/unit/context-builder.test.ts && pnpm playwright test tests/e2e/workflow/campaign-to-quest.spec.ts tests/e2e/workflow/chinese-materials.spec.ts`

Expected: FAIL until the context builder and workflow helpers are updated.

- [ ] **Step 3: Add a canonical projection helper and update the quest route**

Create `src/lib/canon/context-projection.ts` so the canonical layer can be transformed into the read shape expected by `buildTownQuestContext`.

Update `src/app/api/campaigns/[campaignId]/quests/route.ts` so draft generation fetches canonical entries and linked evidence before calling the context builder. Do not leave the server route on the old raw-`CanonFact` path.

- [ ] **Step 4: Update the context builder**

Teach `src/lib/canon/context-builder.ts` to read from the canonical entry layer first. Preserve legacy compatibility for older campaigns until backfill is complete.

- [ ] **Step 5: Update the quest request UI and copy**

The request page should surface the selected town and working context based on finalized canon, not raw candidate status. Add or update message keys in `src/lib/i18n/messages.ts` for any new copy introduced by the import and canon-composer flow.

- [ ] **Step 6: Update E2E helpers and legacy tests**

Rewrite `tests/e2e/support/workbench.ts` to use:

- staged batch creation
- import confirmation
- result summary transition
- canon composition before quest generation

Update these existing tests so they fail for the right reason before implementation and pass after the refactor:

- `tests/unit/documents-route.test.ts`
- `tests/unit/canon-route.test.ts`
- `tests/unit/canon-review-table.test.tsx`
- `tests/integration/quest-generation.test.ts`

- [ ] **Step 7: Run the relevant verification set**

Run:

```bash
pnpm vitest run tests/unit/context-builder.test.ts tests/unit/import-staging.test.ts tests/unit/import-process-batch.test.ts tests/unit/canon-composer.test.ts tests/unit/documents-route.test.ts tests/unit/canon-route.test.ts tests/unit/canon-review-table.test.tsx tests/integration/import-batch-routes.test.ts tests/integration/canon-entry-routes.test.ts tests/integration/quest-generation.test.ts
pnpm playwright test tests/e2e/workflow/campaign-to-quest.spec.ts tests/e2e/workflow/chinese-materials.spec.ts tests/e2e/negative/invalid-upload.spec.ts
pnpm typecheck
pnpm lint
```

Expected: all pass

- [ ] **Step 8: Commit**

```bash
git add src/app/api/campaigns/[campaignId]/quests/route.ts src/lib/canon/context-projection.ts src/lib/canon/context-builder.ts src/app/campaigns/[campaignId]/quests/new/page.tsx src/components/quests/quest-request-form.tsx src/lib/i18n/messages.ts tests/e2e/support/workbench.ts tests/unit/context-builder.test.ts tests/unit/documents-route.test.ts tests/unit/canon-route.test.ts tests/unit/canon-review-table.test.tsx tests/integration/quest-generation.test.ts tests/e2e/workflow/campaign-to-quest.spec.ts tests/e2e/workflow/chinese-materials.spec.ts
git commit -m "feat: use canonical entries throughout quest generation"
```

---

## Task 9: Final Product And Migration Cleanup

**Files:**
- Modify: `src/app/campaigns/[campaignId]/page.tsx`
- Modify: `README.md`
- Modify: `ARCHITECTURE.md`
- Modify: `AGENTS.md`
- Create: `scripts/backfill-canonical-entries.ts` or equivalent idempotent repair script
- Test: `tests/e2e/smoke/app-shell.spec.ts`

- [ ] **Step 1: Add an explicit backfill path for legacy campaigns**

Choose one of:

- migration script that creates canonical entries from currently active candidate facts
- lazy backfill on first canon page load with an explicit one-time transaction

Prefer a dedicated idempotent script in `scripts/` for this repo. Document which option is chosen and why, and make sure the script can be safely re-run.

- [ ] **Step 2: Update product docs**

Reflect the new flow in:

- README workflow description
- architecture docs for staged imports and canonical entry layer
- AGENTS guidance so future agents do not regress to single-file or single-winner assumptions

- [ ] **Step 3: Run smoke coverage**

Run: `pnpm playwright test tests/e2e/smoke/app-shell.spec.ts`

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add README.md ARCHITECTURE.md AGENTS.md src/app/campaigns/[campaignId]/page.tsx tests/e2e/smoke/app-shell.spec.ts
git commit -m "docs: align workbench docs with ingestion and canon redesign"
```

---

## Risks And Checkpoints

- **Schema migration risk:** separating candidate and canonical layers touches the core data model. Verify legacy campaign behavior before switching quest generation fully to canonical entries.
- **Provider UX risk:** the composer auto-draft depends on campaign LLM settings. The manual-edit fallback must be usable without a configured provider.
- **Scope risk:** do not add timeline views, entity graphs, or AI auto-resolution in this pass.
- **Windows encoding risk:** fix or replace corrupted Chinese copy in touched files as part of the rewrite, especially in `src/components/canon/canon-review-table.tsx`, `src/components/quests/quest-request-form.tsx`, and related message sources.

## Suggested Execution Order

1. Task 1
2. Task 2
3. Task 3
4. Task 4
5. Task 5
6. Task 6
7. Task 7
8. Task 8
9. Task 9

## Definition Of Done

- Users can stage multiple files in one batch before extraction starts.
- Users can apply a batch default source type and override any file individually.
- Processing ends on a results summary page, not an abrupt redirect.
- Canon review supports selecting multiple candidates and composing one finalized canonical summary.
- Original candidate facts remain as evidence after canonical entry save.
- Quest generation reads finalized canon rather than relying on a single active candidate row.
- Targeted unit, integration, E2E, typecheck, and lint commands all pass.
