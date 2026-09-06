# Carl Graph Report

Built: 2026-09-05T17:19:44.736Z
Extractor: json+typescript

## Corpus stats

- Files: 73
- Nodes: 368
- Edges: 1260
- Symbols: 212
- Modules: 8

## God nodes (highest degree)

- **load.ts** (`src/lib/change/load.ts:L1`) — in:40 out:46 type:file
- **index.ts** (`src/lib/githost/index.ts:L1`) — in:1 out:68 type:file
- **checkpoint.ts** (`src/lib/checkpoint/checkpoint.ts:L1`) — in:41 out:21 type:file
- **fixture.ts** (`src/lib/githost/fixture.ts:L1`) — in:17 out:42 type:file
- **session.ts** (`src/lib/auth/session.ts:L1`) — in:44 out:14 type:file
- **ledger.ts** (`src/lib/ledger/ledger.ts:L1`) — in:33 out:23 type:file
- **session.test.ts** (`src/lib/auth/session.test.ts:L1`) — in:1 out:53 type:file
- **actions.ts** (`src/lib/change/actions.ts:L1`) — in:16 out:36 type:file
- **checkpoint.test.ts** (`src/lib/checkpoint/checkpoint.test.ts:L1`) — in:1 out:50 type:file
- **types.ts** (`src/lib/githost/types.ts:L1`) — in:40 out:7 type:file
- **load.test.ts** (`src/lib/change/load.test.ts:L1`) — in:3 out:41 type:file
- **ledger.test.ts** (`src/lib/ledger/ledger.test.ts:L1`) — in:1 out:43 type:file
- **errors.ts** (`src/lib/githost/errors.ts:L1`) — in:36 out:6 type:file
- **github.ts** (`src/lib/githost/github.ts:L1`) — in:6 out:34 type:file
- **LedgerPanel.tsx** (`src/components/LedgerPanel.tsx:L1`) — in:13 out:21 type:file

## Modules

### src/lib (28 files)
- `src/lib/auth/redirect.test.ts`
- `src/lib/auth/redirect.ts`
- `src/lib/auth/session.test.ts`
- `src/lib/auth/session.ts`
- `src/lib/change/actions.test.ts`
- `src/lib/change/actions.ts`
- `src/lib/change/ledger-status.ts`
- `src/lib/change/load.test.ts`
- `src/lib/change/load.ts`
- `src/lib/checkpoint/checkpoint.test.ts`
- `src/lib/checkpoint/checkpoint.ts`
- `src/lib/env.test.ts`
- … +16 more

### src/components (18 files)
- `src/components/AnswerForm.test.tsx`
- `src/components/AnswerForm.tsx`
- `src/components/ArtifactTabs.test.tsx`
- `src/components/ArtifactTabs.tsx`
- `src/components/ChangeCard.test.tsx`
- `src/components/ChangeCard.tsx`
- `src/components/ChangeHeader.test.tsx`
- `src/components/ChangeHeader.tsx`
- `src/components/ChangeWorkspace.tsx`
- `src/components/DecisionBar.test.tsx`
- `src/components/DecisionBar.tsx`
- `src/components/HostError.tsx`
- … +6 more

### src/app (12 files)
- `src/app/api/fixture/file/route.test.ts`
- `src/app/api/fixture/file/route.ts`
- `src/app/api/session/route.test.ts`
- `src/app/api/session/route.ts`
- `src/app/changes/[name]/actions.ts`
- `src/app/changes/[name]/page.test.tsx`
- `src/app/changes/[name]/page.tsx`
- `src/app/layout.tsx`
- `src/app/login/page.tsx`
- `src/app/manifest.ts`
- `src/app/page.test.tsx`
- `src/app/page.tsx`

### . (8 files)
- `eslint.config.mjs`
- `next.config.ts`
- `package.json`
- `playwright.config.ts`
- `postcss.config.mjs`
- `tsconfig.json`
- `vitest.config.ts`
- `vitest.setup.ts`

### scripts (2 files)
- `scripts/gen-icons.mjs`
- `scripts/gen-ledger-fixtures.mjs`

### src (2 files)
- `src/proxy.test.ts`
- `src/proxy.ts`

### src/test (2 files)
- `src/test/dom.ts`
- `src/test/repo.ts`

### e2e (1 files)
- `e2e/checkpoint.spec.ts`

## Surprising / inferred connections

- `openspec/changes/archive/2026-09-05-build-checkpoint-reader/decisions.md` --implements_spec [INFERRED]--> `src/lib/checkpoint/checkpoint.ts#Checkpoint` (openspec/changes/archive/2026-09-05-build-checkpoint-reader/decisions.md:L17)
- `openspec/changes/archive/2026-09-05-build-checkpoint-reader/design.md` --implements_spec [INFERRED]--> `src/proxy.ts` (openspec/changes/archive/2026-09-05-build-checkpoint-reader/design.md:L33)
- `openspec/changes/archive/2026-09-05-build-checkpoint-reader/design.md` --implements_spec [INFERRED]--> `src/lib/ledger/ledger.ts` (openspec/changes/archive/2026-09-05-build-checkpoint-reader/design.md:L71)
- `openspec/changes/archive/2026-09-05-build-checkpoint-reader/design.md` --implements_spec [INFERRED]--> `scripts/gen-ledger-fixtures.mjs` (openspec/changes/archive/2026-09-05-build-checkpoint-reader/design.md:L71)
- `openspec/changes/archive/2026-09-05-build-checkpoint-reader/design.md` --implements_spec [INFERRED]--> `src/lib/ledger/options.ts` (openspec/changes/archive/2026-09-05-build-checkpoint-reader/design.md:L118)
- `openspec/changes/archive/2026-09-05-build-checkpoint-reader/design.md` --implements_spec [INFERRED]--> `src/lib/githost/fixture.ts` (openspec/changes/archive/2026-09-05-build-checkpoint-reader/design.md:L124)
- `openspec/changes/archive/2026-09-05-build-checkpoint-reader/design.md` --implements_spec [INFERRED]--> `src/app/manifest.ts` (openspec/changes/archive/2026-09-05-build-checkpoint-reader/design.md:L133)
- `openspec/changes/archive/2026-09-05-build-checkpoint-reader/design.md` --implements_spec [INFERRED]--> `src/lib/tasks/tasks.ts` (openspec/changes/archive/2026-09-05-build-checkpoint-reader/design.md:L136)
- `openspec/changes/archive/2026-09-05-build-checkpoint-reader/design.md` --implements_spec [INFERRED]--> `src/app/api/session/route.ts#POST` (openspec/changes/archive/2026-09-05-build-checkpoint-reader/design.md:L33)
- `openspec/changes/archive/2026-09-05-build-checkpoint-reader/design.md` --implements_spec [INFERRED]--> `src/lib/checkpoint/checkpoint.ts#Checkpoint` (openspec/changes/archive/2026-09-05-build-checkpoint-reader/design.md:L115)
- `openspec/changes/archive/2026-09-05-build-checkpoint-reader/design.md` --implements_spec [INFERRED]--> `src/app/api/session/route.ts#DELETE` (openspec/changes/archive/2026-09-05-build-checkpoint-reader/design.md:L149)
- `openspec/changes/archive/2026-09-05-build-checkpoint-reader/design.md` --implements_spec [INFERRED]--> `src/components/ChangeCard.tsx#ChangeCard` (openspec/changes/archive/2026-09-05-build-checkpoint-reader/design.md:L154)
- `openspec/changes/archive/2026-09-05-build-checkpoint-reader/design.md` --implements_spec [INFERRED]--> `src/components/ChangeHeader.tsx#ChangeHeader` (openspec/changes/archive/2026-09-05-build-checkpoint-reader/design.md:L154)
- `openspec/changes/archive/2026-09-05-build-checkpoint-reader/design.md` --implements_spec [INFERRED]--> `src/components/ArtifactTabs.tsx#ArtifactTabs` (openspec/changes/archive/2026-09-05-build-checkpoint-reader/design.md:L154)
- `openspec/changes/archive/2026-09-05-build-checkpoint-reader/design.md` --implements_spec [INFERRED]--> `src/components/Markdown.tsx#Markdown` (openspec/changes/archive/2026-09-05-build-checkpoint-reader/design.md:L154)
- `openspec/changes/archive/2026-09-05-build-checkpoint-reader/design.md` --implements_spec [INFERRED]--> `src/components/LedgerPanel.tsx#LedgerPanel` (openspec/changes/archive/2026-09-05-build-checkpoint-reader/design.md:L155)
- `openspec/changes/archive/2026-09-05-build-checkpoint-reader/design.md` --implements_spec [INFERRED]--> `src/components/AnswerForm.tsx#AnswerForm` (openspec/changes/archive/2026-09-05-build-checkpoint-reader/design.md:L155)
- `openspec/changes/archive/2026-09-05-build-checkpoint-reader/design.md` --implements_spec [INFERRED]--> `src/components/DecisionBar.tsx#DecisionBar` (openspec/changes/archive/2026-09-05-build-checkpoint-reader/design.md:L155)
- `openspec/changes/archive/2026-09-05-build-checkpoint-reader/design.md` --implements_spec [INFERRED]--> `src/components/HostError.tsx#HostError` (openspec/changes/archive/2026-09-05-build-checkpoint-reader/design.md:L155)
- `openspec/changes/archive/2026-09-05-build-checkpoint-reader/design.md` --implements_spec [INFERRED]--> `src/lib/change/load.ts#HostError` (openspec/changes/archive/2026-09-05-build-checkpoint-reader/design.md:L155)

## Cross-module imports (sample)

_None_

## Suggested questions

- Which files import a given symbol? (`carl-graph consumers <symbol>`)
- What is the shortest path between two modules/files? (`carl-graph path A B`)
- What are the hub files in this repo? (see God nodes above)
- Which OpenSpec artifacts mention a symbol? (filter implements_spec edges)

