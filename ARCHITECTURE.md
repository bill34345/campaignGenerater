# ARCHITECTURE.md

## System Summary

This project is a **memory-first GM workbench** for long-running `D&D 5e` campaigns.

The system is designed around one idea:

**Do not generate quests from raw campaign documents every time.**

Instead:

1. ingest messy campaign material
2. extract facts
3. review canon
4. build a town-scoped working context
5. generate a structured side-quest draft from that smaller context

This keeps the product grounded in campaign state instead of turning into a generic prompt wrapper.

## Primary Workflow

```text
Campaign setup
  -> LLM settings
  -> Document upload
  -> Text extraction and chunking
  -> Fact extraction
  -> Canon review
  -> Town context assembly
  -> Quest request
  -> Quest generation
  -> Draft validation
  -> Quest editor
  -> GM packet preview
```

## Architectural Priorities

### 1. Memory-first, not prose-first

The core asset is not a generated quest.
The core asset is a reusable campaign memory made of:

- imported source documents
- extracted facts
- reviewed canon
- town profiles
- campaign deltas

Quest drafts are downstream of that memory.

### 2. Deterministic pipeline around small LLM steps

The system is not built as a multi-agent workflow.

Only a few steps are model-backed:

- fact extraction
- quest generation
- provider connection tests

Everything else is deterministic:

- file storage
- extraction orchestration
- chunking
- Prisma persistence
- canon review
- context building
- schema validation
- E2E flows

### 3. Provider abstraction at one boundary

All LLM-backed work goes through the provider layer in `src/lib/llm/`.

Routes and UI should not talk directly to vendor SDKs.

That boundary exists so the app can support:

- `openai_responses`
- `openai_chat`
- `anthropic`

without rewriting ingestion and quest generation separately for each vendor.

## Module Map

### App Router and pages

- [src/app/page.tsx](/I:/OpenCode/aigenerateAdvanture/src/app/page.tsx)
  - landing page
- [src/app/campaigns/new/page.tsx](/I:/OpenCode/aigenerateAdvanture/src/app/campaigns/new/page.tsx)
  - campaign creation flow
- [src/app/campaigns/[campaignId]/page.tsx](/I:/OpenCode/aigenerateAdvanture/src/app/campaigns/[campaignId]/page.tsx)
  - campaign overview and main navigation hub
- [src/app/campaigns/[campaignId]/canon/page.tsx](/I:/OpenCode/aigenerateAdvanture/src/app/campaigns/[campaignId]/canon/page.tsx)
  - canon review UI
- [src/app/campaigns/[campaignId]/quests/new/page.tsx](/I:/OpenCode/aigenerateAdvanture/src/app/campaigns/[campaignId]/quests/new/page.tsx)
  - quest request flow
- [src/app/campaigns/[campaignId]/quests/[questId]/page.tsx](/I:/OpenCode/aigenerateAdvanture/src/app/campaigns/[campaignId]/quests/[questId]/page.tsx)
  - draft editor and GM packet preview
- [src/app/campaigns/[campaignId]/settings/llm/page.tsx](/I:/OpenCode/aigenerateAdvanture/src/app/campaigns/[campaignId]/settings/llm/page.tsx)
  - campaign-scoped provider configuration

### API routes

- [src/app/api/campaigns/route.ts](/I:/OpenCode/aigenerateAdvanture/src/app/api/campaigns/route.ts)
  - create campaigns
- [src/app/api/campaigns/[campaignId]/documents/route.ts](/I:/OpenCode/aigenerateAdvanture/src/app/api/campaigns/[campaignId]/documents/route.ts)
  - upload, extract, chunk, fact extraction, canon persistence
- [src/app/api/campaigns/[campaignId]/canon/route.ts](/I:/OpenCode/aigenerateAdvanture/src/app/api/campaigns/[campaignId]/canon/route.ts)
  - canon update path
- [src/app/api/campaigns/[campaignId]/quests/route.ts](/I:/OpenCode/aigenerateAdvanture/src/app/api/campaigns/[campaignId]/quests/route.ts)
  - quest request creation, context build, generation, validation, draft persistence
- [src/app/api/campaigns/[campaignId]/quests/[questId]/route.ts](/I:/OpenCode/aigenerateAdvanture/src/app/api/campaigns/[campaignId]/quests/[questId]/route.ts)
  - fetch and update draft
- [src/app/api/campaigns/[campaignId]/llm-settings/route.ts](/I:/OpenCode/aigenerateAdvanture/src/app/api/campaigns/[campaignId]/llm-settings/route.ts)
  - store campaign-level provider config
- [src/app/api/campaigns/[campaignId]/llm-settings/test/route.ts](/I:/OpenCode/aigenerateAdvanture/src/app/api/campaigns/[campaignId]/llm-settings/test/route.ts)
  - provider connectivity smoke

### Core libraries

- `src/lib/files/`
  - local file storage, text extraction, chunking
- `src/lib/llm/`
  - provider abstraction, adapter implementations, mock provider, error mapping
- `src/lib/canon/`
  - canon merge and town-scoped context builder
- `src/lib/quests/`
  - draft generation orchestration, fallback generation, validation, persistence helpers
- `src/lib/i18n/`
  - locale handling and UI strings
- [src/types/domain.ts](/I:/OpenCode/aigenerateAdvanture/src/types/domain.ts)
  - app-level Zod contracts
- [prisma/schema.prisma](/I:/OpenCode/aigenerateAdvanture/prisma/schema.prisma)
  - database model

## Data Model

The main entities are:

- `Campaign`
  - core campaign metadata and campaign-scoped LLM settings
- `SourceDocument`
  - uploaded original source
- `DocumentChunk`
  - extracted chunked text for downstream fact extraction
- `CanonFact`
  - normalized, reviewable facts
- `CampaignDelta`
  - recent changes or overrides tied to canon
- `TownProfile`
  - location-level quest anchor
- `QuestRequest`
  - user request for a new quest draft
- `QuestDraft`
  - structured generated output with provenance

The relationship is:

```text
Campaign
  -> SourceDocument
  -> DocumentChunk
  -> CanonFact
  -> CampaignDelta
  -> TownProfile
  -> QuestRequest
  -> QuestDraft
```

Important detail:

`QuestDraft` persists provenance fields such as:

- `generationMode`
- `generationProvider`
- `generationModel`
- `fallbackReason`
- `generationErrorCode`

That metadata is part of the product. It is not debug-only noise.

## Ingestion Architecture

Document ingestion happens in [documents route](/I:/OpenCode/aigenerateAdvanture/src/app/api/campaigns/[campaignId]/documents/route.ts).

Flow:

1. validate upload
2. persist file locally under `data/uploads/<campaignId>/`
3. extract text from PDF, DOCX, Markdown, or text
4. create `SourceDocument`
5. chunk extracted text into `DocumentChunk`
6. call provider-backed fact extraction
7. persist extracted facts as `CanonFact` in `uncertain` state

Important rule:

**Fact extraction failure must be visible.**

Quest generation may degrade to a fallback draft.  
Fact extraction must not silently pretend success.

## Canon Layer

Canon is the reviewed bridge between raw documents and quest generation.

This matters because campaign materials can conflict:

- official module text
- GM notes
- table-specific overrides
- session outcomes

The app resolves this by making canon review explicit, not automatic.

Current statuses:

- `active`
- `overridden`
- `uncertain`

Context building intentionally uses reviewed canon and recent deltas instead of raw uploads.

## Quest Generation Architecture

Quest generation happens in [quests route](/I:/OpenCode/aigenerateAdvanture/src/app/api/campaigns/[campaignId]/quests/route.ts), which calls [generation-run.ts](/I:/OpenCode/aigenerateAdvanture/src/lib/quests/generation-run.ts).

That helper returns one shape:

```text
{ draft, meta }
```

Where:

- `draft` is a `QuestGenerationDraft`
- `meta` records provider provenance or fallback reason

This keeps the route thin and prevents provider logic from being duplicated.

### Fallback policy

If a provider fails in a recoverable way during quest generation:

- the app may generate a fallback draft
- the draft is persisted with visible fallback provenance

Fallback is deterministic and structured.  
It exists to keep the workflow usable, not to hide provider failures.

## LLM Boundary

All provider-specific logic lives under:

- [src/lib/llm/provider-resolver.ts](/I:/OpenCode/aigenerateAdvanture/src/lib/llm/provider-resolver.ts)
- [src/lib/llm/providers/openai-responses.ts](/I:/OpenCode/aigenerateAdvanture/src/lib/llm/providers/openai-responses.ts)
- [src/lib/llm/providers/openai-chat.ts](/I:/OpenCode/aigenerateAdvanture/src/lib/llm/providers/openai-chat.ts)
- [src/lib/llm/providers/anthropic.ts](/I:/OpenCode/aigenerateAdvanture/src/lib/llm/providers/anthropic.ts)

The provider resolver is the single switchboard.

Rules:

- Routes should resolve provider once, not branch ad hoc in multiple places.
- Adapter output must be normalized back into app-level schemas.
- Compatibility hacks for vendor-specific response formats belong in adapters, not in routes or UI.
- Mock provider support is first-class because the default E2E strategy is mock-first.

## Internationalization

The UI is bilingual and defaults to Chinese.

Current model:

- server-rendered locale from cookie
- client persistence in cookie and `localStorage`
- shared copy in `src/lib/i18n/`

Generated quest content also carries locale explicitly on `QuestRequest` and `QuestDraft`.  
Do not rely on ambient browser language during generation.

## Testing Strategy

The repo uses three layers:

### Unit and integration

- Vitest
- schema, route, provider, and domain behavior

### Mock-first E2E

- Playwright
- default execution uses `CODEX_TEST_LLM_MOCK=1`
- covers smoke, workflow, provider routing, and negative paths

### Live smoke

- explicit opt-in only
- used to validate real provider compatibility
- not part of the default regression gate

This split is intentional.  
The default suite is for determinism.  
Live smoke is for vendor reality checks.

## Non-Goals

This system is **not** trying to do the following in V1:

- full campaign generation
- player-facing tooling
- marketplace listing or storefront behavior
- DMs Guild or DriveThru publishing workflow
- PDF-first product generation
- VTT export pipeline
- autonomous multi-agent orchestration
- complete 5e encounter balancing engine

If a change pushes the codebase toward one of those goals, stop and ask whether that scope change is intentional.

## Practical Editing Guidance

If you are changing this system:

- read [AGENTS.md](/I:/OpenCode/aigenerateAdvanture/AGENTS.md) first for commands and repo conventions
- keep provider concerns inside adapters
- keep route handlers orchestration-focused
- keep schema changes synchronized between Prisma and Zod
- update tests in the same pass as behavior changes
- prefer visible failure to silent false success

That is the whole game.
