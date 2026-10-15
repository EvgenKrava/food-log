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

## Carry-over obligations from plan 1

Recorded during plan 1's reviews. Each later plan must cover the items addressed to it.

### Plan 2 — backend API

- **Barcodes:** every barcode in a request, path or import goes through `BarcodeSchema` / `normalizeBarcode` (canonical EAN-13, GS1 check digit). `GET /products/barcode/{ean}` parses its path with `BarcodeSchema` so GSI1 keys are canonical. Mappers that build a `Product` from stored or OFF data drop barcodes that fail the check digit (`ProductSchema` rejects them).
- **OFF / model data sanitizing:** trim names and brands, cap names at 120 and brands at 80 characters, require a valid `Per100g` before building a `Product`. Truncate model-output strings (`LabelReading.name/brand/barcode`).
- **Bedrock adapter:** strip `null` fields from the tool input before `LabelReadingSchema.parse` (models sometimes emit `null` for absent values).
- **Quotas:** the quota rule test (per-user 20 / global 300, `TransactWriteItems` conditions) lives with the `ScanQuota` port and use-case.
- **Profile:** when `PutProfileRequest.targetsManual` is false, ignore any supplied `targets` and compute them; a missing weight entry → `CONFLICT`.
- **Uploads:** the presigned POST policy uses `UPLOAD_MAX_BYTES` as `content-length-range` and pins `Content-Type` (the key always ends in `.jpg`).
- **Moderation persistence:** ownership checks and the "admin editing own item acts as author" mapping live in use-cases; normalize impossible stored states on load; marshal DynamoDB items with `removeUndefinedValues`.
- **Inputs to pure math:** `computeDish` / `scaleNutrients` trust their inputs — validate with the contracts first.
- **Recents and empty search:** pass the user's local date (add an optional `today` query param or use `to = addDays(utcToday, 1)`) so entries logged after local midnight in UTC+ zones are not missed.
- **Search index:** MiniSearch must use `tokenize` as its tokenizer and `normalizeSearchText` as `processTerm`.
- **Errors:** add a `ValidationErrorDetailsSchema` (field path → message) so plan 4 can map server errors onto form fields.
- **Lint:** switch `apps/api` to type-aware typescript-eslint (`no-floating-promises`, `no-misused-promises`) before async handlers land.
- **Duplicates:** decide whether `DUPLICATE_BARCODE` applies to private creates ("copy & fix" pre-fills the barcode); an `acknowledgeDuplicate` flag can be added later without breaking clients.

### Plan 3 — infrastructure and import

- **Google IdP:** Terraform reads the client id/secret from the git-ignored `docs/client_secret_*.json` (`jsondecode(file(...))`), never copied into tracked files; the owner adds `https://<cognito domain>/oauth2/idpresponse` as an authorized redirect URI once the domain exists.
- **OFF import:** skip records whose barcode fails the GS1 check digit, or import them without a barcode.

### Plan 4 — web app

- Exclude `upc_e` from the barcode-detector formats (UPC-E is not expanded to UPC-A).
- Forms convert cleared optional inputs (`''`) to `undefined` before parsing (`brand`, `barcode` reject empty strings).
- `CatalogItemSchema` has no `servingSizeG`; add it as an optional field (with the index document) if the grams sheet needs the serving chip without an extra `GET /products/{id}`.
- Zod refined schemas (`Per100gSchema`, `PutProfileRequestSchema`, `UpdateDiaryEntryRequestSchema`) cannot be `.pick`/`.omit`/`.partial`-ed in Zod 4 — export unrefined shapes if forms need partial variants.
- Label drafts are rounded to 0.1 g; near-pure products (oil, sugar) can show `OUT_OF_RANGE` until the user adjusts a value by 0.1 g.
