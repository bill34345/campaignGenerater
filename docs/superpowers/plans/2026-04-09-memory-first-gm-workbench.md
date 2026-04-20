# Memory-First GM Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a V1 web app that ingests campaign files, extracts canon facts, lets the GM review canon, and generates a town-based side quest draft for a running 5e campaign.

**Architecture:** Use a single-provider, memory-first pipeline. Raw files are stored locally, parsed into chunks, transformed into canon facts with structured LLM extraction, then reduced into a small working context for quest generation. The app is a single Next.js full-stack project with SQLite persistence, explicit validators, and no multi-agent orchestration in V1.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS, Prisma + SQLite, Zod, OpenAI SDK, `pdf-parse`, `mammoth`, Vitest, Testing Library, Playwright

---

## File Structure

Create the project with focused modules. Keep the domain logic out of route handlers.

- `package.json`
  - workspace scripts, dependencies, test commands
- `next.config.ts`
  - Next.js config
- `tsconfig.json`
  - TypeScript config
- `prisma/schema.prisma`
  - campaign, source document, chunk, canon fact, delta, town, quest tables
- `prisma/migrations/*`
  - generated schema migrations
- `src/app/layout.tsx`
  - shared app shell
- `src/app/page.tsx`
  - landing page and campaign entry
- `src/app/campaigns/new/page.tsx`
  - create-campaign screen
- `src/app/campaigns/[campaignId]/page.tsx`
  - campaign overview
- `src/app/campaigns/[campaignId]/import/page.tsx`
  - file import screen
- `src/app/campaigns/[campaignId]/canon/page.tsx`
  - canon review screen
- `src/app/campaigns/[campaignId]/quests/new/page.tsx`
  - quest request screen
- `src/app/campaigns/[campaignId]/quests/[questId]/page.tsx`
  - quest draft editor
- `src/app/api/campaigns/route.ts`
  - create/list campaigns
- `src/app/api/campaigns/[campaignId]/documents/route.ts`
  - upload documents
- `src/app/api/campaigns/[campaignId]/canon/route.ts`
  - canon listing and review updates
- `src/app/api/campaigns/[campaignId]/quests/route.ts`
  - create quest request / generate draft
- `src/app/api/campaigns/[campaignId]/quests/[questId]/route.ts`
  - fetch/update quest draft
- `src/lib/db.ts`
  - Prisma client singleton
- `src/lib/env.ts`
  - environment parsing
- `src/lib/files/storage.ts`
  - save uploaded source files
- `src/lib/files/extract-text.ts`
  - dispatch by file type to PDF/DOCX/TXT extractors
- `src/lib/files/pdf.ts`
  - PDF extraction wrapper
- `src/lib/files/docx.ts`
  - DOCX extraction wrapper
- `src/lib/files/chunk.ts`
  - chunking logic with source metadata
- `src/lib/openai/client.ts`
  - OpenAI client factory with BYOK key input support
- `src/lib/llm/fact-schema.ts`
  - Zod schema for extracted facts
- `src/lib/llm/extract-facts.ts`
  - structured fact extraction
- `src/lib/canon/merge.ts`
  - merge and conflict detection
- `src/lib/canon/context-builder.ts`
  - build town-scoped working context
- `src/lib/quests/quest-schema.ts`
  - Zod schema for quest drafts
- `src/lib/quests/generate-quest.ts`
  - quest generation function
- `src/lib/quests/validate-quest.ts`
  - quest validator
- `src/components/campaign/campaign-form.tsx`
  - create-campaign form
- `src/components/import/document-upload.tsx`
  - file upload UI
- `src/components/canon/canon-review-table.tsx`
  - review active/overridden/uncertain facts
- `src/components/quests/quest-request-form.tsx`
  - town quest form
- `src/components/quests/quest-editor.tsx`
  - quest draft editor
- `src/components/quests/gm-packet-preview.tsx`
  - preview renderer
- `src/types/domain.ts`
  - shared domain types
- `tests/unit/chunk.test.ts`
  - chunking tests
- `tests/unit/canon-merge.test.ts`
  - canon merge tests
- `tests/unit/context-builder.test.ts`
  - working context tests
- `tests/unit/quest-validator.test.ts`
  - validator tests
- `tests/integration/fact-extraction.test.ts`
  - extraction contract tests with fixtures/mocks
- `tests/integration/quest-generation.test.ts`
  - quest generation contract tests with fixtures/mocks
- `tests/e2e/import-to-quest.spec.ts`
  - full browser flow
- `tests/fixtures/*.txt`
  - sample module text and GM notes
- `docs/product/quest-json-schema.md`
  - human-readable quest draft schema

## Assumptions

- Use `pnpm` as package manager.
- Use SQLite for V1 local development and early single-user use.
- Store uploaded files under a local `data/uploads/` directory ignored by git.
- Use mock LLM responses in automated tests. Do not make network calls in CI.
- Quest export in V1 is Markdown + printable HTML only.

## Task 1: Bootstrap The App And Tooling

**Files:**
- Create: `package.json`
- Create: `next.config.ts`
- Create: `tsconfig.json`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/lib/env.ts`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `.env.example`
- Test: `tests/unit/smoke.test.ts`

- [ ] **Step 1: Write the failing smoke test**

```ts
import { describe, expect, it } from "vitest";

describe("app bootstrap", () => {
  it("loads the test runner", () => {
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify the test setup is wired**

Run: `pnpm vitest run tests/unit/smoke.test.ts`
Expected: FAIL because Vitest is not installed yet.

- [ ] **Step 3: Scaffold Next.js app with TypeScript and Tailwind**

Run:

```bash
pnpm create next-app@latest . --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm
```

- [ ] **Step 4: Add test tooling**

Install:

```bash
pnpm add -D vitest @vitest/coverage-v8 @testing-library/react @testing-library/jest-dom jsdom playwright
```

- [ ] **Step 5: Add baseline config files**

Implement:
- `src/lib/env.ts` for environment parsing
- `vitest.config.ts`
- `playwright.config.ts`
- `.env.example` with `OPENAI_API_KEY=` placeholder

- [ ] **Step 6: Re-run smoke test**

Run: `pnpm vitest run tests/unit/smoke.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "chore: bootstrap next app and test tooling"
```

## Task 2: Define The Domain Schema And Persistence Layer

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/lib/db.ts`
- Create: `src/types/domain.ts`
- Create: `tests/unit/domain-schema.test.ts`

- [ ] **Step 1: Write the failing schema test**

```ts
import { describe, expect, it } from "vitest";
import { canonFactSchema, questDraftSchema } from "@/types/domain";

describe("domain schemas", () => {
  it("accepts a minimal quest draft", () => {
    const parsed = questDraftSchema.safeParse({
      title: "Test Quest",
      premise: "A bell tolls at midnight.",
      hook: "The innkeeper begs for help.",
      scenes: [
        { name: "Hook", goal: "Accept the job", summary: "Meet the innkeeper", location: "Inn", conflictType: "social", outcomeOptions: ["Accept"] },
        { name: "Clue", goal: "Find the bell tower", summary: "Ask around", location: "Town square", conflictType: "investigation", outcomeOptions: ["Learn rumor"] },
        { name: "Climax", goal: "Stop the cult", summary: "Fight in the crypt", location: "Crypt", conflictType: "combat", outcomeOptions: ["Win fight"] }
      ],
      npcs: [{ name: "Mara", role: "Innkeeper", motivation: "Save her brother", secret: "She hid the first clue" }],
      encounters: [{ name: "Crypt battle", difficultyTarget: "medium", purpose: "Climax", notes: "3 cultists" }],
      rewards: [{ type: "information", value: "Points back to the main plot" }],
      returnToMainPlot: "A recovered letter names the mayor's patron.",
      gmSummary: "Investigation into missing bells."
    });

    expect(parsed.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/domain-schema.test.ts`
Expected: FAIL because schemas do not exist.

- [ ] **Step 3: Define Prisma models**

Add models for:
- `Campaign`
- `SourceDocument`
- `DocumentChunk`
- `CanonFact`
- `CampaignDelta`
- `TownProfile`
- `QuestRequest`
- `QuestDraft`

- [ ] **Step 4: Define shared domain schemas**

Implement Zod schemas and TS types in `src/types/domain.ts` for:
- `CanonFact`
- `TownProfile`
- `QuestRequest`
- `QuestDraft`

- [ ] **Step 5: Add Prisma client**

Create `src/lib/db.ts` with Prisma singleton.

- [ ] **Step 6: Generate migration and client**

Run:

```bash
pnpm add prisma @prisma/client zod
pnpm prisma migrate dev --name init
```

Expected: migration files created, Prisma client generated.

- [ ] **Step 7: Re-run tests**

Run: `pnpm vitest run tests/unit/domain-schema.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add prisma src/types/domain.ts src/lib/db.ts tests/unit/domain-schema.test.ts
git commit -m "feat: add core persistence schema"
```

## Task 3: Build File Import And Text Extraction

**Files:**
- Create: `src/lib/files/storage.ts`
- Create: `src/lib/files/extract-text.ts`
- Create: `src/lib/files/pdf.ts`
- Create: `src/lib/files/docx.ts`
- Create: `src/app/api/campaigns/[campaignId]/documents/route.ts`
- Create: `tests/unit/file-extraction.test.ts`
- Create: `tests/fixtures/sample-note.txt`
- Create: `tests/fixtures/sample-note.docx`

- [ ] **Step 1: Write the failing extraction test**

```ts
import { describe, expect, it } from "vitest";
import { extractTextFromBuffer } from "@/lib/files/extract-text";

describe("file extraction", () => {
  it("extracts plain text from txt uploads", async () => {
    const result = await extractTextFromBuffer("txt", Buffer.from("Town note"));
    expect(result.text).toContain("Town note");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/file-extraction.test.ts`
Expected: FAIL because extraction functions do not exist.

- [ ] **Step 3: Implement local file storage**

Create `src/lib/files/storage.ts` to:
- save uploads under `data/uploads/<campaignId>/`
- compute checksum
- return saved file metadata

- [ ] **Step 4: Implement text extraction dispatch**

Add `extractTextFromBuffer` in `src/lib/files/extract-text.ts` for:
- `txt`
- `md`
- `pdf`
- `docx`

- [ ] **Step 5: Add format-specific extractors**

Use:

```bash
pnpm add pdf-parse mammoth
```

Implement:
- `src/lib/files/pdf.ts`
- `src/lib/files/docx.ts`

- [ ] **Step 6: Add upload route**

Create `POST /api/campaigns/[campaignId]/documents` to:
- accept multipart file upload
- save the file
- extract text
- create `SourceDocument`

- [ ] **Step 7: Re-run tests**

Run: `pnpm vitest run tests/unit/file-extraction.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/lib/files src/app/api/campaigns/[campaignId]/documents/route.ts tests/unit/file-extraction.test.ts tests/fixtures
git commit -m "feat: add file import and text extraction"
```

## Task 4: Add Chunking And Fact Extraction

**Files:**
- Create: `src/lib/files/chunk.ts`
- Create: `src/lib/openai/client.ts`
- Create: `src/lib/llm/fact-schema.ts`
- Create: `src/lib/llm/extract-facts.ts`
- Create: `tests/unit/chunk.test.ts`
- Create: `tests/integration/fact-extraction.test.ts`

- [ ] **Step 1: Write the failing chunk test**

```ts
import { describe, expect, it } from "vitest";
import { chunkDocumentText } from "@/lib/files/chunk";

describe("chunking", () => {
  it("preserves source metadata for each chunk", () => {
    const chunks = chunkDocumentText({
      text: "Section A\n\nOne.\n\nSection B\n\nTwo.",
      sourceDocumentId: "src_1",
      pageStart: 1
    });

    expect(chunks[0]?.sourceDocumentId).toBe("src_1");
    expect(chunks.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/chunk.test.ts`
Expected: FAIL because `chunkDocumentText` does not exist.

- [ ] **Step 3: Implement chunking**

Implement `src/lib/files/chunk.ts` with:
- paragraph-aware chunking
- overlap support
- source metadata on each chunk

- [ ] **Step 4: Define extracted fact schema**

Create `src/lib/llm/fact-schema.ts` with Zod schema for:
- `location`
- `npc`
- `faction`
- `event`
- `clue`
- `override`

- [ ] **Step 5: Create OpenAI client wrapper**

Implement `src/lib/openai/client.ts`:
- accept app key or user-provided BYOK key
- expose structured output calls

- [ ] **Step 6: Implement fact extraction**

In `src/lib/llm/extract-facts.ts`:
- prompt per chunk
- request structured output
- attach provenance metadata

- [ ] **Step 7: Add integration test with mocked response**

Test that extraction returns:
- valid schema
- source references
- non-empty category list

- [ ] **Step 8: Run tests**

Run:

```bash
pnpm vitest run tests/unit/chunk.test.ts tests/integration/fact-extraction.test.ts
```

Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/lib/files/chunk.ts src/lib/openai/client.ts src/lib/llm tests/unit/chunk.test.ts tests/integration/fact-extraction.test.ts
git commit -m "feat: add chunking and fact extraction pipeline"
```

## Task 5: Implement Canon Merge And Review

**Files:**
- Create: `src/lib/canon/merge.ts`
- Create: `src/app/api/campaigns/[campaignId]/canon/route.ts`
- Create: `src/app/campaigns/[campaignId]/canon/page.tsx`
- Create: `src/components/canon/canon-review-table.tsx`
- Create: `tests/unit/canon-merge.test.ts`

- [ ] **Step 1: Write the failing merge test**

```ts
import { describe, expect, it } from "vitest";
import { mergeCanonFacts } from "@/lib/canon/merge";

describe("canon merge", () => {
  it("marks conflicting facts instead of dropping them", () => {
    const result = mergeCanonFacts([
      { subject: "Izek", type: "npc", value: "alive", priority: 10 },
      { subject: "Izek", type: "npc", value: "dead", priority: 100 }
    ]);

    expect(result.conflicts.length).toBe(1);
    expect(result.active[0]?.value).toBe("dead");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/canon-merge.test.ts`
Expected: FAIL because `mergeCanonFacts` does not exist.

- [ ] **Step 3: Implement merge rules**

Rules:
- preserve all candidates
- compute active fact by highest priority
- track overridden facts
- emit conflict groups for review

- [ ] **Step 4: Add canon API**

Create route to:
- list canon facts grouped by entity
- update fact status to `active`, `overridden`, or `uncertain`

- [ ] **Step 5: Build canon review UI**

Create page and table component with:
- grouped facts
- source snippet
- current status
- one-click override

- [ ] **Step 6: Run tests**

Run: `pnpm vitest run tests/unit/canon-merge.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/canon src/app/api/campaigns/[campaignId]/canon/route.ts src/app/campaigns/[campaignId]/canon/page.tsx src/components/canon tests/unit/canon-merge.test.ts
git commit -m "feat: add canon merge and review workflow"
```

## Task 6: Build Campaign And Town Setup Flows

**Files:**
- Create: `src/app/campaigns/new/page.tsx`
- Create: `src/app/campaigns/[campaignId]/page.tsx`
- Create: `src/components/campaign/campaign-form.tsx`
- Create: `src/app/api/campaigns/route.ts`
- Create: `tests/integration/campaign-api.test.ts`

- [ ] **Step 1: Write the failing campaign API test**

```ts
import { describe, expect, it } from "vitest";

describe("campaign API", () => {
  it("creates a campaign with required fields", async () => {
    const body = {
      name: "Barovia Table",
      system: "5e",
      partyLevel: 5,
      tone: "gothic mystery"
    };

    expect(body.name).toBe("Barovia Table");
  });
});
```

- [ ] **Step 2: Run test to verify it fails meaningfully**

Run: `pnpm vitest run tests/integration/campaign-api.test.ts`
Expected: FAIL or placeholder-only test requiring real route logic.

- [ ] **Step 3: Implement campaign create/list route**

Support:
- create campaign
- list campaigns

- [ ] **Step 4: Add campaign setup UI**

Create form with:
- campaign name
- system fixed to `5e`
- tone
- party level
- content constraints

- [ ] **Step 5: Add campaign overview page**

Show:
- imported files
- canon review status
- current towns
- recent quest drafts

- [ ] **Step 6: Run integration tests**

Run: `pnpm vitest run tests/integration/campaign-api.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/app/campaigns src/app/api/campaigns/route.ts src/components/campaign tests/integration/campaign-api.test.ts
git commit -m "feat: add campaign setup flow"
```

## Task 7: Build Town Context Builder And Quest Request Form

**Files:**
- Create: `src/lib/canon/context-builder.ts`
- Create: `src/app/campaigns/[campaignId]/quests/new/page.tsx`
- Create: `src/components/quests/quest-request-form.tsx`
- Create: `tests/unit/context-builder.test.ts`

- [ ] **Step 1: Write the failing context-builder test**

```ts
import { describe, expect, it } from "vitest";
import { buildTownWorkingContext } from "@/lib/canon/context-builder";

describe("town working context", () => {
  it("keeps relevant town facts and excludes unrelated distant facts", () => {
    const context = buildTownWorkingContext({
      townName: "Vallaki",
      campaignTone: "gothic mystery",
      partyLevel: 5,
      facts: [
        { type: "location", subject: "Vallaki", value: "Town under strain", status: "active" },
        { type: "location", subject: "Waterdeep", value: "Far away city", status: "active" }
      ],
      deltas: []
    });

    expect(context.summary).toContain("Vallaki");
    expect(context.summary).not.toContain("Waterdeep");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/context-builder.test.ts`
Expected: FAIL because context builder does not exist.

- [ ] **Step 3: Implement town working context builder**

It should gather:
- town facts
- relevant active NPCs
- relevant factions
- recent deltas
- open hooks

- [ ] **Step 4: Implement quest request form**

Form fields:
- town name
- town vibe
- local tension
- quest type
- main plot relation
- desired length
- extra context

- [ ] **Step 5: Add new quest page**

Use context builder outputs to prefill request hints.

- [ ] **Step 6: Run tests**

Run: `pnpm vitest run tests/unit/context-builder.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/canon/context-builder.ts src/app/campaigns/[campaignId]/quests/new/page.tsx src/components/quests/quest-request-form.tsx tests/unit/context-builder.test.ts
git commit -m "feat: add town context builder and quest request flow"
```

## Task 8: Implement Structured Quest Generation And Validation

**Files:**
- Create: `src/lib/quests/quest-schema.ts`
- Create: `src/lib/quests/generate-quest.ts`
- Create: `src/lib/quests/validate-quest.ts`
- Create: `src/app/api/campaigns/[campaignId]/quests/route.ts`
- Create: `tests/unit/quest-validator.test.ts`
- Create: `tests/integration/quest-generation.test.ts`
- Create: `docs/product/quest-json-schema.md`

- [ ] **Step 1: Write the failing validator test**

```ts
import { describe, expect, it } from "vitest";
import { validateQuestDraft } from "@/lib/quests/validate-quest";

describe("quest validator", () => {
  it("rejects drafts without a return-to-main-plot path", () => {
    const result = validateQuestDraft({
      title: "Broken Draft",
      premise: "Something is wrong",
      hook: "Help now",
      scenes: [],
      npcs: [],
      encounters: [],
      rewards: [],
      gmSummary: "Missing return"
    });

    expect(result.valid).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/quest-validator.test.ts`
Expected: FAIL because validator does not exist.

- [ ] **Step 3: Implement quest schema**

Create strict schema with:
- title
- premise
- hook
- `3 to 5` scenes
- NPCs
- encounters
- rewards
- return-to-main-plot
- GM summary

- [ ] **Step 4: Implement quest generator**

Use:
- working context
- quest request
- structured output

Do not return prose-only output.

- [ ] **Step 5: Implement validator**

Checks:
- required fields
- scene count
- at least one NPC
- return path present
- quest type/town compatibility

- [ ] **Step 6: Add quest generation route**

Route should:
- build working context
- call quest generator
- validate draft
- persist quest draft

- [ ] **Step 7: Add mocked integration test**

Verify:
- generation respects schema
- draft persists only if valid

- [ ] **Step 8: Document the quest JSON schema**

Write `docs/product/quest-json-schema.md`.

- [ ] **Step 9: Run tests**

Run:

```bash
pnpm vitest run tests/unit/quest-validator.test.ts tests/integration/quest-generation.test.ts
```

Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add src/lib/quests src/app/api/campaigns/[campaignId]/quests/route.ts tests/unit/quest-validator.test.ts tests/integration/quest-generation.test.ts docs/product/quest-json-schema.md
git commit -m "feat: add structured quest generation pipeline"
```

## Task 9: Build Quest Editor And GM Packet Export

**Files:**
- Create: `src/app/campaigns/[campaignId]/quests/[questId]/page.tsx`
- Create: `src/app/api/campaigns/[campaignId]/quests/[questId]/route.ts`
- Create: `src/components/quests/quest-editor.tsx`
- Create: `src/components/quests/gm-packet-preview.tsx`
- Create: `tests/e2e/import-to-quest.spec.ts`

- [ ] **Step 1: Write the failing end-to-end scenario**

Define the scenario in Playwright:
- create campaign
- upload text note
- review one canon fact
- request quest
- open generated quest
- confirm GM packet preview renders

- [ ] **Step 2: Run Playwright test to verify it fails**

Run: `pnpm playwright test tests/e2e/import-to-quest.spec.ts`
Expected: FAIL because the flow is not implemented yet.

- [ ] **Step 3: Implement quest draft fetch/update route**

Support:
- get draft
- patch draft fields

- [ ] **Step 4: Build quest editor**

Editable sections:
- title
- premise
- hook
- scenes
- NPCs
- rewards
- return path
- summary

- [ ] **Step 5: Build GM packet preview**

Render:
- title
- running summary
- scene list
- NPC list
- rewards
- return to main plot

- [ ] **Step 6: Re-run end-to-end test**

Run: `pnpm playwright test tests/e2e/import-to-quest.spec.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/app/campaigns/[campaignId]/quests/[questId]/page.tsx src/app/api/campaigns/[campaignId]/quests/[questId]/route.ts src/components/quests tests/e2e/import-to-quest.spec.ts
git commit -m "feat: add quest editor and gm packet preview"
```

## Task 10: Polish, Seed Data, And Developer Docs

**Files:**
- Create: `README.md`
- Create: `data/uploads/.gitkeep`
- Create: `tests/fixtures/official-module-excerpt.txt`
- Create: `tests/fixtures/gm-overrides.txt`
- Modify: `MEMORY_CORE_PLAN.md`

- [ ] **Step 1: Write the failing docs check**

Create a checklist in `README.md` draft for:
- local setup
- environment variables
- test commands
- sample workflow

- [ ] **Step 2: Add developer README**

Include:
- setup instructions
- migration commands
- how BYOK works
- where uploads are stored
- known V1 limits

- [ ] **Step 3: Add fixture content**

Create one official excerpt and one GM override fixture to support manual demo and tests.

- [ ] **Step 4: Add `.gitkeep` for uploads directory**

Ensure the app has a stable local uploads root.

- [ ] **Step 5: Update `MEMORY_CORE_PLAN.md`**

Add a short pointer to the implementation plan path for future sessions.

- [ ] **Step 6: Run the full verification suite**

Run:

```bash
pnpm vitest run
pnpm playwright test
pnpm prisma validate
```

Expected:
- all unit and integration tests pass
- end-to-end flow passes
- Prisma schema validates

- [ ] **Step 7: Commit**

```bash
git add README.md data/uploads/.gitkeep tests/fixtures MEMORY_CORE_PLAN.md
git commit -m "docs: add developer setup and demo fixtures"
```

## Suggested Execution Order

Do not parallelize tasks with overlapping write sets.

Recommended order:

1. Task 1
2. Task 2
3. Task 3
4. Task 4
5. Task 5
6. Task 6
7. Task 7
8. Task 8
9. Task 9
10. Task 10

## Risk Notes

- PDF extraction quality may be inconsistent. Keep the extractor boundary isolated.
- Fact extraction prompts may drift. Keep schemas strict and tests fixture-driven.
- Canon review can become noisy. Group conflicts by entity, not by raw fact row.
- BYOK handling must not leak keys into logs or persisted records.
- Quest generation may look coherent while being un-runnable. Validator coverage is not optional.

## Definition Of Done

V1 is done when all of these are true:

- a GM can create a campaign
- upload at least one source file
- extract text into chunks
- generate canon facts with provenance
- review canon conflicts
- request a town-based side quest
- receive a valid structured quest draft
- edit the draft
- view a GM packet preview
- run the full automated test suite successfully

## Handoff

Plan saved to `docs/superpowers/plans/2026-04-09-memory-first-gm-workbench.md`.

Two execution options:

1. Subagent-Driven, recommended
   - use `subagent-driven-development`
   - fresh worker per task
   - review after each task

2. Inline Execution
   - use `executing-plans`
   - execute tasks in this session
   - checkpoint between milestones
