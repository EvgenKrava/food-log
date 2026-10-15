# CLAUDE.md

FoodLog — a public, phone-first PWA for counting calories and macros (БЖУ).

- Spec (source of truth): `docs/superpowers/specs/2026-10-15-foodlog-design.md`
- Plans: `docs/superpowers/plans/` (start with the roadmap)

## Layout

- `packages/contracts` — Zod schemas; the only source of API types (`z.infer`). No hand-written duplicates.
- `packages/domain` — pure business rules; imports only `@foodlog/contracts`; never the AWS SDK or infrastructure.
- `apps/api`, `apps/web`, `scripts/`, `infra/` arrive with plans 2–4.

## Rules

- TypeScript strict, never `any`; `type` aliases by default, `interface` only for ports.
- `erasableSyntaxOnly`: no enums, namespaces or constructor parameter properties — Node runs the sources directly.
- Relative imports end in `.ts`; internal packages are source-only (`exports` → `src/index.ts`), no build step.
- TypeScript stays on `~6.0` (typescript-eslint supports `< 6.1`).
- Code must also run on Node 24 (Lambda fallback runtime).
- TDD for domain logic; no TODO or stub code.
- Conventional commits; never add `Co-Authored-By` lines.

## Commands

- Install: `pnpm install`
- All gates: `pnpm turbo run lint typecheck test`
- One package: `pnpm --filter @foodlog/domain test`
- One file: `pnpm --filter @foodlog/domain test src/dish.test.ts`
- Format: `pnpm format`

## AWS

Profile `yevhenii`, region `us-east-1`. Run `unset AWS_BEARER_TOKEN_BEDROCK` before aws/terraform commands — a stale token in the shell breaks Bedrock calls.
