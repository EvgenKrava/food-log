# FoodLog

A phone-first PWA for counting calories and macros (protein / fat / carbs). Log what you eat per
day against a daily target, pick products from a shared catalog (Open Food Facts import, barcode
lookup, AI label scan) and save your own dishes.

Part of [OnlyTools](https://github.com/EvgenKrava/onlytools-core). Planned at
`https://foodlog.onlytools.click`, signing in through the shared OnlyTools account.

## Status

Early. Plan 1 (foundation) is done: the monorepo, `packages/contracts` and `packages/domain` with
unit tests. The backend API, infrastructure and web app come next. See the
[roadmap](docs/superpowers/plans/2026-10-15-foodlog-roadmap.md).

## Docs

- Design spec: [docs/superpowers/specs/2026-10-15-foodlog-design.md](docs/superpowers/specs/2026-10-15-foodlog-design.md)
- Plans: [docs/superpowers/plans/](docs/superpowers/plans/)

## Layout

| Path | What |
|---|---|
| `packages/contracts` | Zod schemas, the single source of API types |
| `packages/domain` | Pure business rules: nutrition math, dishes, labels, barcodes, targets, moderation |
| `apps/api`, `apps/web`, `infra/`, `scripts/` | Arrive with plans 2–4 |

## Stack

TypeScript (strict), pnpm + Turborepo, Vitest, Zod. Planned: AWS Lambda + API Gateway +
DynamoDB, Bedrock for label scans, React PWA with Tailwind + shadcn/ui, Terraform.

## Develop

Requires Node 24+ and pnpm 9.

```bash
pnpm install
pnpm turbo run lint typecheck test      # all checks
pnpm --filter @foodlog/domain test      # one package
pnpm format
```
