---
title: Chinese Onboarding Guide
tags:
  - onboarding
  - english
  - gm-workbench
---

# Chinese Onboarding Guide

> [!info] Scope
> This guide covers the features currently shipped in this repo:
> campaign creation, source upload, canon review, quest request, quest editor, and GM packet preview.
> It does not cover PDF publishing or marketplace release workflows yet.

## What to do first

Do not start by uploading a whole long-form module PDF.

Start with a smaller, controlled Chinese source set:

1. An official module excerpt
2. A GM override note
3. A clearly defined town
4. A single quest goal

That is the fastest way to see whether the workbench is useful for your table.

## Startup

From the project root:

```bash
pnpm install
pnpm prisma migrate dev
pnpm dev
```

Then open:

- [http://127.0.0.1:3000/campaigns/new](http://127.0.0.1:3000/campaigns/new)

> [!warning] About the OpenAI key
> You can use the app without `OPENAI_API_KEY`, but quest drafts will fall back to the local draft generator instead of a real model call.
> If you want to test model-backed generation, set:
>
> ```env
> DATABASE_URL="file:./dev.db"
> OPENAI_API_KEY="your key"
> ```

## Recommended first run

### 1. Create a campaign

Fill in the `Campaign setup` form with:

- `Campaign name`
- `Party level`
- `Tone`
- `Content constraints`

You can do this in Chinese from the start.

### 2. Upload two source files

The app accepts:

- `.txt`
- `.md`
- `.docx`
- `.pdf`

For the first run, upload:

1. An official module excerpt
2. A GM override note

### 3. Open Canon Review

Do not skip this step.

The app extracts facts from source files, but those facts are not automatically the final truth for your table.

Your job here is to:

- keep correct facts as `active`
- mark rewritten facts as overridden
- leave uncertain items as `uncertain`

### 4. Open Request Quest

From campaign overview or canon review, open `Request quest`.

The most important fields are:

- `Town name`
- `Town vibe`
- `Local tension`
- `Quest type`
- `Main plot relation`
- `Desired length`
- `Extra context`

### 5. Generate the quest draft

The app will return a structured draft:

- title
- premise
- hook
- scenes
- NPCs
- rewards
- return path
- GM summary

That is a good shape for editing. It is not yet a final publishable PDF.

### 6. Edit the quest draft

In the quest editor, you can edit:

- title
- premise
- hook
- scenes
- NPCs
- rewards
- return path
- summary

The GM packet preview updates alongside the draft.

## Suggested source format

Write your source notes as facts, not as long prose dumps.

Suggested structure:

```md
# Module name

## Current location

## Location facts
- ...

## NPC facts
- ...

## Open hooks
- ...

## Constraints
- ...
```

## Suggested GM override format

Separate what already happened from what you want to preserve.

Suggested structure:

```md
# GM override note

## Events that already happened
- ...

## Current true state
- ...

## Main plot direction to preserve
- ...

## Disabled content
- ...
```

## Common mistakes

> [!warning] Mistake 1: Uploading an entire long PDF first
> Do not start there.
> Use an excerpt first.

> [!warning] Mistake 2: Skipping Canon Review
> Do not skip it.
> Without review, the app is only reading files, not understanding what is actually true at your table.

> [!warning] Mistake 3: Writing an empty Extra context
> If you only say “make me a quest,” the result will be generic.
> Be explicit about tone, return path, and what should not happen.

> [!warning] Mistake 4: Treating this as the final publishing tool
> It is not.
> It is a side-quest draft workbench.

## One-line summary

> This is a Chinese-friendly long-campaign side-quest drafting workbench, not the final publishing pipeline.
