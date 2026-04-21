# Memory-First GM Workbench

This repo is a local-first V1 for importing campaign sources, extracting canon facts, reviewing overrides, and generating a town-based side quest.

## Agent Docs

If you are working on this repo with an agent, start here:

- [AGENTS.md](./AGENTS.md)
- [ARCHITECTURE.md](./ARCHITECTURE.md)

## Chinese Onboarding

If you plan to use the app primarily in Chinese, start here:

- [Chinese onboarding guide](./docs/product/chinese-onboarding.md)
- [Chinese prompt templates](./docs/product/chinese-prompts.md)
- [Official module excerpt example](./tests/fixtures/official-module-excerpt.zh.md)
- [GM override example](./tests/fixtures/gm-overrides.zh.md)

## English Mirrors

If you want to read the same workflow in English, use these mirrors:

- [English onboarding guide](./docs/product/chinese-onboarding.en.md)
- [English prompt templates](./docs/product/chinese-prompts.en.md)
- [Official module excerpt example](./tests/fixtures/official-module-excerpt.en.md)
- [GM override example](./tests/fixtures/gm-overrides.en.md)

## Local Setup

Fast path:

```bash
pnpm boot
```

That single command will:

- create `.env` from `.env.example` if needed
- install dependencies if `node_modules` is missing
- run Prisma migrations
- generate the Prisma client
- validate the Prisma schema
- start the Next.js dev server

Then open `http://localhost:3000`.

## Local Auto-Start On Windows

If you want the app to come up automatically after you log in on your local Windows machine, use the production launcher plus a Scheduled Task.

One-time install:

```bash
pnpm autostart:install
```

Manual local production run:

```bash
pnpm serve:local
```

What this does:

- installs dependencies if missing
- creates `.env` from `.env.example` if needed
- runs `prisma migrate deploy`
- regenerates the Prisma client
- rebuilds the app only when source files are newer than the current `.next` build
- starts the app on `http://127.0.0.1:9779`

Remove the auto-start task later:

```bash
pnpm autostart:remove
```

1. Install dependencies:

```bash
pnpm install
```

2. Configure env vars in `.env`:

```env
OPENAI_API_KEY=your-key-here
DATABASE_URL=file:./dev.db
```

3. Prepare the database:

```bash
pnpm prisma migrate dev
pnpm prisma:generate
pnpm prisma validate
```

4. Start the app:

```bash
pnpm dev
```

## Environment Variables

- `OPENAI_API_KEY`: optional for direct local experiments with OpenAI-family clients, but the main app workflow is campaign-scoped and expects provider credentials to be saved in the UI.
- `DATABASE_URL`: SQLite connection string. The default V1 setup uses `file:./dev.db`.

## How BYOK Works

BYOK means the GM can supply provider credentials directly inside a campaign.

The current V1 user workflow is:

1. open the campaign's LLM settings page
2. choose a provider
3. save the API key, model, and optional base URL for that campaign

Those credentials are used for model calls only. They are not part of the campaign memory, canon, or quest draft data.

## Upload Storage

Uploaded source files are stored locally under:

```text
data/uploads/<campaignId>/
```

Each saved file gets a timestamped, randomized filename so the original upload name does not need to be unique.

## Test And Validation Commands

If you changed `prisma/schema.prisma` or pulled schema changes from another branch, refresh the Prisma client before typecheck or tests. A stale client can produce false-negative review noise that looks like broken app code.

Recommended verification order:

```bash
pnpm prisma migrate dev
pnpm prisma:generate
pnpm typecheck
pnpm vitest run
```

```bash
pnpm vitest run
pnpm playwright test
pnpm prisma validate
```

Useful focused commands:

```bash
pnpm test
pnpm test:e2e
pnpm typecheck
```

## Live Provider Smoke

Default E2E is mock-first and does not hit real providers.

If you want to manually verify real `OpenAI Responses`, `OpenAI Chat`, or `Anthropic` flows, start here:

- [Live provider smoke guide](./docs/testing/live-provider-smoke.md)

## GitNexus Analyze Wrapper

For this repository, do not use raw `gitnexus analyze` as the default command if you want to preserve your own `AGENTS.md` and `CLAUDE.md` content.

Use:

```bash
pnpm run gitnexus:analyze
```

This wrapper:

- extracts the current human-authored content from `AGENTS.md` and `CLAUDE.md`
- runs `gitnexus analyze`
- rebuilds those files with your content plus the latest GitNexus section
- saves backups under `.gitnexus-preserve/backups/`

If the repository has no `.git` directory, the wrapper automatically adds `--skip-git` for that run.

## Sample Workflow

1. Create a campaign.
2. Upload an official module excerpt and GM notes.
3. Review extracted canon facts and mark conflicts.
4. Enter the current town, tone, and local tension.
5. Generate a structured quest draft.
6. Edit the draft and export the GM packet.

## Known V1 Limits

- V1 supports `OpenAI Responses`, `OpenAI Chat`, and `Anthropic`, but real-provider verification is still an explicit manual smoke step, not part of the default regression suite.
- Canon review is still mandatory before a draft is considered trustworthy.
- Uploaded files stay local on disk. There is no remote object store in V1.
- The generator expects structured JSON-first output, not prose-first output.
- V1 ships with Markdown and simple printable HTML export, not PDF or VTT publishing.
