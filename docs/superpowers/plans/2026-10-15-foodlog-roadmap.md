# FoodLog — Plan Roadmap

Spec: `docs/superpowers/specs/2026-10-15-foodlog-design.md`

The spec spans four subsystems. Each gets its own plan, written after the previous one is executed so it can cite the real interfaces (not guessed ones). Every plan ends with working, tested software.

| # | Plan | Delivers | Depends on |
|---|---|---|---|
| 1 | `2026-10-15-foodlog-01-foundation.md` | pnpm/Turborepo monorepo, tooling, `packages/contracts` (all Zod API schemas), `packages/domain` (nutrition, dish, label, barcode, targets, moderation, recents, search text) — fully unit-tested | — |
| 2 | Backend API (to be written) | Ports + use-cases, DynamoDB repositories (DynamoDB Local tests), `api` / `search` / `scan` / `indexer` Lambda handlers, Bedrock `LabelReader`, OFF `BarcodeLookup`, quotas, account deletion, local dev HTTP server | 1 |
| 3 | Infrastructure & deploy (to be written) | Terraform bootstrap + live modules (data, auth, api, web, budget), `scripts/deploy.sh`, OFF import (`pnpm seed:off`), live API at `foodlog.onlytools.click/api` | 2 |
| 4 | Web app (to be written) | React PWA (TanStack Router/Query/Form, Tailwind + shadcn/ui, i18n uk/en), all screens incl. scanner, label scan, dish builder, stats, admin; deployed | 1 (MSW mocks); 3 for live deploy |

Plan 4 may start right after plan 1 (it develops against MSW mocks generated from the contracts) and run alongside plans 2–3.
