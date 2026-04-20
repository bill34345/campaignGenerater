# Memory Core Technical Plan V1

## Summary

This product is not a generic adventure generator.

V1 is a `D&D 5e` GM workbench for running campaigns. It helps a GM ingest long and messy campaign materials, maintain a usable campaign memory, and generate a town-based side quest that can be inserted into an existing long-running campaign.

The core problem is not "generate a quest."

The core problem is:

> How do we turn a long official module PDF, plus scattered GM notes and session changes, into a stable campaign memory that can be used repeatedly?

That is the product.

## Product Definition

### V1 product statement

A `5e town side-quest workbench` for GMs running long campaigns.

The GM can:

1. import official PDFs and messy notes
2. build a usable campaign memory from those materials
3. review and correct canon
4. generate a town-based side quest that fits the campaign
5. edit the result and export a GM packet

### V1 user promise

Give the system your campaign materials and your current town context.

Get back a side quest you can realistically run in a `2.5 to 4 hour` session, without breaking your current campaign.

## What V1 Is Not

V1 is not:

- a full campaign generator
- a marketplace
- a DMs Guild / DriveThruRPG publishing pipeline
- a PDF-first publishing product
- a VTT integration platform
- a multi-system TTRPG platform
- a player-facing experience
- a complete 5e rules engine
- a fully autonomous agent system

If V1 tries to do any of those, it will collapse under complexity.

## Why V1 Does Not Need Multi-Agent

The problem looks like an agent problem, but V1 should not be designed as one.

V1 does not need a swarm of autonomous agents. It needs a deterministic pipeline with a small number of LLM-assisted steps.

### What the system actually needs

- file import
- text extraction
- chunking
- structured fact extraction
- canon conflict detection
- human confirmation
- retrieval of relevant context
- structured side-quest generation

Only two of those steps actually require a model:

1. extracting structured campaign facts from chunks
2. generating a structured quest draft from working context

Everything else should be deterministic.

### Why multi-agent is the wrong V1 choice

- harder to test
- harder to debug
- more expensive
- more state drift
- unclear failure boundaries
- much harder to explain to a GM user

### V2 or V3 may use agents for

- automatic cross-document conflict resolution suggestions
- auto-linking unresolved threads to possible side-quest hooks
- batch generation of multiple quest candidates
- automatic sync to external knowledge tools

But V1 should not start there.

## Recommended V1 Stack

## Model strategy

Recommendation:

- `V1 model stack: OpenAI-only`

Reason:

- file inputs are available
- structured outputs are available
- retrieval/vector store support is available
- one API key is enough
- lower operational complexity

The user can bring their own API key.

This product should support `BYOK` from day one.

### Why OpenAI-only for V1

Not because it is the only valid option.

Because it is the lowest-complexity option for a first build:

- one provider
- one auth path
- one billing mental model
- one retrieval path
- one structured output path

### Future provider support

Later, add:

- Gemini for heavy PDF ingestion
- Claude for selected long-context extraction tasks

But V1 should not start multi-provider unless there is a hard blocker.

## System Architecture

```text
[User Files]
  - PDF
  - DOCX
  - Markdown
  - TXT
  - Session notes
        |
        v
[Import Layer]
        |
        v
[Extraction Layer]
  - text extraction
  - chunking
  - source metadata
        |
        v
[Fact Extraction Layer]
  - locations
  - NPCs
  - factions
  - events
  - clues
  - quest hooks
  - overrides
        |
        v
[Canon Layer]
  - active facts
  - overridden facts
  - uncertain facts
        |
        v
[Working Context Builder]
  - current town
  - relevant NPCs
  - party level
  - open threads
  - recent changes
        |
        v
[Quest Generator]
        |
        v
[Quest Validator]
        |
        v
[GM Editor]
        |
        v
[GM Packet Export]
```

## Core Design Principle

Do not push the entire campaign into the model every time.

Instead:

1. store raw materials
2. extract stable facts
3. resolve canon
4. build a smaller working context for the current town
5. generate only from that working context

That is the whole game.

## Memory Model

The memory core should use four layers.

## 1. Source Layer

Purpose:

- keep the raw imported materials
- preserve provenance
- avoid losing original wording

Examples:

- official module PDF
- GM notes
- DOCX planning docs
- markdown world notes
- session recap notes

This is not the runtime source of truth.

It is the evidence layer.

## 2. Extracted Facts Layer

Purpose:

- derive structured facts from messy materials

Examples:

- location facts
- NPC facts
- faction facts
- event facts
- unresolved clues
- explicit GM overrides

This layer should always point back to source.

## 3. Canon Layer

Purpose:

- represent what is currently true in this campaign

This layer matters most because official module content can be wrong for the current table.

The GM may have:

- killed an NPC who is alive in the PDF
- merged two factions
- moved a clue
- inserted a custom plotline
- changed a town state

Canon must support override priority.

Recommended precedence:

1. session deltas
2. explicit GM overrides
3. custom imported notes
4. official module content

## 4. Working Context Layer

Purpose:

- build a small generation context for the current request

For a town side quest, the working context should include only:

- current town summary
- party level
- relevant active NPCs
- relevant factions
- open plot threads connected to the town
- recent session changes
- quest request constraints

This is what gets sent to the quest generator.

## Data Model

V1 should store these entities.

## Campaign

```json
{
  "id": "cmp_123",
  "name": "Curse of Strahd Campaign",
  "system": "5e",
  "party_level": 5,
  "tone": "gothic horror and mystery",
  "summary": "Long-running campaign with modified NPC arcs",
  "content_constraints": [
    "avoid graphic torture",
    "keep tone serious"
  ],
  "created_at": "2026-04-09T00:00:00Z"
}
```

## SourceDocument

```json
{
  "id": "src_123",
  "campaign_id": "cmp_123",
  "title": "Official Module PDF",
  "type": "pdf",
  "origin": "official",
  "status": "processed",
  "checksum": "sha256:...",
  "created_at": "2026-04-09T00:00:00Z"
}
```

## DocumentChunk

```json
{
  "id": "chk_123",
  "source_document_id": "src_123",
  "campaign_id": "cmp_123",
  "index": 18,
  "page_start": 44,
  "page_end": 45,
  "text": "...",
  "embedding_id": "emb_123"
}
```

## CanonFact

```json
{
  "id": "fact_123",
  "campaign_id": "cmp_123",
  "type": "npc",
  "subject": "Father Lucian",
  "value": "Alive, suspicious of the burgomaster, secretly hiding evidence",
  "status": "active",
  "priority": 80,
  "source_document_id": "src_456",
  "source_chunk_id": "chk_789",
  "confidence": 0.88
}
```

## CampaignDelta

```json
{
  "id": "delta_123",
  "campaign_id": "cmp_123",
  "session_number": 14,
  "change_type": "npc_state_change",
  "summary": "Izek was killed by the party during the festival riot",
  "priority": 100,
  "created_at": "2026-04-09T00:00:00Z"
}
```

## TownProfile

```json
{
  "id": "town_123",
  "campaign_id": "cmp_123",
  "name": "Vallaki",
  "type": "town",
  "vibe": "tense, paranoid, politically unstable",
  "local_tension": "power struggle between authority figures",
  "notable_locations": [
    "Blue Water Inn",
    "Church of St. Andral"
  ]
}
```

## QuestRequest

```json
{
  "id": "req_123",
  "campaign_id": "cmp_123",
  "town_profile_id": "town_123",
  "quest_type": "investigation",
  "main_plot_relation": "strong_return",
  "desired_length_hours": 3,
  "extra_context": "The party just restored order after a public disturbance."
}
```

## QuestDraft

```json
{
  "id": "quest_123",
  "campaign_id": "cmp_123",
  "quest_request_id": "req_123",
  "status": "draft",
  "title": "Ashes Beneath the Bell Tower",
  "premise": "...",
  "hook": "...",
  "scenes": [],
  "npcs": [],
  "encounters": [],
  "rewards": [],
  "return_to_main_plot": "...",
  "gm_summary": "..."
}
```

## Ingestion Pipeline

V1 ingestion should be a pipeline, not a conversation.

## Step 1: Import

Accepted formats:

- PDF
- DOCX
- Markdown
- TXT

Optional later:

- HTML
- pasted notes
- session transcript uploads

## Step 2: Extract text

Goals:

- extract clean text
- retain page or section references
- retain document identity
- preserve chunk provenance

For PDFs, preserve page references if possible.

## Step 3: Chunking

Each chunk should preserve:

- source document id
- page range
- section title if known
- chunk index

Do not chunk only by token length.

Prefer:

- section-aware chunking
- page-aware chunking
- overlap where needed

## Step 4: Fact extraction

For each chunk, call the model with a strict output schema.

The model should extract:

- locations
- NPCs
- factions
- events
- clues
- unresolved tensions
- explicit overrides
- references to the current town

The output should always include:

- fact type
- subject
- value
- confidence
- source reference

## Step 5: Canon merge

Merge extracted facts into canon candidates.

Rules:

- do not silently delete conflicting facts
- preserve conflicting candidates
- mark conflicts for review
- apply precedence rules only after human review or explicit confidence thresholds

## Step 6: Human canon review

The GM must be able to confirm or override:

- which NPC states are current
- which locations have changed
- which hooks are still unresolved
- which facts are stale

This step is mandatory.

V1 should not claim full canon correctness without it.

## Why Human Review Is Mandatory

Campaign memory is not the same thing as document memory.

The documents may say:

- "NPC alive"

The actual table may say:

- "NPC dead three sessions ago"

That is not a parsing problem. That is a canon problem.

The system should help the GM review canon, not pretend to replace that judgment.

## Working Context Builder

The generator should not consume the full memory core.

It should consume a purpose-built working context.

For a town-based side quest, the working context builder should gather:

- current town profile
- party level
- campaign tone
- active NPCs relevant to the town
- active factions relevant to the town
- unresolved threads related to the town
- recent session deltas
- quest request fields

This should be assembled deterministically before generation.

## Quest Generation

The quest generator should output a structured draft.

Not prose-first.

Not PDF-first.

Structured JSON first.

## QuestDraft schema

```json
{
  "title": "string",
  "premise": "string",
  "hook": "string",
  "scenes": [
    {
      "name": "string",
      "goal": "string",
      "summary": "string",
      "location": "string",
      "conflict_type": "social|investigation|combat|exploration",
      "outcome_options": ["string"]
    }
  ],
  "npcs": [
    {
      "name": "string",
      "role": "string",
      "motivation": "string",
      "secret": "string"
    }
  ],
  "encounters": [
    {
      "name": "string",
      "difficulty_target": "easy|medium|hard|deadly",
      "purpose": "string",
      "notes": "string"
    }
  ],
  "rewards": [
    {
      "type": "gold|item|favor|information|boon",
      "value": "string"
    }
  ],
  "return_to_main_plot": "string",
  "gm_summary": "string"
}
```

## Quest Validator

V1 needs a validator before the result is shown as ready.

Validator checks:

- title exists
- premise exists
- hook exists
- `3 to 5` scenes
- every scene has goal and location
- at least one named NPC
- at least one conflict or encounter path
- `return_to_main_plot` exists
- tone is consistent with campaign tone
- quest is compatible with town framing

If a draft fails validation, it should be marked:

- `invalid`
- `needs_regeneration`
- or `needs_manual_fix`

## Export Strategy

Export must be decoupled from generation.

The quest exists as a structured draft first.

Then renderers can produce:

- GM Markdown
- simple HTML
- later PDF
- later VTT format

V1 should only ship:

- structured editor view
- Markdown export
- simple printable HTML

That is enough.

## BYOK Model

V1 should support user-provided API keys.

## What the user provides

- OpenAI API key

## What the system stores

- source documents
- extracted chunks
- embeddings or retrieval references
- fact records
- canon records
- quest drafts

The API key is not the memory.

It is only the compute credential.

## API key UX requirements

- clear onboarding
- test key button
- visible token usage estimate where possible
- model/provider selection hidden in V1 unless necessary

V1 should optimize for:

- one provider
- one key
- one happy path

## External Tool Positioning

External tools are allowed, but they are sidecars.

They are not the source of truth.

## NotebookLM

Good for:

- reading long official PDFs
- helping a GM summarize a large module
- manual research and question answering

Not good as core runtime memory because:

- it is not your canonical store
- updates can be awkward
- it is a user-facing research product, not your deterministic app backend

Use it later as an optional helper, not as the core.

## Notion

Good for:

- human-readable canon dashboards
- editable NPC lists
- location pages
- unresolved thread tracking

Not ideal as core runtime memory because:

- your generator should not depend on a human workspace tool as source of truth

Use it later as:

- optional export target
- optional canon review surface

## V1 User Flow

```text
1. Create campaign
2. Upload official PDF and notes
3. System extracts facts
4. GM reviews canon conflicts
5. GM selects current town
6. GM chooses quest type and constraints
7. System generates structured quest draft
8. Validator checks draft
9. GM edits draft
10. Export GM packet
```

## V1 Screens

Keep this simple.

### 1. Campaign setup

- campaign name
- system
- tone
- party level

### 2. Document import

- upload files
- processing status
- per-file source labels

### 3. Canon review

- facts by category
- conflict indicators
- mark active / overridden / uncertain

### 4. Town quest request

- town name
- town vibe
- local tension
- quest type
- main plot relation
- extra context

### 5. Quest draft editor

- title
- premise
- scenes
- NPCs
- encounters
- rewards
- return to main plot
- GM summary

## V1 Non-Goals

These must stay out:

- automatic map generation
- image generation
- direct marketplace publishing
- DMs Guild export
- DriveThru export
- player handout pipeline
- voice features
- collaborative multiplayer editing
- automatic encounter math engine with full CR fidelity
- automatic parsing of every possible file type

## Edge Cases

V1 must explicitly handle these.

### Import edge cases

- PDF has poor text extraction
- DOCX includes weird formatting
- duplicate uploads
- extremely long campaign files
- notes contradict official material

### Canon edge cases

- NPC appears alive in one source and dead in another
- two towns share similar names
- a clue is resolved in notes but unresolved in module text
- a GM note is ambiguous

### Generation edge cases

- too little town context
- too much town context
- no clear unresolved thread
- quest type conflicts with tone
- strong-return requested but no obvious return hook exists

### UX edge cases

- user only uploads the official PDF
- user uploads only messy notes
- user provides no extra context
- user wants to regenerate only scenes, not the whole quest

## Test Plan

V1 should include these test groups.

## Parsing tests

- imports supported file types
- preserves source metadata
- creates chunk references

## Fact extraction tests

- outputs valid schema
- every fact has source provenance
- extraction does not drop core entity categories

## Canon tests

- conflicts are surfaced
- precedence rules are applied correctly
- overridden facts do not appear in active working context

## Context builder tests

- current town facts are included
- irrelevant distant facts are excluded
- recent deltas are included

## Quest generation tests

- output matches schema
- includes `return_to_main_plot`
- respects `3 to 5` scene limit
- responds to quest type changes

## Render tests

- draft renders to Markdown
- draft renders to HTML

## Golden scenario tests

At least five fixed scenarios:

1. official module PDF only
2. module PDF plus heavy GM overrides
3. town with political tension
4. town with monster-hunt hook
5. minimal context plus one strong unresolved thread

## Recommended Milestones

### Milestone 1: Memory core foundation

- create campaign model
- import files
- extract text
- chunk documents

### Milestone 2: Fact extraction

- define extraction schema
- extract facts from chunks
- store facts with provenance

### Milestone 3: Canon review

- conflict detection
- active vs overridden state
- human review UI

### Milestone 4: Working context and generation

- town context builder
- quest request form
- structured quest generation
- validator

### Milestone 5: GM editing and export

- draft editor
- Markdown export
- simple HTML export

## Open Questions

- Should V1 store embeddings locally or rely on provider retrieval only?
- Should town profiles be extracted automatically or manually created first?
- Should session notes become first-class records in V1 or remain source documents only?
- Should canon review be fact-by-fact or grouped by entity?

## Final Recommendation

Build V1 as a `memory-first GM workbench`, not a generic quest generator.

The architecture should be:

- deterministic where possible
- schema-driven
- human-reviewed at canon boundaries
- model-assisted only where models actually add value

The right V1 bet is:

> ingest messy campaign materials, build usable campaign memory, and generate a town-based side quest from a small working context.

That is focused enough to build.

That is useful enough to matter.

That is the version worth doing.

Future sessions should resume from `docs/superpowers/plans/2026-04-09-memory-first-gm-workbench.md`.

