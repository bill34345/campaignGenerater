# Quest Generation Streaming Status Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current synchronous quest-generation request with a long-running, user-visible workflow that stays reliable when providers are slow and keeps the UI responsive through persisted status plus streamed progress.

**Architecture:** Keep the existing memory-first `QuestRequest -> QuestDraft -> Editor` pipeline, but split generation into two layers:

- a persisted async job lifecycle bound to `QuestRequest`
- a read-only status/event surface used by the UI

Do not expose raw chain-of-thought. Expose stage progress, safe visible text deltas, validation state, and final completion.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Prisma + SQLite, Zod, Vitest, Playwright

---

## Product Decision

The UX fix is **not** "show a spinner longer."

The product behavior should become:

1. user submits a quest request
2. server persists the request and returns immediately
3. generation runs as a tracked long job
4. UI subscribes to status and events
5. user sees stage-by-stage progress and optional safe text preview
6. UI auto-opens the draft when generation completes

This avoids the current failure mode where the page appears frozen during a slow provider call.

---

## File Structure

### Modify

- `prisma/schema.prisma`
  - add persisted quest-generation lifecycle fields
- `src/types/domain.ts`
  - add request/job status schema and event payload schema
- `src/app/api/campaigns/[campaignId]/quests/route.ts`
  - make submit return early and stop blocking on generation
- `src/app/api/campaigns/[campaignId]/quests/[questId]/route.ts`
  - expose status fields in the request/draft payload if needed
- `src/components/quests/quest-request-form.tsx`
  - submit asynchronously, transition into a generating state, and subscribe to progress
- `src/lib/quests/generation-run.ts`
  - accept progress callbacks and emit structured stage updates
- `src/lib/llm/provider-types.ts`
  - extend provider interfaces for optional streaming/progress hooks
- `src/lib/llm/providers/openai-responses.ts`
  - surface stream-capable quest generation progress where supported
- `src/lib/llm/providers/openai-chat.ts`
  - emit provider-stage updates even if full text streaming is unavailable
- `src/lib/llm/providers/anthropic.ts`
  - emit provider-stage updates and safe text deltas from streaming-compatible responses
- `src/lib/i18n/messages.ts`
  - add generating-state copy, stage labels, retry/failure messages
- `tests/integration/quest-generation.test.ts`
  - cover async submission and terminal job states
- `tests/e2e/workflow/campaign-to-quest.spec.ts`
  - cover user-visible generating state, streamed updates, and final redirect

### Create

- `src/app/api/campaigns/[campaignId]/quests/[requestId]/status/route.ts`
  - return current quest-generation status for one request
- `src/app/api/campaigns/[campaignId]/quests/[requestId]/events/route.ts`
  - SSE endpoint for progress events
- `src/lib/quests/generation-status.ts`
  - shared helpers for persisting and reading request/job state
- `src/lib/quests/generation-dispatch.ts`
  - decouple request submission from actual generation execution
- `tests/unit/quest-generation-status.test.ts`
  - status lifecycle coverage
- `tests/unit/quest-request-form-generating.test.tsx`
  - client-side generating-state coverage

---

## Data Model Decision

For v1 of this change, do **not** introduce a separate queue system or external worker.

Use the existing `QuestRequest` row as the durable unit of work by adding explicit lifecycle fields such as:

- `generationStatus`
- `generationStage`
- `generationProgressMessage`
- `generationStartedAt`
- `generationCompletedAt`
- `generationFailedAt`
- `generationLastErrorCode`
- `generationLastErrorMessage`

Optional if needed:

- `generationPreviewText`

This keeps the first implementation simple, local-first, and Prisma-native.

If the workflow later outgrows in-process execution, the app can split the same lifecycle into a dedicated `QuestGenerationJob` model without changing the UI contract.

---

## Event Model

The system should support a small, stable event vocabulary:

- `queued`
- `building_context`
- `calling_provider`
- `provider_stream_open`
- `provider_text_delta`
- `validating`
- `persisting`
- `completed`
- `failed`
- `cancelled`

Rules:

- `provider_text_delta` is for user-visible draft text only
- raw internal reasoning or encrypted thinking blocks must never be surfaced
- UI should treat unknown event types as non-fatal and ignore them gracefully

---

## Task 1: Add Persisted Quest Generation Lifecycle State

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/types/domain.ts`
- Create: `tests/unit/quest-generation-status.test.ts`

- [ ] **Step 1: Write the failing schema and lifecycle tests**

Add coverage proving a quest request can represent:

- queued
- running
- completed
- failed

and that terminal states preserve timestamps and error details.

- [ ] **Step 2: Run the focused test**

Run: `pnpm vitest run tests/unit/quest-generation-status.test.ts tests/unit/domain-schema.test.ts`

Expected: FAIL because the lifecycle fields and schemas do not exist yet.

- [ ] **Step 3: Extend Prisma and domain contracts**

Add lifecycle fields to `QuestRequest` and mirror them in Zod.

Suggested status enum:

```ts
z.enum(["queued", "running", "completed", "failed", "cancelled"]);
```

Suggested stage enum:

```ts
z.enum([
  "queued",
  "building_context",
  "calling_provider",
  "streaming",
  "validating",
  "persisting",
  "completed",
  "failed",
  "cancelled",
]);
```

- [ ] **Step 4: Add migration and generate Prisma client**

Run:

```bash
pnpm prisma migrate dev
pnpm prisma:generate
```

- [ ] **Step 5: Re-run the focused tests**

Run: `pnpm vitest run tests/unit/quest-generation-status.test.ts tests/unit/domain-schema.test.ts`

Expected: PASS

---

## Task 2: Split Submission From Execution

**Files:**
- Modify: `src/app/api/campaigns/[campaignId]/quests/route.ts`
- Create: `src/lib/quests/generation-status.ts`
- Create: `src/lib/quests/generation-dispatch.ts`
- Modify: `tests/integration/quest-generation.test.ts`

- [ ] **Step 1: Write the failing integration test for async submission**

The route should:

- create `QuestRequest`
- mark it `queued`
- return `202`
- not wait for `QuestDraft` persistence in the request lifecycle

- [ ] **Step 2: Run the focused integration test**

Run: `pnpm vitest run tests/integration/quest-generation.test.ts`

Expected: FAIL because the route currently blocks until generation is complete.

- [ ] **Step 3: Refactor the route into submission-only behavior**

Suggested response shape:

```json
{
  "questRequest": {
    "id": "req_123",
    "generationStatus": "queued",
    "generationStage": "queued"
  }
}
```

with HTTP `202`.

- [ ] **Step 4: Dispatch generation out of band**

The dispatch layer should:

- load campaign/provider state
- build working context
- update status to `running`
- call `runQuestGeneration`
- validate
- persist final draft
- update terminal state

For the first pass, it may run in-process after the response is initiated, but the route must not await final completion.

- [ ] **Step 5: Re-run the integration test**

Run: `pnpm vitest run tests/integration/quest-generation.test.ts`

Expected: PASS

---

## Task 3: Add Status And SSE Event Surfaces

**Files:**
- Create: `src/app/api/campaigns/[campaignId]/quests/[requestId]/status/route.ts`
- Create: `src/app/api/campaigns/[campaignId]/quests/[requestId]/events/route.ts`
- Modify: `src/lib/quests/generation-status.ts`
- Modify: `tests/integration/quest-generation.test.ts`

- [ ] **Step 1: Write the failing tests for status and events**

Cover:

- status endpoint returns current lifecycle state
- SSE endpoint emits stage events in order
- completion event includes `draftId`
- failure event includes error code/message

- [ ] **Step 2: Run the focused integration tests**

Run: `pnpm vitest run tests/integration/quest-generation.test.ts`

Expected: FAIL because these endpoints do not exist.

- [ ] **Step 3: Implement status route**

Return a stable read model:

```json
{
  "questRequest": {
    "id": "req_123",
    "generationStatus": "running",
    "generationStage": "calling_provider",
    "generationProgressMessage": "Calling Anthropic provider...",
    "generationStartedAt": "..."
  },
  "draft": null
}
```

- [ ] **Step 4: Implement SSE route**

Emit `text/event-stream` messages with:

- `event: status`
- `event: text_delta`
- `event: completed`
- `event: failed`

The SSE stream should be safe to reconnect. The client may fall back to polling if the stream breaks.

- [ ] **Step 5: Re-run the integration tests**

Run: `pnpm vitest run tests/integration/quest-generation.test.ts`

Expected: PASS

---

## Task 4: Add Progress Emission To Generation And Providers

**Files:**
- Modify: `src/lib/quests/generation-run.ts`
- Modify: `src/lib/llm/provider-types.ts`
- Modify: `src/lib/llm/providers/openai-responses.ts`
- Modify: `src/lib/llm/providers/openai-chat.ts`
- Modify: `src/lib/llm/providers/anthropic.ts`

- [ ] **Step 1: Write focused provider and generation tests**

Cover:

- stage updates are emitted around provider invocation
- provider adapters can emit safe text deltas
- adapters without streaming still emit stage-only progress
- failures still update status correctly

- [ ] **Step 2: Run the targeted tests**

Run:

```bash
pnpm vitest run tests/unit/anthropic-provider.test.ts tests/integration/quest-generation.test.ts
```

Expected: FAIL because the current interfaces return only the final draft.

- [ ] **Step 3: Extend the provider contract**

Allow quest generation calls to accept optional callbacks such as:

```ts
onStageChange?(stage, message)
onTextDelta?(text)
```

- [ ] **Step 4: Emit normalized progress in `runQuestGeneration`**

At minimum emit:

- `calling_provider`
- `validating`
- `persisting`

- [ ] **Step 5: Use streaming where vendor support exists**

For providers that support SSE/streaming:

- read text deltas incrementally
- only forward user-visible text
- never forward raw chain-of-thought or encrypted thinking

For providers without usable streaming:

- emit stage-only progress and final completion

- [ ] **Step 6: Re-run targeted tests**

Expected: PASS

---

## Task 5: Build The Generating-State UI

**Files:**
- Modify: `src/components/quests/quest-request-form.tsx`
- Modify: `src/lib/i18n/messages.ts`
- Create: `tests/unit/quest-request-form-generating.test.tsx`

- [ ] **Step 1: Write the failing client-side test**

Cover:

- submit transitions into generating state
- UI shows current stage label
- UI renders streamed preview text
- completion surfaces a draft link or auto-redirect
- failure surfaces retry copy

- [ ] **Step 2: Run the focused UI test**

Run: `pnpm vitest run tests/unit/quest-request-form-generating.test.tsx`

Expected: FAIL because the form currently only handles one blocking request.

- [ ] **Step 3: Replace one-shot submit behavior**

Client flow should become:

1. POST submit
2. receive `requestId`
3. open SSE stream
4. render progress panel
5. auto-open or link to draft on completion

- [ ] **Step 4: Add generating copy**

Add strings for:

- queued
- building context
- contacting provider
- drafting scenes
- validating structure
- saving draft
- completed
- failed
- retry

- [ ] **Step 5: Add graceful fallback**

If SSE is unavailable, poll the status endpoint every few seconds.

- [ ] **Step 6: Re-run the focused UI test**

Expected: PASS

---

## Task 6: Add End-To-End Coverage For Slow Generation

**Files:**
- Modify: `tests/e2e/workflow/campaign-to-quest.spec.ts`

- [ ] **Step 1: Add a slow-provider workflow case**

The test should prove:

- user sees generating state after submit
- UI does not appear frozen
- progress text changes while waiting
- page refresh can recover by reading status
- final draft opens successfully

- [ ] **Step 2: Run the filtered E2E**

Run:

```bash
pnpm playwright test tests/e2e/workflow/campaign-to-quest.spec.ts --grep "generation progress"
```

Expected: FAIL because the app currently waits synchronously.

- [ ] **Step 3: Add stable selectors**

Examples:

- `data-testid="quest-generation-status"`
- `data-testid="quest-generation-stage"`
- `data-testid="quest-generation-preview"`
- `data-testid="quest-generation-retry"`

- [ ] **Step 4: Re-run the E2E**

Expected: PASS

---

## Task 7: Final Verification

- [ ] **Step 1: Generate Prisma client**

Run: `pnpm prisma:generate`

- [ ] **Step 2: Run lint**

Run: `pnpm lint`

- [ ] **Step 3: Run typecheck**

Run: `pnpm typecheck`

- [ ] **Step 4: Run focused Vitest**

Run:

```bash
pnpm vitest run tests/unit/quest-generation-status.test.ts tests/unit/quest-request-form-generating.test.tsx tests/unit/anthropic-provider.test.ts tests/integration/quest-generation.test.ts
```

- [ ] **Step 5: Run focused Playwright**

Run:

```bash
pnpm playwright test tests/e2e/workflow/campaign-to-quest.spec.ts --grep "generation progress"
```

Expected: all pass

---

## Risks

- **Scope risk:** If this grows into a generic background-job framework, it will overshoot the user problem. Keep it scoped to quest generation first.
- **Runtime risk:** In-process async execution is enough for the first pass, but must not rely on the request staying open after returning.
- **UX risk:** Showing raw chain-of-thought is tempting but wrong here. Only surface safe visible draft text and explicit stage messages.
- **Recovery risk:** The UI must survive refresh and reconnect; otherwise streaming only improves the happy path.

---

## Definition Of Done

- Submitting a quest request returns immediately instead of blocking on provider latency.
- The user can see live status while generation runs.
- Slow providers no longer make the page appear frozen.
- The workflow survives refresh via persisted status.
- Final success opens the draft cleanly.
- Validation and provider failures are visible and actionable.
