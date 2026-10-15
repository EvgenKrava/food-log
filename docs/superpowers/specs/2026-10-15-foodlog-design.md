# FoodLog — Design Spec

- **Date:** 2026-10-15
- **Status:** Draft for review
- **Repo:** `~/Work/FoodLog`
- **Domain:** `foodlog.onlytools.click`
- **AWS:** profile `yevhenii`, region `us-east-1`

## 1. Purpose

FoodLog is a public, phone-first web app (PWA) for counting consumed calories and macros (protein / fat / carbs, "БЖУ"). Users log what they eat per day against a daily target, build a shared catalog of products (seeded from Open Food Facts, extended by barcode lookups and AI label scans), and save dishes composed of products.

### Success criteria

- Logging a favorite or recent item takes ≤ 3 taps from the Today screen.
- Label photo → pre-filled product form in < 10 s (p95).
- Search-as-you-type results in < 300 ms (p95, warm Lambda).
- Works one-handed on a phone; installable as a PWA on iOS and Android.
- Incremental idle cost ≤ $0.10 / month (zero traffic).

### Decisions taken during brainstorming

| Topic | Decision |
|---|---|
| Audience | Public service, open sign-up |
| Core | Daily diary with targets, split into breakfast / lunch / dinner / snack |
| Catalog source | Open Food Facts (OFF) import + live barcode lookup + user-created items |
| Catalog visibility | Shared catalog; user submissions are **moderated before publication** |
| Label scan | AI fills a form; the user reviews and saves (never auto-saved) |
| Dish weight | Sum of ingredients by default; optional cooked weight overrides it |
| Languages | Ukrainian + English (i18n) |
| Sign-in | Email/password + Google (Cognito) |
| Targets | Calculated (Mifflin–St Jeor) with manual override |
| AI quota | 20 scans / user / day + 300 scans / day service-wide |
| MVP extras | Favorites & recents, weekly/monthly stats, body-weight log, PWA |
| Catalog/search approach | Own catalog in DynamoDB + OFF import + in-memory MiniSearch index in Lambda |
| Lambda runtime | `nodejs26.x` (public preview now, GA targeted Nov 2026); fallback `nodejs24.x` via one Terraform variable |
| UI kit | Tailwind CSS + shadcn/ui |
| IaC | Terraform |
| Dish default visibility | Private (publish toggle off); products default to publish toggle on |

## 2. Scope

### In MVP

- Auth (email + Google), onboarding profile wizard, calculated/manual targets.
- Today diary: entries per meal, day totals vs target, edit/delete entries, date navigation.
- Search across the public catalog and the user's own items; favorites; recents.
- Barcode scanning (camera) with OFF fallback.
- AI label scan → product form.
- Manual product create/edit; "copy & fix" of any public product.
- Dish builder with live totals and per-100 g values.
- Moderation queue (`/admin`) for products, dishes and revisions.
- Stats: week / month daily kcal vs target, average macros, weight chart.
- Body-weight log.
- PWA (installable, shell cached, read-only offline diary).
- Account deletion, Privacy and Terms pages, OFF (ODbL) attribution.
- AWS Budget alert at $10 / month.

### Out of MVP (roadmap)

SES for auth emails (Cognito's default sender is capped at 50 emails/day), CI/CD, nested dishes (dish inside a dish), unit types other than grams (pieces, ml), copy a meal to another day, user complaints / reports, contributing products back to OFF, offline writes, water tracking, Apple sign-in, Cognito custom domain, importing more countries than Ukraine.

## 3. Users and roles

- **User** — any signed-up account. Owns a diary, profile, weight log, favorites, and their own products/dishes.
- **Admin** — a user in the Cognito group `admin`. Additionally sees `/admin` and may approve, reject, or hide any catalog item.

`ownerId` is always the JWT `sub`; it is never read from request input. Admin checks read `cognito:groups` from the token.

## 4. Architecture

```
foodlog.onlytools.click ─► CloudFront ─┬─► S3 site bucket (SPA + PWA assets)
                                       └─► /api/* ─► API Gateway HTTP API (Cognito JWT authorizer)
                                                      ├─ λ api      CRUD: products, dishes, diary, profile, weight, favorites, moderation, account
                                                      ├─ λ search   MiniSearch index held in memory (loaded from S3)
                                                      ├─ λ scan     label photo → Bedrock Claude Haiku 5.5 (vision)
                                                      └─ λ indexer  rebuilds the search index (async, reserved concurrency 1)
   DynamoDB single table (on-demand) · S3 uploads bucket (presigned POST) · S3 index bucket · OFF API (barcode misses)
   Cognito user pool (email + Google), Managed Login on the Cognito prefix domain
```

- SPA and API share one origin (`/api/*` CloudFront behavior → API Gateway), so there is no CORS configuration.
- The default (S3) behavior uses a CloudFront Function that rewrites extensionless URIs to `/index.html`. CloudFront custom error responses are **not** used, because they would also rewrite API 403/404 responses.
- Request flow: API Gateway → Lambda handler (thin: parse with Zod, call domain/application, shape response) → repository port → DynamoDB.
- All Lambdas: arm64, Node 26 (`nodejs26.x`), ESM bundles built by esbuild, AWS SDK v3 bundled.

| Function | Memory | Timeout | Notes |
|---|---|---|---|
| `api` | 512 MB | 10 s | Single function with a small router for all CRUD routes |
| `search` | 1024 MB | 5 s | Loads index at cold start; re-checks S3 ETag at most every 60 s |
| `scan` | 512 MB | 30 s | Bedrock call; API Gateway HTTP API caps integrations at 30 s |
| `indexer` | 1024 MB | 300 s | Invoked asynchronously; reserved concurrency 1 serializes builds |

## 5. Repository layout

pnpm workspaces + Turborepo, TypeScript strict, ESLint + Prettier, Vitest, conventional commits.

```
apps/web             React 19 + Vite, TanStack Router (file-based) / Query / Form, Tailwind + shadcn/ui,
                     vite-plugin-pwa, i18next (uk, en), oidc-client-ts, barcode-detector, Recharts (lazy)
apps/api             Lambda handlers (api, search, scan, indexer), adapters: DynamoDB repositories,
                     Bedrock LabelReader, OFF BarcodeLookup, S3; local dev HTTP server
packages/domain      Pure TS: nutrition math, dish math, label normalization, targets, validation,
                     moderation state machine, quota rules, repository/port interfaces. No AWS SDK.
packages/contracts   Zod schemas for every request/response; types via z.infer
packages/api-client  Typed fetch client used by apps/web
scripts/off-import   DuckDB-based OFF import → DynamoDB, then invokes indexer
infra/bootstrap      Terraform (local state): the S3 state bucket
infra/live           Terraform root module (S3 backend, use_lockfile) + modules: data, auth, api, web, budget
scripts/deploy.sh    build → terraform apply → web env from outputs → vite build → s3 sync → CloudFront invalidation
```

Rules: `type` aliases by default, `interface` only for ports; never `any`; no TODO/stub code; domain logic lives in `packages/domain` and is unit-tested.

## 6. Domain model

All IDs are ULIDs, except imported OFF products whose ID is `off-<ean>` (deterministic, so re-imports are idempotent).

### Nutrition

`Nutrients = { kcal: number; protein: number; fat: number; carbs: number }` — grams for macros, kcal for energy. Stored at full precision; displayed as integer kcal and one-decimal macros.

### Product

| Field | Notes |
|---|---|
| `id`, `name`, `brand?`, `barcode?` | `barcode` is EAN-8/EAN-13/UPC-A digits |
| `per100g: Nutrients` | |
| `servingSizeG?` | Offered as a quick-pick in the grams sheet |
| `source` | `off` or `user` |
| `ownerId?` | Absent for `off` |
| `status` | `private` · `pending` · `approved` · `rejected` · `hidden` |
| `rejectReason?` | Set on reject |
| `pendingRevision?` | Proposed edits to an approved item (same editable fields) |
| `photoKey?` | S3 key of the label photo, if created from a scan |
| `createdAt`, `updatedAt` | ISO timestamps |

`source = off` products are read-only for everyone except admins (hide). Any user may **copy & fix** a public product: the web app opens a new product form prefilled from it (client-side), and saving it via `POST /products` creates an independent `user` product.

### Dish

| Field | Notes |
|---|---|
| `id`, `name`, `ownerId`, `status`, `rejectReason?`, `pendingRevision?` | Same moderation fields as Product |
| `ingredients: { productId; name; grams; per100g }[]` | `name` and `per100g` are snapshots taken when the dish is saved |
| `cookedWeightG?` | Optional |
| `totals: Nutrients`, `weightG`, `per100g: Nutrients` | Derived; always recomputed server-side |

Ingredients are products only. Because ingredients carry snapshots, a published dish stays self-contained even if a referenced product is private, edited, or deleted.

### DiaryEntry

`{ id, date: 'YYYY-MM-DD' (user's local date), meal: 'breakfast'|'lunch'|'dinner'|'snack', item: { type: 'product'|'dish'; id }, name, per100g, grams, nutrients, createdAt }` — `name`, `per100g` and `nutrients` are snapshots, so later edits, moderation or deletion of the item never change history.

### Profile, weight, favorites

- `Profile = { sex: 'male'|'female'; birthYear; heightCm; activity: 'sedentary'|'light'|'moderate'|'active'|'very_active'; goal: 'lose'|'maintain'|'gain'; targets: Nutrients; targetsManual: boolean; locale: 'uk'|'en' }`
- `WeightEntry = { date; kg }` — the latest entry is the current weight.
- `Favorite = { type: 'product'|'dish'; id; addedAt }`
- Recents are derived (not stored): distinct items from diary entries of the last 30 days, newest first, max 20.

### Calculations (`packages/domain`)

- Entry: `nutrients = per100g × grams / 100`.
- Dish: `totals = Σ(ingredient.per100g × grams / 100)`; `weightG = cookedWeightG ?? Σ grams`; `per100g = totals / weightG × 100`. `weightG` must be > 0.
- Day totals: sum of entry nutrients; meal subtotals likewise.
- Label normalization: if `basis = perServing`, scale by `100 / servingSizeG` (missing `servingSizeG` leaves per-100 g fields empty with warning `SERVING_SIZE_REQUIRED`); if only kJ is present, `kcal = kJ / 4.184`.
- Targets (Mifflin–St Jeor): `BMR = 10·kg + 6.25·cm − 5·age + (male ? 5 : −161)`; `TDEE = BMR × {1.2, 1.375, 1.55, 1.725, 1.9}[activity]`; `kcal = TDEE × {lose: 0.85, maintain: 1.0, gain: 1.10}`; `protein = 1.6 g × kg`; `fat = 0.25 × kcal / 9`; `carbs = (kcal − 4·protein − 9·fat) / 4`, floored at 0. `age = currentYear − birthYear`.
- When `targetsManual` is true, new weight entries never overwrite targets; the UI offers "recalculate".

### Validation (shared by forms and API)

- `kcal` 0–900, each macro 0–100, `protein + fat + carbs ≤ 100` (per 100 g).
- Grams in diary entries and ingredients: > 0 and ≤ 5000.
- Warning (not an error) `KCAL_MISMATCH` when `|kcal − (4P + 9F + 4C)| / max(kcal, 1) > 0.2` — catches misread labels; shown in the form and in the moderation card.

### Moderation state machine

```
private ──publish──► pending ──approve──► approved ──hide (admin)──► hidden
   ▲                    │                    │
   └──── unpublish ─────┘                    └──edit by author──► approved + pendingRevision
                     reject                                         ├─approve → revision merged
                        ▼                                           └─reject  → revision dropped (reason kept)
                    rejected ──edit + publish──► pending
```

- New products: publish toggle **on** by default; new dishes: **off** by default.
- `unpublish` is allowed only from `pending` (back to `private`); an approved item leaves the catalog only by author deletion (anonymized, stays public) or admin hide.
- The author can use their own `private`, `pending` and `rejected` items immediately.
- On create/publish with a barcode, if an `approved` product with the same barcode exists, the API returns `DUPLICATE_BARCODE` with that product so the UI can offer it instead.
- Authors may delete their own non-approved items; deleting an approved item anonymizes it instead (`ownerId` removed) so other users' favorites keep working.
- Approve, hide, and import trigger an index rebuild.

### Quotas

Per scan attempt (successful or not): one DynamoDB `TransactWriteItems` with two conditional `ADD count 1` updates — `QUOTA#<uid>` / `<UTC date>` with `count < 20`, and `QUOTA#GLOBAL` / `<UTC date>` with `count < 300`. Either condition failing → `QUOTA_EXCEEDED`. Items expire via TTL two days later. Limits are Lambda environment variables.

## 7. Storage

### DynamoDB — single table `foodlog`, on-demand, TTL attribute `expiresAt`, point-in-time recovery off

| Item | PK | SK | GSI1 barcode | GSI2 owner | GSI3 moderation (sparse) | GSI4 public catalog (sparse) |
|---|---|---|---|---|---|---|
| Product | `PRODUCT#<id>` | `META` | `BARCODE#<ean>` / `<status>#<id>` | `OWNER#<uid>` / `PRODUCT#<updatedAt>#<id>` | `MOD#PENDING` / `<submittedAt>#PRODUCT#<id>` | `PUBLIC#<shard>` / `PRODUCT#<id>` |
| Dish | `DISH#<id>` | `META` | — | `OWNER#<uid>` / `DISH#<updatedAt>#<id>` | `MOD#PENDING` / `<submittedAt>#DISH#<id>` | `PUBLIC#<shard>` / `DISH#<id>` |
| Diary entry | `USER#<uid>` | `DAY#<date>#<id>` | | | | |
| Weight | `USER#<uid>` | `WEIGHT#<date>` | | | | |
| Profile | `USER#<uid>` | `PROFILE` | | | | |
| Favorite | `USER#<uid>` | `FAV#<type>#<id>` | | | | |
| Quota | `QUOTA#<uid>` or `QUOTA#GLOBAL` | `<UTC date>` | | | | |

- GSI1 sort key starts with the status, so `approved` sorts first among products sharing a barcode.
- GSI3 attributes exist only while the item is `pending` or has a `pendingRevision`.
- GSI4 attributes exist only while the item is `approved`; `shard = crc32(id) % 10`, so the indexer reads 10 partitions in parallel.
- Day queries use `begins_with(SK, 'DAY#<date>#')`; stats and recents use `SK BETWEEN 'DAY#<from>' AND 'DAY#<to>~'`.

### S3

| Bucket | Contents | Lifecycle |
|---|---|---|
| site | SPA build | none (deploy syncs with `--delete`) |
| uploads | `scans/<uid>/<ulid>.jpg` (unattached), `products/<productId>.jpg` (attached on save via copy) | `scans/` expires after 1 day |
| index | `catalog-index.json.gz` (fixed key, versioning on) | noncurrent versions expire after 7 days |
| tfstate | Terraform state (versioning on) | noncurrent versions expire after 90 days |

All buckets: block public access, SSE-S3, CloudFront reads the site bucket via OAC. Admins view label photos through short-lived presigned GET URLs returned by the moderation endpoint.

## 8. Catalog and search

### OFF import (`pnpm seed:off`, run locally, re-runnable)

1. DuckDB reads `hf://datasets/openfoodfacts/product-database/food.parquet` (official daily OFF export).
2. Filter: `countries_tags` contains `en:ukraine`; has energy (kcal or kJ per 100 g), protein, fat and carbs per 100 g; passes domain validation; has a name.
3. Name preference: Ukrainian → English → Russian → generic `product_name`. Brand = first entry of `brands`.
4. Upsert as `off-<ean>`, `source: off`, `status: approved` (BatchWriteItem), then invoke `indexer`.
5. The exact parquet column mapping is verified against the live schema at the start of implementation; the filter rules above are the requirement.

### Index

- Documents: approved products and dishes `{ id, type, name, brand, kcal, protein, fat, carbs, source }`.
- MiniSearch: fields `name` (boost 3) and `brand` (boost 1); `prefix: true`, `fuzzy: 0.2`, `combineWith: 'AND'`; term processing lowercases, applies NFKC, maps `ё→е`, and strips apostrophes (`'`, `’`, `ʼ`).
- `indexer` reads GSI4 (10 shards in parallel), builds the index, and writes gzipped JSON to `catalog-index.json.gz`. Builds are serialized by reserved concurrency 1 (async invocations queue and retry). Sized for up to ~100k documents.
- Triggers: import, approve (item or revision), hide, delete/anonymize of approved items, and caching a new OFF product from a barcode lookup.

### Search (`GET /search?q=&type=all|product|dish`)

- `q` empty → favorites first, then recents.
- Otherwise: MiniSearch over the public index (top 30) + the user's own non-approved items (GSI2 query, matched with the same term processing), merged; own items first on equal score. Each result carries `source` / `status` for badges.
- The web app debounces input by 150 ms and cancels in-flight requests.

### Barcode (`GET /products/barcode/{ean}`)

1. GSI1 query → approved product, else the caller's own product with that barcode.
2. Miss → OFF `GET https://world.openfoodfacts.org/api/v2/product/{ean}` with `fields=code,product_name,product_name_uk,product_name_en,product_name_ru,brands,nutriments,serving_quantity`, User-Agent `FoodLog/1.0 (evgen.cravchenco@gmail.com)`, 3 s timeout. OFF allows 15 product reads/min/IP; one lookup per scan stays well within it.
3. Found and valid → save as `off-<ean>` approved, trigger indexer, return it.
4. Not found / invalid / OFF error → `404 NOT_FOUND`; the UI offers "Photograph the label" with the barcode prefilled.

## 9. Label scan

1. The browser captures a photo (`<input type="file" accept="image/*" capture="environment">`), resizes it to ≤ 1568 px on the long edge, and encodes JPEG quality 0.85.
2. `POST /uploads/presign` → presigned **POST** (policy: `image/jpeg` or `image/webp`, ≤ 5 MB, key `scans/<uid>/<ulid>.jpg`). The browser uploads directly to S3.
3. `POST /scans { key, barcode? }` → `scan` Lambda verifies the key prefix matches the caller's `sub`, consumes quota, reads the object, and calls Bedrock model `us.anthropic.claude-haiku-5-5` (inference profile; overridable via `BEDROCK_MODEL_ID`) with a forced tool:

```
record_label {
  readable: boolean
  name: string, brand?: string, barcode?: string
  basis: 'per100g' | 'perServing'
  servingSizeG?: number
  energyKcal?: number, energyKj?: number
  protein?: number, fat?: number, carbs?: number
}
```

4. The model reports what is printed; `packages/domain` converts to per 100 g and validates (§6). Response: a `ProductDraft` + `warnings[]` + `photoKey`.
5. The user edits and saves via `POST /products` with `photoKey`; the API copies the object to `products/<id>.jpg`.

Failure mapping: `readable: false`, `stop_reason: refusal`, or no usable fields → `422 SCAN_UNREADABLE`; Bedrock throttling/5xx → `503 UPSTREAM_UNAVAILABLE`; quota → `429 QUOTA_EXCEEDED`.

## 10. API

Base path `/api`. All routes require a valid Cognito JWT. Bodies and responses are defined by Zod schemas in `packages/contracts`.

```
GET    /search?q=&type=
GET    /products/barcode/{ean}
POST   /products                         GET|PUT|DELETE /products/{id}
POST   /products/{id}/publish            POST /products/{id}/unpublish
POST   /dishes                           GET|PUT|DELETE /dishes/{id}
POST   /dishes/{id}/publish              POST /dishes/{id}/unpublish
GET    /me/items                         (own products and dishes with statuses)
POST   /uploads/presign                  POST /scans
GET    /diary/{date}                     (entries + totals + targets)
POST   /diary/{date}/entries             PATCH|DELETE /diary/{date}/entries/{id}
GET    /stats?from=&to=                  (≤ 31 days; per-day totals + targets)
GET    /weight?from=&to=                 PUT|DELETE /weight/{date}
GET    /profile                          (profile + suggested targets)        PUT /profile
GET    /favorites                        PUT|DELETE /favorites/{type}/{id}
GET    /recents
DELETE /me                               (account deletion)
GET    /admin/moderation                 (queue; includes presigned photo URLs and duplicate-barcode hints)
POST   /admin/moderation/{type}/{id}/approve
POST   /admin/moderation/{type}/{id}/reject      { reason }
POST   /admin/items/{type}/{id}/hide
```

- Errors: `{ error: { code, message, details? } }` with codes `VALIDATION`, `NOT_FOUND`, `FORBIDDEN`, `CONFLICT`, `DUPLICATE_BARCODE`, `QUOTA_EXCEEDED`, `SCAN_UNREADABLE`, `UPSTREAM_UNAVAILABLE`, `INTERNAL`. The web app translates codes via i18n.
- Diary writes resolve the item server-side and snapshot its values; clients send only `{ meal, item, grams }`.
- `DELETE /me`: deletes all `USER#<uid>` items, own non-approved products/dishes, `scans/<uid>/` objects; anonymizes own approved items; then `AdminDeleteUser` in Cognito.
- Throttling: stage default 20 req/s, burst 40; `POST /scans` 2 req/s, burst 5.

## 11. Frontend

- Navigation: bottom tab bar — **Today · Catalog · Stats · Profile**; floating "+" on Today opens a bottom sheet: Search · Scan barcode · Photo of label · New dish.
- **Today:** date switcher (arrows + calendar), kcal ring vs target, P/F/C bars, four meal sections with subtotals and per-meal "+"; tap entry → grams/meal sheet; swipe to delete.
- **Add:** full-screen search (autofocus), filter chips All / Products / Dishes, favorites and recents when empty. Selecting an item opens the grams sheet: quick chips 50/100/150/200 g (+ serving size if known), live nutrient preview; meal preselected by time of day (before 11:00 breakfast, 11:00–16:00 lunch, 16:00–21:00 dinner, otherwise snack).
- **Product:** details/edit form, status badge, label photo, favorite star, "Copy & fix" for public items.
- **Barcode scanner:** full-screen camera with framing guide (`barcode-detector` ponyfill: native `BarcodeDetector` where available, zxing-wasm elsewhere, e.g. iOS Safari).
- **Label scan:** capture → progress → pre-filled product form with warnings highlighted.
- **Dish builder:** name, ingredient rows (search to add, grams per row), optional cooked weight, live totals and per-100 g computed with `packages/domain`.
- **Catalog:** my products and dishes with status and reject reason.
- **Stats:** week/month toggle, daily kcal bars with target line, average macros, weight line chart (Recharts, lazy-loaded route).
- **Profile:** body parameters, targets (calculated vs manual), quick weight entry, language (uk/en; default from browser, `uk` for `uk`/`ru` browsers), theme (system/light/dark), sign out, delete account.
- **Onboarding:** 3-step wizard after first sign-in (body → activity & goal → review targets).
- **Admin (`/admin`):** moderation queue cards — photo, values, `KCAL_MISMATCH` warning, duplicate-barcode hint, approve / reject-with-reason.
- **Static pages:** Privacy, Terms, and an "Data from Open Food Facts (ODbL)" attribution in the footer of Catalog and About.
- **PWA:** manifest + icons, app-shell precache, TanStack Query cache persisted to IndexedDB for read-only offline viewing; an offline banner disables writes.
- **Auth:** Authorization Code + PKCE via `oidc-client-ts` against Cognito Managed Login; tokens stored in `localStorage` so the installed PWA stays signed in; strict CSP via a CloudFront response headers policy.
- Touch targets ≥ 44 px, safe-area insets respected, light/dark themes.

## 12. Security and privacy

- JWT authorizer on every route; ownership enforced in the application layer using `sub`.
- Admin endpoints check the `admin` group claim in the handler (defense in depth beyond routing).
- Uploads: presigned POST policy restricts type, size and key prefix; `scan` re-checks the prefix.
- Bedrock and OFF are reached only through ports implemented in `apps/api`; tool input is never trusted for identity.
- IAM: one role per function, least privilege (table/GSI ARNs, bucket prefixes, the Bedrock inference profile + foundation model ARNs, `lambda:InvokeFunction` on `indexer` only for functions that trigger it).
- CloudFront managed security headers + CSP; HTTPS only.
- Account deletion as in §10: unattached scans (`scans/<uid>/`) and photos of deleted non-approved products are removed immediately; photos attached to anonymized approved products remain.
- ODbL: attribution displayed; imported data is not presented as our own database.

## 13. Infrastructure (Terraform)

- Terraform ≥ 1.10, AWS provider 6.x; one environment (`prod`).
- `infra/bootstrap` (local state, applied once): `foodlog-tfstate-<accountId>` bucket.
- `infra/live` (S3 backend with `use_lockfile = true`):
  - `data`: DynamoDB table + 4 GSIs + TTL; uploads and index buckets with lifecycle rules.
  - `auth`: Cognito user pool (Essentials tier, email sign-in, self sign-up, email verification via Cognito default sender), Google identity provider, app client (PKCE, no secret), Managed Login on prefix domain, group `admin`.
  - `api`: 4 Lambda functions (zips from `apps/api/dist/*` via `archive_file`), roles, log groups (14-day retention), HTTP API + JWT authorizer + routes + throttling, async invoke config for `indexer`.
  - `web`: site bucket, CloudFront distribution (`PriceClass_100`, OAC, `/api/*` behavior with caching disabled and all viewer headers except Host forwarded, URI-rewrite CloudFront Function, response headers policy), ACM certificate (DNS-validated) and Route 53 alias records for `foodlog.onlytools.click` in existing zone `onlytools.click`.
  - `budget`: AWS Budget, $10 / month, email alert to the account owner.
- Variables: `lambda_runtime` (default `nodejs26.x`), `bedrock_model_id`, `google_client_id`, `google_client_secret` (sensitive, from gitignored `terraform.tfvars`), quota limits, `alert_email`.

### Cost

| Resource | Idle | At small scale |
|---|---|---|
| Lambda, API Gateway HTTP API, CloudFront, Cognito (≤ 10k MAU), DynamoDB on-demand | $0 | cents |
| S3 (~20 MB), CloudWatch Logs (14 days) | < $0.01 | cents |
| Route 53 zone `onlytools.click` | already paid ($0.50) | — |
| Bedrock Haiku 5.5 | $0 | ~$0.004 / scan; hard ceiling 300 scans/day ≈ $1.2/day |

Deliberately excluded (would cost while idle): WAF, CloudWatch alarms, customer-managed KMS keys, Secrets Manager, NAT/VPC, OpenSearch, provisioned concurrency, staging environment.

## 14. Testing

- **Domain (TDD, Vitest):** entry/dish/day math, cooked-weight override, label normalization (per serving, kJ only, missing serving size), targets for each sex/activity/goal, validation and `KCAL_MISMATCH`, moderation transitions (including revisions and anonymization), quota rule, recents derivation, meal-by-time default.
- **Contracts:** schema edge cases (dates, grams bounds, EAN format).
- **API:** handler tests with in-memory repository and port fakes (LabelReader, BarcodeLookup, Indexer trigger, clock); repository integration tests against DynamoDB Local (Docker); index build + search tests on a fixture catalog (Cyrillic, apostrophes, typos, prefixes).
- **Web:** Vitest + Testing Library for the grams sheet, dish builder, and today totals; Playwright smoke test (sign-in stubbed, API mocked with MSW) for log-an-item and build-a-dish flows at a phone viewport.
- Gate: `pnpm turbo run build lint typecheck test`.

## 15. Local development and deployment

- `pnpm dev` — web app against MSW mocks (no AWS needed).
- `pnpm dev:api` — Lambda handlers behind a local Node HTTP server + DynamoDB Local; Bedrock/OFF replaced by fakes unless `USE_REAL_UPSTREAMS=1`.
- `infra/bootstrap`: `terraform init && terraform apply` once.
- `./scripts/deploy.sh` — `pnpm turbo run build` → `terraform apply` (infra/live) → write `apps/web/.env.production` from outputs → `vite build` → `aws s3 sync --delete` → CloudFront invalidation. Uses `AWS_PROFILE=yevhenii` and unsets `AWS_BEARER_TOKEN_BEDROCK`.
- `pnpm seed:off` — OFF import + indexer invoke.

### Manual prerequisites (owner)

1. Create a Google OAuth 2.0 Web client in Google Cloud Console; authorized redirect URI = the Cognito domain's `/oauth2/idpresponse`. Put client ID/secret in `infra/live/terraform.tfvars` (gitignored).
2. After first sign-up, add yourself to the `admin` group (`aws cognito-idp admin-add-user-to-group …`, exact command printed by `deploy.sh`).
3. Confirm the AWS Budget alert subscription email.

## 16. Risks and assumptions

- `nodejs26.x` is a public preview without SLA until GA (targeted Nov 2026). Code avoids Node-26-only APIs; switching to `nodejs24.x` is a one-variable change.
- Cognito's default email sender allows 50 emails/day — enough for launch; SES is on the roadmap if sign-ups exceed it.
- Reserved concurrency for `indexer` requires the account's unreserved concurrency to stay ≥ 10; the account's concurrency limit is checked at the start of implementation. If it cannot be reserved, the indexer instead writes with an S3 conditional `If-Match` on the ETag it read at start and retries the build on `412`.
- OFF coverage for Ukraine may be modest; barcode lookups and user submissions grow the catalog over time.
- AI label reading can be wrong; mitigated by mandatory user review, `KCAL_MISMATCH`, and moderation with the photo before anything becomes public.
