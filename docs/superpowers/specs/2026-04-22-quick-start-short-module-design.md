# Quick Start Short Module Design

Date: 2026-04-22
Status: Proposed
Scope: Product design and implementation direction only, no code changes

## Goal

Add a `Quick Start` mode that lets a GM create a playable short module inside an existing campaign without importing any source material first.

This mode should preserve the project's memory-first architecture while making the product immediately useful for "I want to run something tonight" workflows.

## Product Decision

`Quick Start` is a campaign-local zero-canon start mode.

It is not:

- a standalone one-shot generator product
- a second top-level product line
- a replacement for the memory-first workflow
- a mini-campaign planner

It is:

- a fast entry path inside an existing campaign
- a way to generate a short playable module with no imported canon
- a thin mode layered on top of the existing `QuestRequest -> QuestDraft -> Editor` flow

## Why This Direction

The existing product is explicitly memory-first. That is the right core architecture and should not be diluted.

At the same time, many real GMs do not start by importing documents. They start with a simple need: generate a short module they can run tonight.

`Quick Start` solves that problem without splitting the system into two products.

## Recommended Rollout

Phase the work as:

1. Make `Quick Start` a first-class campaign entry path
2. Keep the underlying data flow unified with existing quest generation
3. Later, if desired, add a thinner "one-shot shell" on top of the same underlying campaign flow

Do not build both a standalone one-shot generator and a campaign-local quick mode in the first release.

## User Experience

### Primary Entry

The primary entry should be from the campaign overview page.

For empty or low-memory campaigns, the overview should clearly present two ways to begin:

- `Import source material`
- `Quick Start`

`Quick Start` should be explained in user language:

- no source material required
- generates a short playable module
- designed for immediate use

### Secondary Entry

The existing quest request page should also support `quick_start=1`.

The overview CTA can route to:

`/campaigns/[campaignId]/quests/new?quick_start=1`

This avoids creating a separate route tree in the first version.

### Result Destination

Generated output should still open in the existing quest editor.

The editor should show a lightweight label such as:

- `Quick Start draft`

This clarifies the origin of the draft without requiring a second editor experience.

## Quick Start Input Model

First version should keep the form compact and focused.

### Required Inputs

- `Adventure premise`
- `Location seed`
- `Session length`
- `Play style`
- `Tone`

### Optional Input

- `Constraints`

### Recommended Field Semantics

#### Adventure premise

A one-sentence description of the main conflict or setup.

Examples:

- `A mining town is hiding why people disappear at dusk.`
- `A ruined abbey keeps ringing a bell that no one can find.`

#### Location seed

A place or stage for the short module.

Examples:

- `foggy harbor town`
- `abandoned abbey`
- `underground market`

#### Session length

Explicit one-shot pacing input:

- `90 minutes`
- `3 hours`
- `2 sessions`

#### Play style

Primary play emphasis:

- `investigation`
- `social`
- `combat`
- `mixed`

#### Tone

Defaults to campaign tone, but may be overridden locally for this request.

#### Constraints

Free text for content or table needs.

Examples:

- `new-player friendly`
- `avoid heavy gore`
- `light on puzzles`

## Output Standard

The result must be a usable short module draft, not a thin inspiration note.

First version should reliably produce:

- a clear title
- a clear premise
- a strong opening hook
- 3 to 5 playable scenes
- a usable NPC list
- 1 or more executable encounters or conflicts
- a reward or payoff
- a clear ending or aftermath
- a GM-facing summary

The quality target is:

> A GM with no imported source material can generate and begin editing a runnable short module within 5 minutes.

## Mapping To Existing Data Structures

Reuse the existing `QuestRequest` and `QuestDraft` pipeline.

### QuestRequest mapping

- `Adventure premise` -> included in `extraContext`
- `Location seed` -> mapped into `townName`
- `Session length` -> mapped into `desiredLength`
- `Play style` -> mapped into `questType`
- `Tone` -> local generation guidance, not necessarily persisted back to campaign tone
- `Constraints` -> appended into `extraContext`

### QuestDraft mapping

Keep the existing fields:

- `title`
- `premise`
- `hook`
- `scenes`
- `npcs`
- `encounters`
- `rewards`
- `returnToMainPlot`
- `gmSummary`

For `Quick Start`, the meaning of `returnToMainPlot` should be treated as a general resolution or aftermath field. The database field does not need to change in the first version.

## Request Mode

Introduce an explicit request mode:

- `standard`
- `quick_start`

This mode should be passed from UI to quest request route and then into generation logic.

This is important because `Quick Start` is not just a different form. It requires different generation intent and looser context assumptions.

## Working Context Strategy

Do not create a separate generation system for `Quick Start`.

Instead, allow the existing generation pipeline to accept a much thinner working context.

### Standard mode working context

Built from:

- canon facts
- canonical entries
- campaign deltas
- town profile

### Quick Start mode working context

Built from:

- campaign tone
- party level
- ad hoc town or location
- user-entered premise
- user-entered constraints

Quick Start mode must allow:

- zero canon facts
- zero deltas
- zero town profiles

The pipeline should still run, but with a minimal context payload rather than a memory-rich one.

## Prompting And Generation Strategy

This is the highest-risk area.

Quick Start must not reuse the exact same generation framing as the normal town quest path.

Generation intent should explicitly target:

- a self-contained short module
- low dependency on campaign memory
- complete beginning, middle, and ending
- same-night playability

Recommended rule:

- reuse the existing output schema
- branch generation behavior on `requestMode=quick_start`
- keep the persistence shape unified

## UI Changes

### Campaign overview

Add a clearly visible `Quick Start` CTA.

For empty or low-memory campaigns, also add explanatory copy near the import workbench:

- no source material required
- good for generating a short module tonight

### Quest request page

When `quick_start=1`:

- change page title to `Quick Start`
- describe it as a short playable module workflow
- reduce visible fields to the compact set
- do not emphasize canon-heavy context
- replace right-side context panel with output expectations and pacing guidance

### Quest editor

Optionally show a small `Quick Start draft` label.

No editor fork is needed in v1.

## Implementation Plan Shape

Recommended execution order:

1. Add `requestMode` support to quest request submission and route parsing
2. Add dual-mode support to quest request form
3. Add `quick_start=1` behavior to quest request page
4. Add `Quick Start` entry on campaign overview
5. Branch generation guidance for quick start output quality
6. Add tests for request mode, context construction, and end-to-end generation flow

## Files Likely To Change

- `src/app/campaigns/[campaignId]/page.tsx`
- `src/app/campaigns/[campaignId]/quests/new/page.tsx`
- `src/components/quests/quest-request-form.tsx`
- `src/app/api/campaigns/[campaignId]/quests/route.ts`
- `src/lib/quests/generation-run.ts`
- prompt or generation helper files used by quest generation
- `src/lib/i18n/messages.ts`
- tests covering quest request routing, generation behavior, and overview CTA visibility

## Risks

### Product risk

If the output reads like a generic quest stub rather than a playable short module, users will conclude that `Quick Start` is decorative rather than useful.

### Architecture risk

If Quick Start gets its own data model or route tree too early, the product will start splitting into two systems.

### UX risk

If the CTA is buried only inside the quest flow, users will not discover it when they need it most, which is before they import canon.

## Deliberate Non-Goals For V1

Do not include:

- standalone home-page one-shot generator
- separate one-shot persistence model
- automatic canon creation from generated module
- full mini-campaign planning
- encounter balancing engine
- map generation
- loot economy system
- multi-session campaign builder beyond the simple `2 sessions` pacing option

## Acceptance Criteria

The feature is done when all of the following are true:

1. A campaign overview with no imported material presents `Quick Start` as a clear path
2. A user can generate a short module without importing any canon
3. The generated output is structurally complete enough to run, not just brainstorm from
4. The result flows into the existing quest editor
5. The normal memory-first workflow remains intact

## Human Test

The clearest manual success test is:

> I have no source material. Within 5 minutes, I generated and began editing a short module I could actually run tonight.

If that sentence is not true, the feature is not complete.
