# AGENTS.md

## Project Overview

This repository is a local-first GM workbench for long-running `D&D 5e` campaigns.

The product flow is:

1. create a campaign
2. upload source material such as PDF, DOCX, Markdown, or text notes
3. extract canon facts into a review queue
4. confirm or override canon
5. build a town-scoped working context
6. generate a structured side-quest draft
7. edit the draft and preview a GM packet

This is **not** a generic story generator, marketplace, VTT publishing tool, or full 5e rules engine.

Before making multi-file or architectural changes, read [ARCHITECTURE.md](/I:/OpenCode/aigenerateAdvanture/ARCHITECTURE.md).

## Read Order For New Agents

Use this order when entering the repo cold:

1. [README.md](/I:/OpenCode/aigenerateAdvanture/README.md)
2. [ARCHITECTURE.md](/I:/OpenCode/aigenerateAdvanture/ARCHITECTURE.md)
3. [MEMORY_CORE_PLAN.md](/I:/OpenCode/aigenerateAdvanture/MEMORY_CORE_PLAN.md)
4. the specific route, component, or provider files you need to touch

README explains how to run the app.  
ARCHITECTURE explains the system boundaries.  
MEMORY_CORE_PLAN explains the original product intent and non-goals.

## Setup Commands

Install dependencies:

```bash
pnpm install
```

Prepare the database:

```bash
pnpm prisma migrate dev
pnpm prisma:generate
pnpm prisma validate
```

Start the dev server:

```bash
pnpm dev
```

Fast local bootstrap and start:

```bash
pnpm boot
```

Windows local production start and auto-start:

```bash
pnpm serve:local
pnpm autostart:install
```

Typecheck:

```bash
pnpm typecheck
```

Lint:

```bash
pnpm lint
```

Run unit and integration tests:

```bash
pnpm vitest run
```

Run the full Playwright suite:

```bash
pnpm playwright test
```

## Environment And Secrets

Environment lives in:

- [I:\OpenCode\aigenerateAdvanture\.env](/I:/OpenCode/aigenerateAdvanture/.env)
- [I:\OpenCode\aigenerateAdvanture\.env.example](/I:/OpenCode/aigenerateAdvanture/.env.example)

Important rules:

- `.env` is ignored, do not commit secrets.
- The local SQLite database lives under `prisma/dev.db`.
- Uploaded files are stored locally under `data/uploads/<campaignId>/`.
- Campaign-level provider settings can override model, key, and base URL from the UI.

## Development Workflow

### Main app surfaces

- landing page: [src/app/page.tsx](/I:/OpenCode/aigenerateAdvanture/src/app/page.tsx)
- create campaign: [src/app/campaigns/new/page.tsx](/I:/OpenCode/aigenerateAdvanture/src/app/campaigns/new/page.tsx)
- campaign overview: [src/app/campaigns/[campaignId]/page.tsx](/I:/OpenCode/aigenerateAdvanture/src/app/campaigns/[campaignId]/page.tsx)
- canon review: [src/app/campaigns/[campaignId]/canon/page.tsx](/I:/OpenCode/aigenerateAdvanture/src/app/campaigns/[campaignId]/canon/page.tsx)
- quest request: [src/app/campaigns/[campaignId]/quests/new/page.tsx](/I:/OpenCode/aigenerateAdvanture/src/app/campaigns/[campaignId]/quests/new/page.tsx)
- quest editor: [src/app/campaigns/[campaignId]/quests/[questId]/page.tsx](/I:/OpenCode/aigenerateAdvanture/src/app/campaigns/[campaignId]/quests/[questId]/page.tsx)
- LLM settings: [src/app/campaigns/[campaignId]/settings/llm/page.tsx](/I:/OpenCode/aigenerateAdvanture/src/app/campaigns/[campaignId]/settings/llm/page.tsx)

### API routes

- campaigns: [src/app/api/campaigns/route.ts](/I:/OpenCode/aigenerateAdvanture/src/app/api/campaigns/route.ts)
- documents: [src/app/api/campaigns/[campaignId]/documents/route.ts](/I:/OpenCode/aigenerateAdvanture/src/app/api/campaigns/[campaignId]/documents/route.ts)
- canon: [src/app/api/campaigns/[campaignId]/canon/route.ts](/I:/OpenCode/aigenerateAdvanture/src/app/api/campaigns/[campaignId]/canon/route.ts)
- quests: [src/app/api/campaigns/[campaignId]/quests/route.ts](/I:/OpenCode/aigenerateAdvanture/src/app/api/campaigns/[campaignId]/quests/route.ts)
- quest draft: [src/app/api/campaigns/[campaignId]/quests/[questId]/route.ts](/I:/OpenCode/aigenerateAdvanture/src/app/api/campaigns/[campaignId]/quests/[questId]/route.ts)
- LLM settings: [src/app/api/campaigns/[campaignId]/llm-settings/route.ts](/I:/OpenCode/aigenerateAdvanture/src/app/api/campaigns/[campaignId]/llm-settings/route.ts)

## Code Organization

### App and UI

- `src/app/` holds App Router pages and route handlers.
- `src/components/` holds page-level UI building blocks.
- `src/lib/i18n/` holds locale resolution and translation helpers.

### Core domain and persistence

- [src/types/domain.ts](/I:/OpenCode/aigenerateAdvanture/src/types/domain.ts) is the main Zod contract layer. Treat it as the app-level schema source of truth.
- [prisma/schema.prisma](/I:/OpenCode/aigenerateAdvanture/prisma/schema.prisma) is the persistence model. Keep Prisma and Zod changes aligned.
- [src/lib/db.ts](/I:/OpenCode/aigenerateAdvanture/src/lib/db.ts) is the Prisma client entry point.

### File ingestion

- `src/lib/files/` handles storage, extraction, and chunking.
- `documents/route.ts` saves uploads, extracts text, chunks it, runs provider-backed fact extraction, then persists canon facts.

### Canon and quest generation

- `src/lib/canon/` builds working context from reviewed canon and deltas.
- `src/lib/quests/` holds draft generation, fallback generation, provenance, validation, and persistence helpers.
- `src/lib/llm/` is the provider boundary. Do not bypass it from routes or components.

## LLM And Provider Rules

Provider selection is campaign-scoped, not global.

Supported providers today:

- `openai_responses`
- `openai_chat`
- `anthropic`

Important rules:

- Fact extraction and quest generation both go through the same provider settings.
- If quest generation fails in a recoverable way, the app may persist a fallback draft.
- If fact extraction fails, the app must surface a visible error. Do **not** silently invent canon.
- Quest provenance matters. Do not remove or bypass `generationMode`, `generationProvider`, `generationModel`, `fallbackReason`, or `generationErrorCode`.

Provider code lives here:

- [src/lib/llm/provider-resolver.ts](/I:/OpenCode/aigenerateAdvanture/src/lib/llm/provider-resolver.ts)
- [src/lib/llm/providers/openai-responses.ts](/I:/OpenCode/aigenerateAdvanture/src/lib/llm/providers/openai-responses.ts)
- [src/lib/llm/providers/openai-chat.ts](/I:/OpenCode/aigenerateAdvanture/src/lib/llm/providers/openai-chat.ts)
- [src/lib/llm/providers/anthropic.ts](/I:/OpenCode/aigenerateAdvanture/src/lib/llm/providers/anthropic.ts)

## Testing Instructions

### Vitest

Unit and integration tests live under:

- `tests/unit/`
- `tests/integration/`

Run all:

```bash
pnpm vitest run
```

Run one file:

```bash
pnpm vitest run tests/unit/provider-resolver.test.ts
```

### Playwright

E2E tests live under:

- `tests/e2e/smoke`
- `tests/e2e/workflow`
- `tests/e2e/providers`
- `tests/e2e/negative`

Default E2E is mock-first:

```bash
pnpm playwright test
```

Live provider smoke is opt-in and documented in:

- [docs/testing/live-provider-smoke.md](/I:/OpenCode/aigenerateAdvanture/docs/testing/live-provider-smoke.md)

Useful filtered runs:

```bash
pnpm playwright test --grep @smoke
pnpm playwright test --grep @provider
pnpm playwright test --grep @negative
```

## Code Style And Change Rules

- Keep changes local to the relevant subsystem. Do not casually mix UI, provider, and schema edits in one sweep.
- Prefer updating tests with the code change, not after.
- Keep provider normalization logic inside provider adapters.
- Keep business validation in Zod or validation helpers, not scattered through components.
- Prefer explicit route errors over silent degradation.
- Keep Markdown docs ASCII-safe when possible. This repo has had Windows encoding issues before.

## Common Pitfalls

- Do not treat README as the only truth. It is a user entry point, not the full system design.
- Do not bypass campaign-scoped LLM settings by reaching for global env vars unless the code already defines that fallback.
- Do not make fact extraction silently fall back to fake data just to keep the UI green.
- Do not assume live-provider compatibility from one gateway implies compatibility for all three protocols.
- In PowerShell, bracketed App Router paths are easier to read with `-LiteralPath`.
- If `prisma/schema.prisma` changed, run `pnpm prisma:generate` before `pnpm typecheck` or `pnpm vitest run`. A stale Prisma client can create false-negative failures like missing generated modules or missing table shapes.

## Before You Finish

Before claiming a change is complete, run the smallest relevant set from here:

```bash
pnpm prisma:generate
pnpm lint
pnpm typecheck
pnpm vitest run
pnpm playwright test
```

For doc-only changes, at least verify the files render sensibly and cross-links are correct.

<!-- gitnexus:start -->
# GitNexus 鈥?Code Intelligence

This project is indexed by GitNexus as **aigenerateAdvanture** (1722 symbols, 3013 relationships, 110 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol 鈥?callers, callees, which execution flows it participates in 鈥?use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace 鈥?use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/aigenerateAdvanture/context` | Codebase overview, check index freshness |
| `gitnexus://repo/aigenerateAdvanture/clusters` | All functional areas |
| `gitnexus://repo/aigenerateAdvanture/processes` | All execution flows |
| `gitnexus://repo/aigenerateAdvanture/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
