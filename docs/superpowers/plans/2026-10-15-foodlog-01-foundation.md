# FoodLog Foundation Implementation Plan (Plan 1 of 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the FoodLog monorepo with all API contracts (Zod) and the pure domain rules (nutrition math, dishes, label normalization, barcodes, targets, moderation, recents, search text), fully unit-tested.

**Architecture:** pnpm workspaces + Turborepo. Two source-only internal packages: `@foodlog/contracts` (Zod schemas — the single source of API types) and `@foodlog/domain` (pure functions that import only `@foodlog/contracts`). No build step: packages export `src/index.ts`, relative imports carry `.ts` extensions, and `erasableSyntaxOnly` keeps the sources runnable directly by Node 26, Vite, esbuild and Vitest.

**Tech Stack:** Node 26 (code stays Node 24-compatible), pnpm 9.12, Turborepo 2.11, TypeScript ~6.0.3, Zod 4.6, Vitest 5, ESLint 10 (flat config) + typescript-eslint 8.71, Prettier 3.9.

**Spec:** `docs/superpowers/specs/2026-10-15-foodlog-design.md` (§5 layout and rules, §6 domain model, §7–§10 shapes behind the contracts). Roadmap: `docs/superpowers/plans/2026-10-15-foodlog-roadmap.md`.

## Global Constraints

- TypeScript `~6.0.3` — typescript-eslint 8.71 supports `typescript >=4.8.4 <6.1.0`; do not upgrade to 7.x.
- TypeScript strict; never `any`; `type` aliases by default, `interface` only for ports (none in this plan).
- `erasableSyntaxOnly`: no `enum`, no `namespace`, no constructor parameter properties.
- Relative imports end in `.ts`; type-only imports use `import type` (`verbatimModuleSyntax`).
- Internal packages are source-only: `"exports": { ".": "./src/index.ts" }`, no `build` script.
- `packages/domain` imports only `@foodlog/contracts` — never the AWS SDK or any infrastructure.
- Zod schemas in `packages/contracts` are the source of API types; derive types with `z.infer`, never hand-write duplicates.
- No TODO, stub or placeholder code.
- Code must run on Node 24 (Lambda fallback runtime): no Node-26-only APIs.
- Prettier: `{ "singleQuote": true, "semi": true, "printWidth": 100, "trailingComma": "all" }`.
- Conventional commits; **never** add `Co-Authored-By` lines.
- Work on branch `feat/foundation` (created in Task 1).

## Review Focus

- A barcode scanned as UPC-A (12 digits) and the same product stored as EAN-13 (leading `0`) must resolve to one canonical code → `normalizeBarcode` test in Task 6.
- Macro sums with floating-point noise (33.3 + 33.3 + 33.4) must be accepted while 100.1 g is rejected → `Per100gSchema` tests in Task 1.
- Ukrainian apostrophe variants (`'`, `’`, `ʼ`) and `ё`/`е` must normalize to the same search tokens → `normalizeSearchText` tests in Task 9.
- A label printed per serving without a serving size must not produce fabricated per-100 g values → `normalizeLabel` test in Task 6.
- Impossible dates (`2026-02-30`) and ranges crossing leap days / month ends must be handled exactly → `IsoDateSchema` / `daysInclusive` tests in Task 1, range tests in Task 3, `addDays` tests in Task 9.

---

## File Structure

```
.gitignore  .nvmrc  .prettierrc  .prettierignore  CLAUDE.md
package.json  pnpm-workspace.yaml  turbo.json  tsconfig.base.json  eslint.config.js
packages/contracts/
  package.json  tsconfig.json
  src/index.ts          re-exports every module
  src/common.ts         dates, ids, EAN, grams, meals, item refs, statuses, scan key, date ranges
  src/nutrients.ts      Nutrients, Per100g, Targets, ManualTargets
  src/product.ts        product fields/requests/response, draft, duplicate-barcode details
  src/dish.ts           dish requests/response
  src/scan.ts           label reading (model tool output), scan request/response, draft warnings
  src/errors.ts         error codes, API error envelope, HTTP status map
  src/diary.ts          diary entry requests/response, day view
  src/profile.ts        body params, profile requests/response
  src/weight.ts         weight requests/response
  src/search.ts         search query, catalog item list (search, favorites, recents)
  src/stats.ts          stats query/response
  src/uploads.ts        presign request/response
  src/moderation.ts     reject request, moderation queue
  src/me.ts             my items response
  src/*.test.ts         one test file per module with schema edge cases
packages/domain/
  package.json  tsconfig.json
  src/index.ts          re-exports every module
  src/errors.ts         DomainError
  src/nutrition.ts      scale/sum/per-100 math, kcal mismatch, day summary
  src/dish.ts           computeDish
  src/barcode.ts        normalizeBarcode
  src/label.ts          normalizeLabel
  src/targets.ts        Mifflin–St Jeor targets, macro split
  src/moderation.ts     moderation state machine + predicates
  src/dates.ts          addDays
  src/recents.ts        deriveRecents, recentsWindow
  src/meal.ts           defaultMealForHour
  src/search-text.ts    normalizeSearchText, tokenize, matchesAllPrefixes
  src/testing/nutrients.ts   expectNutrientsClose (test helper, not exported)
  src/*.test.ts
```

---

### Task 1: Monorepo scaffold + common and nutrient contracts

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `eslint.config.js`, `.prettierrc`, `.prettierignore`, `.gitignore`, `.nvmrc`, `CLAUDE.md`
- Create: `packages/contracts/package.json`, `packages/contracts/tsconfig.json`, `packages/contracts/src/index.ts`, `packages/contracts/src/common.ts`, `packages/contracts/src/nutrients.ts`
- Test: `packages/contracts/src/common.test.ts`, `packages/contracts/src/nutrients.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (all exported from `@foodlog/contracts`):
  - `IsoDateSchema`, `type IsoDate = string`; `IsoDateTimeSchema`; `UlidSchema`; `EanSchema`; `OffProductIdSchema`; `ProductIdSchema`
  - `GRAMS_MAX = 5000`; `GramsSchema`
  - `MealSchema`, `type Meal = 'breakfast'|'lunch'|'dinner'|'snack'`, `MEALS`
  - `ItemTypeSchema`, `type ItemType`; `ItemRefSchema`, `type ItemRef = { type: 'product'; id: string } | { type: 'dish'; id: string }`
  - `ModerationStatusSchema`, `type ModerationStatus = 'private'|'pending'|'approved'|'rejected'|'hidden'`
  - `ProductSourceSchema`, `type ProductSource = 'off'|'user'`
  - `ScanKeySchema`; `daysInclusive(from: IsoDate, to: IsoDate): number`; `dateRangeQuerySchema(maxDays: number)`
  - `NutrientsSchema`, `type Nutrients = { kcal: number; protein: number; fat: number; carbs: number }`
  - `Per100gSchema`, `type Per100g`; `TargetsSchema`, `type Targets`; `ManualTargetsSchema`

- [ ] **Step 1: Create the feature branch**

```bash
cd ~/Work/FoodLog
git switch -c feat/foundation
```

- [ ] **Step 2: Write the root configuration files**

`package.json`:

```json
{
  "name": "foodlog",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@9.12.0",
  "engines": { "node": ">=24" },
  "scripts": {
    "build": "turbo run build",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  },
  "devDependencies": {
    "@eslint/js": "^10.0.1",
    "@types/node": "^26.6.5",
    "eslint": "^10.12.0",
    "prettier": "^3.9.10",
    "turbo": "^2.11.8",
    "typescript": "~6.0.3",
    "typescript-eslint": "^8.71.2",
    "vite": "^8.3.4",
    "vitest": "^5.0.4"
  }
}
```

`pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "scripts/*"
```

`turbo.json`:

```json
{
  "$schema": "https://turborepo.com/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "typecheck": {},
    "lint": {},
    "test": {}
  }
}
```

`tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2024",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2024"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "erasableSyntaxOnly": true,
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "types": []
  }
}
```

`eslint.config.js`:

```js
import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default defineConfig(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/.turbo/**', '**/coverage/**'] },
  js.configs.recommended,
  tseslint.configs.strict,
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
);
```

`.prettierrc`:

```json
{ "singleQuote": true, "semi": true, "printWidth": 100, "trailingComma": "all" }
```

`.prettierignore`:

```
pnpm-lock.yaml
**/dist
**/.turbo
**/coverage
```

`.gitignore`:

```
node_modules/
dist/
.turbo/
coverage/
*.tsbuildinfo
.env
.env.*
!.env.example
.DS_Store
.terraform/
*.tfstate
*.tfstate.*
terraform.tfvars
```

`.nvmrc`:

```
26
```

`CLAUDE.md`:

```markdown
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
```

- [ ] **Step 3: Create the contracts package shell**

`packages/contracts/package.json`:

```json
{
  "name": "@foodlog/contracts",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "typecheck": "tsc -p tsconfig.json",
    "lint": "eslint src",
    "test": "vitest run"
  },
  "dependencies": { "zod": "^4.6.7" }
}
```

`packages/contracts/tsconfig.json`:

```json
{ "extends": "../../tsconfig.base.json", "include": ["src"] }
```

`packages/contracts/src/index.ts`:

```ts
export * from './common.ts';
export * from './nutrients.ts';
```

Run: `pnpm install`
Expected: lockfile created, no errors.

- [ ] **Step 4: Write the failing tests**

`packages/contracts/src/common.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  EanSchema,
  GramsSchema,
  IsoDateSchema,
  ItemRefSchema,
  ProductIdSchema,
  ScanKeySchema,
  UlidSchema,
  dateRangeQuerySchema,
  daysInclusive,
} from './common.ts';

const ULID = '01JA2B3C4D5E6F7G8H9JKMNPQR';
const SUB = '3f1c9a2e-8b7d-4c6a-9e5f-1a2b3c4d5e6f';

describe('IsoDateSchema', () => {
  it('accepts a real calendar date', () => {
    expect(IsoDateSchema.safeParse('2026-10-15').success).toBe(true);
  });

  it.each(['2026-02-30', '2026-13-01', '15.10.2026', '2026-10-15T00:00:00Z'])('rejects %s', (v) => {
    expect(IsoDateSchema.safeParse(v).success).toBe(false);
  });
});

describe('UlidSchema', () => {
  it('accepts a Crockford base32 ULID', () => {
    expect(UlidSchema.safeParse(ULID).success).toBe(true);
  });

  it.each([ULID.toLowerCase(), `${ULID.slice(0, 25)}I`, ULID.slice(0, 25)])('rejects %s', (v) => {
    expect(UlidSchema.safeParse(v).success).toBe(false);
  });
});

describe('EanSchema', () => {
  it.each(['12345678', '012345678905', '4820000000013', '14820000000010'])('accepts %s', (v) => {
    expect(EanSchema.safeParse(v).success).toBe(true);
  });

  it.each(['1234567', '12345678901', '482000000001X', ' 4820000000013'])('rejects %s', (v) => {
    expect(EanSchema.safeParse(v).success).toBe(false);
  });
});

describe('ProductIdSchema', () => {
  it.each([ULID, 'off-4820000000013'])('accepts %s', (v) => {
    expect(ProductIdSchema.safeParse(v).success).toBe(true);
  });

  it.each(['off-', 'off-abc', 'OFF-4820000000013'])('rejects %s', (v) => {
    expect(ProductIdSchema.safeParse(v).success).toBe(false);
  });
});

describe('ItemRefSchema', () => {
  it('accepts an OFF product and a ULID dish', () => {
    expect(ItemRefSchema.safeParse({ type: 'product', id: 'off-4820000000013' }).success).toBe(true);
    expect(ItemRefSchema.safeParse({ type: 'dish', id: ULID }).success).toBe(true);
  });

  it('rejects a dish with a product id and unknown types', () => {
    expect(ItemRefSchema.safeParse({ type: 'dish', id: 'off-4820000000013' }).success).toBe(false);
    expect(ItemRefSchema.safeParse({ type: 'drink', id: ULID }).success).toBe(false);
  });
});

describe('GramsSchema', () => {
  it.each([0.5, 5000])('accepts %d', (v) => {
    expect(GramsSchema.safeParse(v).success).toBe(true);
  });

  it.each([0, -1, 5000.1])('rejects %d', (v) => {
    expect(GramsSchema.safeParse(v).success).toBe(false);
  });
});

describe('ScanKeySchema', () => {
  it('accepts a key under the caller scan prefix', () => {
    expect(ScanKeySchema.safeParse(`scans/${SUB}/${ULID}.jpg`).success).toBe(true);
  });

  it.each([`products/${ULID}.jpg`, `scans/../${ULID}.jpg`, `scans/${SUB}/${ULID}.png`])(
    'rejects %s',
    (v) => {
      expect(ScanKeySchema.safeParse(v).success).toBe(false);
    },
  );
});

describe('daysInclusive', () => {
  it('counts both ends, across a leap day', () => {
    expect(daysInclusive('2026-10-15', '2026-10-15')).toBe(1);
    expect(daysInclusive('2026-10-01', '2026-10-31')).toBe(31);
    expect(daysInclusive('2024-02-28', '2024-03-01')).toBe(3);
  });
});

describe('dateRangeQuerySchema', () => {
  const range31 = dateRangeQuerySchema(31);

  it('accepts a range of exactly maxDays', () => {
    expect(range31.safeParse({ from: '2026-10-01', to: '2026-10-31' }).success).toBe(true);
  });

  it('rejects a range one day too long, reported on "to"', () => {
    const r = range31.safeParse({ from: '2026-10-01', to: '2026-11-01' });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(['to']);
  });

  it('rejects from after to', () => {
    expect(range31.safeParse({ from: '2026-10-02', to: '2026-10-01' }).success).toBe(false);
  });
});
```

`packages/contracts/src/nutrients.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ManualTargetsSchema, NutrientsSchema, Per100gSchema, TargetsSchema } from './nutrients.ts';

describe('Per100gSchema', () => {
  it('accepts realistic values', () => {
    expect(Per100gSchema.safeParse({ kcal: 52, protein: 0.3, fat: 0.2, carbs: 14 }).success).toBe(
      true,
    );
  });

  it('tolerates floating-point noise in the macro sum', () => {
    expect(
      Per100gSchema.safeParse({ kcal: 500, protein: 33.3, fat: 33.3, carbs: 33.4 }).success,
    ).toBe(true);
  });

  it('rejects a macro sum above 100 g and reports it on carbs', () => {
    const r = Per100gSchema.safeParse({ kcal: 500, protein: 60, fat: 30, carbs: 10.1 });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(['carbs']);
  });

  it.each([
    { kcal: 901, protein: 0, fat: 0, carbs: 0 },
    { kcal: 100, protein: 101, fat: 0, carbs: 0 },
    { kcal: -1, protein: 0, fat: 0, carbs: 0 },
  ])('rejects out-of-range %o', (v) => {
    expect(Per100gSchema.safeParse(v).success).toBe(false);
  });
});

describe('NutrientsSchema', () => {
  it('has no upper bound (portion totals can be large)', () => {
    expect(NutrientsSchema.safeParse({ kcal: 3500, protein: 250, fat: 120, carbs: 400 }).success).toBe(
      true,
    );
  });
});

describe('TargetsSchema', () => {
  it('requires whole numbers', () => {
    expect(TargetsSchema.safeParse({ kcal: 2000.5, protein: 100, fat: 60, carbs: 250 }).success).toBe(
      false,
    );
  });
});

describe('ManualTargetsSchema', () => {
  it('rejects a manual kcal target below 500', () => {
    expect(ManualTargetsSchema.safeParse({ kcal: 400, protein: 100, fat: 60, carbs: 0 }).success).toBe(
      false,
    );
  });

  it('accepts a sensible manual target', () => {
    expect(
      ManualTargetsSchema.safeParse({ kcal: 1800, protein: 120, fat: 60, carbs: 195 }).success,
    ).toBe(true);
  });
});
```

- [ ] **Step 5: Run the tests to verify they fail**

Run: `pnpm --filter @foodlog/contracts test`
Expected: FAIL — `Failed to resolve import "./common.ts"` / `"./nutrients.ts"`.

- [ ] **Step 6: Implement `common.ts` and `nutrients.ts`**

`packages/contracts/src/common.ts`:

```ts
import { z } from 'zod';

export const IsoDateSchema = z.iso.date();
export type IsoDate = z.infer<typeof IsoDateSchema>;

export const IsoDateTimeSchema = z.iso.datetime();

export const UlidSchema = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/, 'must be a ULID');

// EAN-8, UPC-A (12), EAN-13 and GTIN-14 — digits only; canonicalization lives in the domain.
export const EanSchema = z.string().regex(/^(\d{8}|\d{12,14})$/, 'must be 8 or 12–14 digits');

export const OffProductIdSchema = z.string().regex(/^off-(\d{8}|\d{12,14})$/);
export const ProductIdSchema = z.union([UlidSchema, OffProductIdSchema]);

export const GRAMS_MAX = 5000;
export const GramsSchema = z.number().positive().max(GRAMS_MAX);

export const MealSchema = z.enum(['breakfast', 'lunch', 'dinner', 'snack']);
export type Meal = z.infer<typeof MealSchema>;
export const MEALS = MealSchema.options;

export const ItemTypeSchema = z.enum(['product', 'dish']);
export type ItemType = z.infer<typeof ItemTypeSchema>;

export const ItemRefSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('product'), id: ProductIdSchema }),
  z.object({ type: z.literal('dish'), id: UlidSchema }),
]);
export type ItemRef = z.infer<typeof ItemRefSchema>;

export const ModerationStatusSchema = z.enum(['private', 'pending', 'approved', 'rejected', 'hidden']);
export type ModerationStatus = z.infer<typeof ModerationStatusSchema>;

export const ProductSourceSchema = z.enum(['off', 'user']);
export type ProductSource = z.infer<typeof ProductSourceSchema>;

// scans/<cognito sub>/<ulid>.jpg — the scan Lambda additionally checks the sub matches the caller.
export const ScanKeySchema = z
  .string()
  .regex(/^scans\/[0-9a-f-]{36}\/[0-9A-HJKMNP-TV-Z]{26}\.jpg$/, 'must be a scan upload key');

const DAY_MS = 86_400_000;

export function daysInclusive(from: IsoDate, to: IsoDate): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1;
}

export function dateRangeQuerySchema(maxDays: number) {
  return z
    .object({ from: IsoDateSchema, to: IsoDateSchema })
    .refine((r) => r.from <= r.to && daysInclusive(r.from, r.to) <= maxDays, {
      message: `from must not be after to, and the range must be at most ${maxDays} days`,
      path: ['to'],
    });
}
```

`packages/contracts/src/nutrients.ts`:

```ts
import { z } from 'zod';

export const NutrientsSchema = z.object({
  kcal: z.number().min(0),
  protein: z.number().min(0),
  fat: z.number().min(0),
  carbs: z.number().min(0),
});
export type Nutrients = z.infer<typeof NutrientsSchema>;

// Floating-point slack so 33.3 + 33.3 + 33.4 is not rejected.
const MACRO_SUM_EPSILON = 1e-6;
const macroPer100g = z.number().min(0).max(100);

export const Per100gSchema = z
  .object({
    kcal: z.number().min(0).max(900),
    protein: macroPer100g,
    fat: macroPer100g,
    carbs: macroPer100g,
  })
  .refine((n) => n.protein + n.fat + n.carbs <= 100 + MACRO_SUM_EPSILON, {
    message: 'protein + fat + carbs must not exceed 100 g per 100 g',
    path: ['carbs'],
  });
export type Per100g = z.infer<typeof Per100gSchema>;

export const TargetsSchema = z.object({
  kcal: z.number().int().min(0).max(10000),
  protein: z.number().int().min(0).max(1000),
  fat: z.number().int().min(0).max(1000),
  carbs: z.number().int().min(0).max(2000),
});
export type Targets = z.infer<typeof TargetsSchema>;

export const ManualTargetsSchema = TargetsSchema.extend({
  kcal: z.number().int().min(500).max(10000),
});
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm --filter @foodlog/contracts test`
Expected: PASS — `Test Files 2 passed`.

- [ ] **Step 8: Run all gates**

Run: `pnpm format && pnpm turbo run lint typecheck test`
Expected: Prettier formats the files, then all tasks succeed.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: scaffold FoodLog monorepo with common and nutrient contracts"
```

---

### Task 2: Catalog contracts — product, dish, scan, errors

**Files:**
- Create: `packages/contracts/src/product.ts`, `packages/contracts/src/dish.ts`, `packages/contracts/src/scan.ts`, `packages/contracts/src/errors.ts`
- Modify: `packages/contracts/src/index.ts`
- Test: `packages/contracts/src/product.test.ts`, `packages/contracts/src/dish.test.ts`, `packages/contracts/src/scan.test.ts`, `packages/contracts/src/errors.test.ts`

**Interfaces:**
- Consumes: Task 1 schemas (`EanSchema`, `GramsSchema`, `GRAMS_MAX`, `IsoDateTimeSchema`, `ModerationStatusSchema`, `ProductIdSchema`, `ProductSourceSchema`, `ScanKeySchema`, `UlidSchema`, `NutrientsSchema`, `Per100gSchema`).
- Produces:
  - `ProductFieldsSchema` / `type ProductFields = { name: string; brand?: string; barcode?: string; servingSizeG?: number; per100g: Per100g }`
  - `CreateProductRequestSchema` / `type CreateProductRequest = ProductFields & { publish: boolean; photoKey?: string }`
  - `UpdateProductRequestSchema` / `type UpdateProductRequest`
  - `ProductSchema` / `type Product = ProductFields & { id; source; status; isOwn: boolean; rejectReason?; pendingRevision?: ProductFields; photoUrl?; createdAt; updatedAt }`
  - `ProductDraftSchema` / `type ProductDraft = { name: string; brand?: string; barcode?: string; servingSizeG?: number; per100g: { kcal?: number; protein?: number; fat?: number; carbs?: number } }`
  - `DuplicateBarcodeDetailsSchema` (`{ product: Product }`)
  - `DISH_INGREDIENTS_MAX = 50`; `DishIngredientInputSchema`; `DishFieldsSchema`; `CreateDishRequestSchema` / `type CreateDishRequest`; `UpdateDishRequestSchema` / `type UpdateDishRequest`; `DishIngredientSchema` / `type DishIngredient = { productId: string; grams: number; name: string; per100g: Per100g }`; `DishContentSchema` / `type DishContent`; `DishSchema` / `type Dish`
  - `DraftWarningSchema` / `type DraftWarning = 'SERVING_SIZE_REQUIRED'|'MISSING_VALUES'|'KCAL_MISMATCH'|'OUT_OF_RANGE'`
  - `LabelReadingSchema` / `type LabelReading = { readable: boolean; name?: string; brand?: string; barcode?: string; basis: 'per100g'|'perServing'; servingSizeG?: number; energyKcal?: number; energyKj?: number; protein?: number; fat?: number; carbs?: number }`
  - `ScanRequestSchema` / `type ScanRequest`; `ScanResponseSchema` / `type ScanResponse = { draft: ProductDraft; warnings: DraftWarning[]; photoKey: string }`
  - `ErrorCodeSchema` / `type ErrorCode`; `ApiErrorSchema` / `type ApiError`; `HTTP_STATUS_BY_ERROR_CODE: Record<ErrorCode, number>`

- [ ] **Step 1: Write the failing tests**

`packages/contracts/src/product.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CreateProductRequestSchema, ProductDraftSchema, ProductSchema } from './product.ts';

const ULID = '01JA2B3C4D5E6F7G8H9JKMNPQR';
const SUB = '3f1c9a2e-8b7d-4c6a-9e5f-1a2b3c4d5e6f';

const valid = {
  name: '  Йогурт персик ',
  brand: 'Галичина',
  barcode: '4820000000013',
  per100g: { kcal: 72, protein: 3.3, fat: 1.3, carbs: 11.3 },
  publish: true,
};

describe('CreateProductRequestSchema', () => {
  it('trims the name', () => {
    expect(CreateProductRequestSchema.parse(valid).name).toBe('Йогурт персик');
  });

  it('rejects a whitespace-only name', () => {
    expect(CreateProductRequestSchema.safeParse({ ...valid, name: '   ' }).success).toBe(false);
  });

  it('rejects names longer than 120 characters', () => {
    expect(CreateProductRequestSchema.safeParse({ ...valid, name: 'я'.repeat(121) }).success).toBe(
      false,
    );
  });

  it('reports an impossible macro sum under per100g.carbs', () => {
    const r = CreateProductRequestSchema.safeParse({
      ...valid,
      per100g: { kcal: 500, protein: 60, fat: 30, carbs: 20 },
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(['per100g', 'carbs']);
  });

  it('accepts a photoKey from a scan upload', () => {
    expect(
      CreateProductRequestSchema.safeParse({ ...valid, photoKey: `scans/${SUB}/${ULID}.jpg` })
        .success,
    ).toBe(true);
  });

  it('rejects a photoKey outside scans/', () => {
    expect(
      CreateProductRequestSchema.safeParse({ ...valid, photoKey: `products/${ULID}.jpg` }).success,
    ).toBe(false);
  });
});

describe('ProductSchema', () => {
  it('parses a public OFF product without owner data', () => {
    const r = ProductSchema.safeParse({
      id: 'off-4820000000013',
      source: 'off',
      status: 'approved',
      isOwn: false,
      name: 'Йогурт',
      per100g: { kcal: 72, protein: 3.3, fat: 1.3, carbs: 11.3 },
      createdAt: '2026-10-15T10:00:00.000Z',
      updatedAt: '2026-10-15T10:00:00.000Z',
    });
    expect(r.success).toBe(true);
  });
});

describe('ProductDraftSchema', () => {
  it('allows missing per-100 g values', () => {
    expect(ProductDraftSchema.safeParse({ name: 'Печиво', per100g: { kcal: 450 } }).success).toBe(
      true,
    );
  });
});
```

`packages/contracts/src/dish.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CreateDishRequestSchema, DISH_INGREDIENTS_MAX } from './dish.ts';

const ingredient = { productId: 'off-4820000000013', grams: 100 };
const valid = { name: 'Гречка з маслом', ingredients: [ingredient], publish: false };

describe('CreateDishRequestSchema', () => {
  it('accepts a single-ingredient dish without cooked weight', () => {
    expect(CreateDishRequestSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts a cooked weight', () => {
    expect(CreateDishRequestSchema.safeParse({ ...valid, cookedWeightG: 250 }).success).toBe(true);
  });

  it('rejects a dish without ingredients', () => {
    expect(CreateDishRequestSchema.safeParse({ ...valid, ingredients: [] }).success).toBe(false);
  });

  it(`rejects more than ${DISH_INGREDIENTS_MAX} ingredients`, () => {
    const ingredients = Array.from({ length: DISH_INGREDIENTS_MAX + 1 }, () => ingredient);
    expect(CreateDishRequestSchema.safeParse({ ...valid, ingredients }).success).toBe(false);
  });

  it('rejects zero grams and zero cooked weight', () => {
    expect(
      CreateDishRequestSchema.safeParse({ ...valid, ingredients: [{ ...ingredient, grams: 0 }] })
        .success,
    ).toBe(false);
    expect(CreateDishRequestSchema.safeParse({ ...valid, cookedWeightG: 0 }).success).toBe(false);
  });
});
```

`packages/contracts/src/scan.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { LabelReadingSchema, ScanRequestSchema, ScanResponseSchema } from './scan.ts';

const ULID = '01JA2B3C4D5E6F7G8H9JKMNPQR';
const SUB = '3f1c9a2e-8b7d-4c6a-9e5f-1a2b3c4d5e6f';
const key = `scans/${SUB}/${ULID}.jpg`;

describe('LabelReadingSchema', () => {
  it('accepts an unreadable reading with only the required fields', () => {
    expect(LabelReadingSchema.safeParse({ readable: false, basis: 'per100g' }).success).toBe(true);
  });

  it('rejects negative values and unknown bases', () => {
    expect(
      LabelReadingSchema.safeParse({ readable: true, basis: 'per100g', protein: -1 }).success,
    ).toBe(false);
    expect(LabelReadingSchema.safeParse({ readable: true, basis: 'perPack' }).success).toBe(false);
  });
});

describe('ScanRequestSchema', () => {
  it('accepts a scan key with an optional barcode', () => {
    expect(ScanRequestSchema.safeParse({ key, barcode: '4820000000013' }).success).toBe(true);
  });

  it('rejects path traversal in the key', () => {
    expect(ScanRequestSchema.safeParse({ key: `scans/../${ULID}.jpg` }).success).toBe(false);
  });
});

describe('ScanResponseSchema', () => {
  it('parses a partial draft with warnings', () => {
    const r = ScanResponseSchema.safeParse({
      draft: { name: 'Печиво', per100g: {} },
      warnings: ['SERVING_SIZE_REQUIRED'],
      photoKey: key,
    });
    expect(r.success).toBe(true);
  });
});
```

`packages/contracts/src/errors.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ApiErrorSchema, ErrorCodeSchema, HTTP_STATUS_BY_ERROR_CODE } from './errors.ts';

describe('HTTP_STATUS_BY_ERROR_CODE', () => {
  it('maps every error code', () => {
    expect(Object.keys(HTTP_STATUS_BY_ERROR_CODE).sort()).toEqual([...ErrorCodeSchema.options].sort());
  });

  it('uses 429 for quota and 422 for unreadable scans', () => {
    expect(HTTP_STATUS_BY_ERROR_CODE.QUOTA_EXCEEDED).toBe(429);
    expect(HTTP_STATUS_BY_ERROR_CODE.SCAN_UNREADABLE).toBe(422);
  });
});

describe('ApiErrorSchema', () => {
  it('parses the error envelope', () => {
    expect(
      ApiErrorSchema.safeParse({ error: { code: 'NOT_FOUND', message: 'Product not found' } }).success,
    ).toBe(true);
  });

  it('rejects unknown codes', () => {
    expect(ApiErrorSchema.safeParse({ error: { code: 'TEAPOT', message: 'x' } }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @foodlog/contracts test`
Expected: FAIL — `Failed to resolve import "./product.ts"` (and dish/scan/errors).

- [ ] **Step 3: Implement the modules**

`packages/contracts/src/product.ts`:

```ts
import { z } from 'zod';
import {
  EanSchema,
  GRAMS_MAX,
  IsoDateTimeSchema,
  ModerationStatusSchema,
  ProductIdSchema,
  ProductSourceSchema,
  ScanKeySchema,
} from './common.ts';
import { Per100gSchema } from './nutrients.ts';

export const ProductFieldsSchema = z.object({
  name: z.string().trim().min(1).max(120),
  brand: z.string().trim().min(1).max(80).optional(),
  barcode: EanSchema.optional(),
  servingSizeG: z.number().positive().max(GRAMS_MAX).optional(),
  per100g: Per100gSchema,
});
export type ProductFields = z.infer<typeof ProductFieldsSchema>;

export const CreateProductRequestSchema = ProductFieldsSchema.extend({
  publish: z.boolean(),
  photoKey: ScanKeySchema.optional(),
});
export type CreateProductRequest = z.infer<typeof CreateProductRequestSchema>;

export const UpdateProductRequestSchema = ProductFieldsSchema;
export type UpdateProductRequest = z.infer<typeof UpdateProductRequestSchema>;

export const ProductSchema = ProductFieldsSchema.extend({
  id: ProductIdSchema,
  source: ProductSourceSchema,
  status: ModerationStatusSchema,
  isOwn: z.boolean(),
  rejectReason: z.string().optional(),
  pendingRevision: ProductFieldsSchema.optional(),
  photoUrl: z.url().optional(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type Product = z.infer<typeof ProductSchema>;

const optionalAmount = z.number().min(0).optional();

export const ProductDraftSchema = z.object({
  name: z.string(),
  brand: z.string().optional(),
  barcode: EanSchema.optional(),
  servingSizeG: z.number().positive().optional(),
  per100g: z.object({
    kcal: optionalAmount,
    protein: optionalAmount,
    fat: optionalAmount,
    carbs: optionalAmount,
  }),
});
export type ProductDraft = z.infer<typeof ProductDraftSchema>;

export const DuplicateBarcodeDetailsSchema = z.object({ product: ProductSchema });
```

`packages/contracts/src/dish.ts`:

```ts
import { z } from 'zod';
import {
  GramsSchema,
  IsoDateTimeSchema,
  ModerationStatusSchema,
  ProductIdSchema,
  UlidSchema,
} from './common.ts';
import { NutrientsSchema, Per100gSchema } from './nutrients.ts';

export const DISH_INGREDIENTS_MAX = 50;
const DishNameSchema = z.string().trim().min(1).max(120);
const CookedWeightSchema = z.number().positive().max(20000).optional();

export const DishIngredientInputSchema = z.object({ productId: ProductIdSchema, grams: GramsSchema });

export const DishFieldsSchema = z.object({
  name: DishNameSchema,
  ingredients: z.array(DishIngredientInputSchema).min(1).max(DISH_INGREDIENTS_MAX),
  cookedWeightG: CookedWeightSchema,
});

export const CreateDishRequestSchema = DishFieldsSchema.extend({ publish: z.boolean() });
export type CreateDishRequest = z.infer<typeof CreateDishRequestSchema>;

export const UpdateDishRequestSchema = DishFieldsSchema;
export type UpdateDishRequest = z.infer<typeof UpdateDishRequestSchema>;

export const DishIngredientSchema = DishIngredientInputSchema.extend({
  name: z.string(),
  per100g: Per100gSchema,
});
export type DishIngredient = z.infer<typeof DishIngredientSchema>;

export const DishContentSchema = z.object({
  name: DishNameSchema,
  ingredients: z.array(DishIngredientSchema).min(1).max(DISH_INGREDIENTS_MAX),
  cookedWeightG: CookedWeightSchema,
});
export type DishContent = z.infer<typeof DishContentSchema>;

export const DishSchema = DishContentSchema.extend({
  id: UlidSchema,
  totals: NutrientsSchema,
  weightG: z.number().positive(),
  per100g: NutrientsSchema,
  status: ModerationStatusSchema,
  isOwn: z.boolean(),
  rejectReason: z.string().optional(),
  pendingRevision: DishContentSchema.optional(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type Dish = z.infer<typeof DishSchema>;
```

`packages/contracts/src/scan.ts`:

```ts
import { z } from 'zod';
import { EanSchema, ScanKeySchema } from './common.ts';
import { ProductDraftSchema } from './product.ts';

export const DraftWarningSchema = z.enum([
  'SERVING_SIZE_REQUIRED',
  'MISSING_VALUES',
  'KCAL_MISMATCH',
  'OUT_OF_RANGE',
]);
export type DraftWarning = z.infer<typeof DraftWarningSchema>;

const amount = z.number().min(0).optional();

// What the model reports as printed on the label (the record_label tool input). The domain
// converts it to per-100 g values; this schema only checks the shape.
export const LabelReadingSchema = z.object({
  readable: z.boolean(),
  name: z.string().optional(),
  brand: z.string().optional(),
  barcode: z.string().optional(),
  basis: z.enum(['per100g', 'perServing']),
  servingSizeG: z.number().positive().optional(),
  energyKcal: amount,
  energyKj: amount,
  protein: amount,
  fat: amount,
  carbs: amount,
});
export type LabelReading = z.infer<typeof LabelReadingSchema>;

export const ScanRequestSchema = z.object({ key: ScanKeySchema, barcode: EanSchema.optional() });
export type ScanRequest = z.infer<typeof ScanRequestSchema>;

export const ScanResponseSchema = z.object({
  draft: ProductDraftSchema,
  warnings: z.array(DraftWarningSchema),
  photoKey: ScanKeySchema,
});
export type ScanResponse = z.infer<typeof ScanResponseSchema>;
```

`packages/contracts/src/errors.ts`:

```ts
import { z } from 'zod';

export const ErrorCodeSchema = z.enum([
  'VALIDATION',
  'NOT_FOUND',
  'FORBIDDEN',
  'CONFLICT',
  'DUPLICATE_BARCODE',
  'QUOTA_EXCEEDED',
  'SCAN_UNREADABLE',
  'UPSTREAM_UNAVAILABLE',
  'INTERNAL',
]);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export const ApiErrorSchema = z.object({
  error: z.object({
    code: ErrorCodeSchema,
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

export const HTTP_STATUS_BY_ERROR_CODE: Record<ErrorCode, number> = {
  VALIDATION: 400,
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  CONFLICT: 409,
  DUPLICATE_BARCODE: 409,
  QUOTA_EXCEEDED: 429,
  SCAN_UNREADABLE: 422,
  UPSTREAM_UNAVAILABLE: 503,
  INTERNAL: 500,
};
```

Replace `packages/contracts/src/index.ts` with:

```ts
export * from './common.ts';
export * from './nutrients.ts';
export * from './product.ts';
export * from './dish.ts';
export * from './scan.ts';
export * from './errors.ts';
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @foodlog/contracts test`
Expected: PASS — `Test Files 6 passed`.

- [ ] **Step 5: Run all gates and commit**

Run: `pnpm format && pnpm turbo run lint typecheck test`
Expected: all succeed.

```bash
git add packages/contracts
git commit -m "feat(contracts): product, dish, scan and error schemas"
```

---

### Task 3: Remaining API contracts — diary, profile, weight, search, stats, uploads, moderation, me

**Files:**
- Create: `packages/contracts/src/diary.ts`, `profile.ts`, `weight.ts`, `search.ts`, `stats.ts`, `uploads.ts`, `moderation.ts`, `me.ts` (all under `packages/contracts/src/`)
- Modify: `packages/contracts/src/index.ts`
- Test: `packages/contracts/src/diary.test.ts`, `profile.test.ts`, `search.test.ts`, `moderation.test.ts`, `uploads.test.ts`

**Interfaces:**
- Consumes: Tasks 1–2 schemas.
- Produces:
  - `CreateDiaryEntryRequestSchema` / `type CreateDiaryEntryRequest = { meal: Meal; item: ItemRef; grams: number }`; `UpdateDiaryEntryRequestSchema` / `type UpdateDiaryEntryRequest = { meal?: Meal; grams?: number }`
  - `DiaryEntrySchema` / `type DiaryEntry = { id; date; meal; item: ItemRef; name; per100g: Nutrients; grams; nutrients: Nutrients; createdAt }`; `MealTotalsSchema`; `DiaryDaySchema` / `type DiaryDay`
  - `SexSchema`/`Sex`, `ActivitySchema`/`Activity` (`'sedentary'|'light'|'moderate'|'active'|'very_active'`), `GoalSchema`/`Goal` (`'lose'|'maintain'|'gain'`), `LocaleSchema`/`Locale`, `AGE_MIN = 13`, `AGE_MAX = 100`, `BodyParamsSchema`, `PutProfileRequestSchema`/`PutProfileRequest`, `ProfileSchema`/`Profile`, `ProfileResponseSchema`/`ProfileResponse`
  - `WEIGHT_KG_MIN = 20`, `WEIGHT_KG_MAX = 400`, `PutWeightRequestSchema`, `WeightEntrySchema`/`WeightEntry`, `WeightQuerySchema` (≤ 366 days), `WeightListResponseSchema`
  - `SEARCH_QUERY_MAX = 100`, `SearchQuerySchema`/`SearchQuery`, `CatalogItemSchema`/`CatalogItem`, `CatalogListResponseSchema`
  - `StatsQuerySchema` (≤ 31 days), `DayTotalsSchema`, `StatsResponseSchema`/`StatsResponse`
  - `UPLOAD_MAX_BYTES = 5 * 1024 * 1024`, `UploadContentTypeSchema`, `PresignRequestSchema`, `PresignResponseSchema`
  - `RejectRequestSchema`, `ModerationQueueItemSchema`, `ModerationQueueResponseSchema`
  - `MyItemsResponseSchema`

- [ ] **Step 1: Write the failing tests**

`packages/contracts/src/diary.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  CreateDiaryEntryRequestSchema,
  DiaryDaySchema,
  UpdateDiaryEntryRequestSchema,
} from './diary.ts';

const zero = { kcal: 0, protein: 0, fat: 0, carbs: 0 };

describe('CreateDiaryEntryRequestSchema', () => {
  it('accepts a product entry', () => {
    expect(
      CreateDiaryEntryRequestSchema.safeParse({
        meal: 'lunch',
        item: { type: 'product', id: 'off-4820000000013' },
        grams: 150,
      }).success,
    ).toBe(true);
  });

  it('rejects unknown meals', () => {
    expect(
      CreateDiaryEntryRequestSchema.safeParse({
        meal: 'brunch',
        item: { type: 'product', id: 'off-4820000000013' },
        grams: 150,
      }).success,
    ).toBe(false);
  });
});

describe('UpdateDiaryEntryRequestSchema', () => {
  it('requires at least one field', () => {
    expect(UpdateDiaryEntryRequestSchema.safeParse({}).success).toBe(false);
  });

  it('accepts a grams-only change', () => {
    expect(UpdateDiaryEntryRequestSchema.safeParse({ grams: 80 }).success).toBe(true);
  });
});

describe('DiaryDaySchema', () => {
  it('parses an empty day without targets', () => {
    const r = DiaryDaySchema.safeParse({
      date: '2026-10-15',
      entries: [],
      totals: zero,
      byMeal: { breakfast: zero, lunch: zero, dinner: zero, snack: zero },
      targets: null,
    });
    expect(r.success).toBe(true);
  });
});
```

`packages/contracts/src/profile.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { AGE_MAX, AGE_MIN, PutProfileRequestSchema } from './profile.ts';
import { PutWeightRequestSchema } from './weight.ts';

const year = new Date().getUTCFullYear();
const body = {
  sex: 'female',
  birthYear: year - 30,
  heightCm: 165,
  activity: 'light',
  goal: 'lose',
  locale: 'uk',
  targetsManual: false,
};

describe('PutProfileRequestSchema', () => {
  it('accepts calculated targets without explicit targets', () => {
    expect(PutProfileRequestSchema.safeParse(body).success).toBe(true);
  });

  it('requires targets when targetsManual is true', () => {
    const r = PutProfileRequestSchema.safeParse({ ...body, targetsManual: true });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(['targets']);
  });

  it('rejects a manual kcal target below 500', () => {
    const r = PutProfileRequestSchema.safeParse({
      ...body,
      targetsManual: true,
      targets: { kcal: 400, protein: 80, fat: 20, carbs: 0 },
    });
    expect(r.success).toBe(false);
  });

  it.each([AGE_MIN - 1, AGE_MAX + 1])('rejects age %i', (age) => {
    expect(PutProfileRequestSchema.safeParse({ ...body, birthYear: year - age }).success).toBe(false);
  });

  it.each([AGE_MIN, AGE_MAX])('accepts age %i', (age) => {
    expect(PutProfileRequestSchema.safeParse({ ...body, birthYear: year - age }).success).toBe(true);
  });
});

describe('PutWeightRequestSchema', () => {
  it.each([19.9, 400.1])('rejects %d kg', (kg) => {
    expect(PutWeightRequestSchema.safeParse({ kg }).success).toBe(false);
  });

  it('accepts 72.4 kg', () => {
    expect(PutWeightRequestSchema.safeParse({ kg: 72.4 }).success).toBe(true);
  });
});
```

`packages/contracts/src/search.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CatalogItemSchema, SEARCH_QUERY_MAX, SearchQuerySchema } from './search.ts';
import { StatsQuerySchema } from './stats.ts';
import { WeightQuerySchema } from './weight.ts';

describe('SearchQuerySchema', () => {
  it('defaults to an empty query over all item types', () => {
    expect(SearchQuerySchema.parse({})).toEqual({ q: '', type: 'all' });
  });

  it('rejects overly long queries and unknown types', () => {
    expect(SearchQuerySchema.safeParse({ q: 'а'.repeat(SEARCH_QUERY_MAX + 1) }).success).toBe(false);
    expect(SearchQuerySchema.safeParse({ type: 'drink' }).success).toBe(false);
  });
});

describe('CatalogItemSchema', () => {
  it('parses a user dish item', () => {
    const r = CatalogItemSchema.safeParse({
      type: 'dish',
      id: '01JA2B3C4D5E6F7G8H9JKMNPQR',
      name: 'Гречка з маслом',
      per100g: { kcal: 167.1, protein: 5.3, fat: 4.7, carbs: 27.2 },
      source: 'user',
      status: 'private',
      isOwn: true,
      isFavorite: false,
    });
    expect(r.success).toBe(true);
  });
});

describe('range queries', () => {
  it('limits stats to 31 days', () => {
    expect(StatsQuerySchema.safeParse({ from: '2026-10-01', to: '2026-10-31' }).success).toBe(true);
    expect(StatsQuerySchema.safeParse({ from: '2026-10-01', to: '2026-11-01' }).success).toBe(false);
  });

  it('limits weight history to 366 days (a full leap year)', () => {
    expect(WeightQuerySchema.safeParse({ from: '2024-01-01', to: '2024-12-31' }).success).toBe(true);
    expect(WeightQuerySchema.safeParse({ from: '2024-01-01', to: '2025-01-01' }).success).toBe(false);
  });
});
```

`packages/contracts/src/moderation.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ModerationQueueItemSchema, RejectRequestSchema } from './moderation.ts';

const product = {
  id: '01JA2B3C4D5E6F7G8H9JKMNPQR',
  source: 'user',
  status: 'pending',
  isOwn: false,
  name: 'Сирок глазурований',
  barcode: '4820000000013',
  per100g: { kcal: 413, protein: 8.5, fat: 27.8, carbs: 32 },
  createdAt: '2026-10-15T10:00:00.000Z',
  updatedAt: '2026-10-15T10:00:00.000Z',
};

describe('RejectRequestSchema', () => {
  it('trims and requires at least 3 characters', () => {
    expect(RejectRequestSchema.safeParse({ reason: '  ok ' }).success).toBe(false);
    expect(RejectRequestSchema.parse({ reason: '  Wrong kcal ' }).reason).toBe('Wrong kcal');
  });
});

describe('ModerationQueueItemSchema', () => {
  it('parses a product submission', () => {
    const r = ModerationQueueItemSchema.safeParse({
      type: 'product',
      product,
      isRevision: false,
      kcalMismatch: false,
      photoUrl: null,
      duplicate: null,
    });
    expect(r.success).toBe(true);
  });

  it('rejects a dish entry carrying a product payload', () => {
    const r = ModerationQueueItemSchema.safeParse({
      type: 'dish',
      product,
      isRevision: false,
      kcalMismatch: false,
    });
    expect(r.success).toBe(false);
  });
});
```

`packages/contracts/src/uploads.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { PresignRequestSchema } from './uploads.ts';

describe('PresignRequestSchema', () => {
  it.each(['image/jpeg', 'image/webp'])('accepts %s', (contentType) => {
    expect(PresignRequestSchema.safeParse({ contentType }).success).toBe(true);
  });

  it('rejects other content types', () => {
    expect(PresignRequestSchema.safeParse({ contentType: 'image/png' }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @foodlog/contracts test`
Expected: FAIL — `Failed to resolve import "./diary.ts"` (and the other new modules).

- [ ] **Step 3: Implement the modules**

`packages/contracts/src/diary.ts`:

```ts
import { z } from 'zod';
import {
  GramsSchema,
  IsoDateSchema,
  IsoDateTimeSchema,
  ItemRefSchema,
  MealSchema,
  UlidSchema,
} from './common.ts';
import { NutrientsSchema, TargetsSchema } from './nutrients.ts';

export const CreateDiaryEntryRequestSchema = z.object({
  meal: MealSchema,
  item: ItemRefSchema,
  grams: GramsSchema,
});
export type CreateDiaryEntryRequest = z.infer<typeof CreateDiaryEntryRequestSchema>;

export const UpdateDiaryEntryRequestSchema = z
  .object({ meal: MealSchema.optional(), grams: GramsSchema.optional() })
  .refine((v) => v.meal !== undefined || v.grams !== undefined, {
    message: 'meal or grams is required',
  });
export type UpdateDiaryEntryRequest = z.infer<typeof UpdateDiaryEntryRequestSchema>;

export const DiaryEntrySchema = z.object({
  id: UlidSchema,
  date: IsoDateSchema,
  meal: MealSchema,
  item: ItemRefSchema,
  name: z.string(),
  per100g: NutrientsSchema,
  grams: GramsSchema,
  nutrients: NutrientsSchema,
  createdAt: IsoDateTimeSchema,
});
export type DiaryEntry = z.infer<typeof DiaryEntrySchema>;

export const MealTotalsSchema = z.object({
  breakfast: NutrientsSchema,
  lunch: NutrientsSchema,
  dinner: NutrientsSchema,
  snack: NutrientsSchema,
});

export const DiaryDaySchema = z.object({
  date: IsoDateSchema,
  entries: z.array(DiaryEntrySchema),
  totals: NutrientsSchema,
  byMeal: MealTotalsSchema,
  targets: TargetsSchema.nullable(),
});
export type DiaryDay = z.infer<typeof DiaryDaySchema>;
```

`packages/contracts/src/profile.ts`:

```ts
import { z } from 'zod';
import { ManualTargetsSchema, TargetsSchema } from './nutrients.ts';

export const SexSchema = z.enum(['male', 'female']);
export type Sex = z.infer<typeof SexSchema>;

export const ActivitySchema = z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']);
export type Activity = z.infer<typeof ActivitySchema>;

export const GoalSchema = z.enum(['lose', 'maintain', 'gain']);
export type Goal = z.infer<typeof GoalSchema>;

export const LocaleSchema = z.enum(['uk', 'en']);
export type Locale = z.infer<typeof LocaleSchema>;

export const AGE_MIN = 13;
export const AGE_MAX = 100;

const BirthYearSchema = z
  .number()
  .int()
  .refine(
    (year) => {
      const age = new Date().getUTCFullYear() - year;
      return age >= AGE_MIN && age <= AGE_MAX;
    },
    { message: `age must be between ${AGE_MIN} and ${AGE_MAX}` },
  );

export const BodyParamsSchema = z.object({
  sex: SexSchema,
  birthYear: BirthYearSchema,
  heightCm: z.number().min(100).max(250),
  activity: ActivitySchema,
  goal: GoalSchema,
});

export const PutProfileRequestSchema = BodyParamsSchema.extend({
  locale: LocaleSchema,
  targetsManual: z.boolean(),
  targets: ManualTargetsSchema.optional(),
}).refine((p) => !p.targetsManual || p.targets !== undefined, {
  message: 'targets are required when targetsManual is true',
  path: ['targets'],
});
export type PutProfileRequest = z.infer<typeof PutProfileRequestSchema>;

export const ProfileSchema = BodyParamsSchema.extend({
  locale: LocaleSchema,
  targetsManual: z.boolean(),
  targets: TargetsSchema,
});
export type Profile = z.infer<typeof ProfileSchema>;

export const ProfileResponseSchema = z.object({
  profile: ProfileSchema.nullable(),
  currentWeightKg: z.number().nullable(),
  suggestedTargets: TargetsSchema.nullable(),
});
export type ProfileResponse = z.infer<typeof ProfileResponseSchema>;
```

`packages/contracts/src/weight.ts`:

```ts
import { z } from 'zod';
import { IsoDateSchema, dateRangeQuerySchema } from './common.ts';

export const WEIGHT_KG_MIN = 20;
export const WEIGHT_KG_MAX = 400;

export const PutWeightRequestSchema = z.object({
  kg: z.number().min(WEIGHT_KG_MIN).max(WEIGHT_KG_MAX),
});

export const WeightEntrySchema = z.object({ date: IsoDateSchema, kg: z.number() });
export type WeightEntry = z.infer<typeof WeightEntrySchema>;

export const WeightQuerySchema = dateRangeQuerySchema(366);

export const WeightListResponseSchema = z.object({ entries: z.array(WeightEntrySchema) });
```

`packages/contracts/src/search.ts`:

```ts
import { z } from 'zod';
import { ItemTypeSchema, ModerationStatusSchema, ProductSourceSchema } from './common.ts';
import { NutrientsSchema } from './nutrients.ts';

export const SEARCH_QUERY_MAX = 100;

export const SearchQuerySchema = z.object({
  q: z.string().max(SEARCH_QUERY_MAX).default(''),
  type: z.enum(['all', 'product', 'dish']).default('all'),
});
export type SearchQuery = z.infer<typeof SearchQuerySchema>;

// One row in search results, favorites and recents.
export const CatalogItemSchema = z.object({
  type: ItemTypeSchema,
  id: z.string(),
  name: z.string(),
  brand: z.string().optional(),
  per100g: NutrientsSchema,
  source: ProductSourceSchema,
  status: ModerationStatusSchema,
  isOwn: z.boolean(),
  isFavorite: z.boolean(),
});
export type CatalogItem = z.infer<typeof CatalogItemSchema>;

export const CatalogListResponseSchema = z.object({ items: z.array(CatalogItemSchema) });
```

`packages/contracts/src/stats.ts`:

```ts
import { z } from 'zod';
import { IsoDateSchema, dateRangeQuerySchema } from './common.ts';
import { NutrientsSchema, TargetsSchema } from './nutrients.ts';

export const StatsQuerySchema = dateRangeQuerySchema(31);

export const DayTotalsSchema = z.object({ date: IsoDateSchema, totals: NutrientsSchema });

export const StatsResponseSchema = z.object({
  days: z.array(DayTotalsSchema),
  targets: TargetsSchema.nullable(),
});
export type StatsResponse = z.infer<typeof StatsResponseSchema>;
```

`packages/contracts/src/uploads.ts`:

```ts
import { z } from 'zod';
import { ScanKeySchema } from './common.ts';

export const UPLOAD_MAX_BYTES = 5 * 1024 * 1024;

export const UploadContentTypeSchema = z.enum(['image/jpeg', 'image/webp']);

export const PresignRequestSchema = z.object({ contentType: UploadContentTypeSchema });

export const PresignResponseSchema = z.object({
  url: z.url(),
  fields: z.record(z.string(), z.string()),
  key: ScanKeySchema,
});
```

`packages/contracts/src/moderation.ts`:

```ts
import { z } from 'zod';
import { DishSchema } from './dish.ts';
import { ProductSchema } from './product.ts';

export const RejectRequestSchema = z.object({ reason: z.string().trim().min(3).max(500) });

export const ModerationQueueItemSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('product'),
    product: ProductSchema,
    isRevision: z.boolean(),
    kcalMismatch: z.boolean(),
    photoUrl: z.url().nullable(),
    duplicate: ProductSchema.nullable(),
  }),
  z.object({
    type: z.literal('dish'),
    dish: DishSchema,
    isRevision: z.boolean(),
    kcalMismatch: z.boolean(),
  }),
]);

export const ModerationQueueResponseSchema = z.object({ items: z.array(ModerationQueueItemSchema) });
```

`packages/contracts/src/me.ts`:

```ts
import { z } from 'zod';
import { DishSchema } from './dish.ts';
import { ProductSchema } from './product.ts';

export const MyItemsResponseSchema = z.object({
  products: z.array(ProductSchema),
  dishes: z.array(DishSchema),
});
```

Replace `packages/contracts/src/index.ts` with:

```ts
export * from './common.ts';
export * from './nutrients.ts';
export * from './product.ts';
export * from './dish.ts';
export * from './scan.ts';
export * from './errors.ts';
export * from './diary.ts';
export * from './profile.ts';
export * from './weight.ts';
export * from './search.ts';
export * from './stats.ts';
export * from './uploads.ts';
export * from './moderation.ts';
export * from './me.ts';
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @foodlog/contracts test`
Expected: PASS — `Test Files 11 passed`.

- [ ] **Step 5: Run all gates and commit**

Run: `pnpm format && pnpm turbo run lint typecheck test`
Expected: all succeed.

```bash
git add packages/contracts
git commit -m "feat(contracts): diary, profile, weight, search, stats, uploads and moderation schemas"
```

---

### Task 4: Domain package + nutrition core

**Files:**
- Create: `packages/domain/package.json`, `packages/domain/tsconfig.json`, `packages/domain/src/index.ts`, `packages/domain/src/errors.ts`, `packages/domain/src/nutrition.ts`, `packages/domain/src/testing/nutrients.ts`
- Test: `packages/domain/src/nutrition.test.ts`, `packages/domain/src/errors.test.ts`

**Interfaces:**
- Consumes: `type Nutrients`, `type Meal`, `type ErrorCode` from `@foodlog/contracts`.
- Produces (exported from `@foodlog/domain`):
  - `class DomainError extends Error { readonly code: ErrorCode; readonly details: unknown }` — `new DomainError(code, message, details?)`
  - `zeroNutrients(): Nutrients`
  - `scaleNutrients(per100g: Nutrients, grams: number): Nutrients`
  - `sumNutrients(items: readonly Nutrients[]): Nutrients`
  - `per100gFromTotals(totals: Nutrients, weightG: number): Nutrients` — throws `DomainError('VALIDATION')` when `weightG <= 0`
  - `KCAL_MISMATCH_TOLERANCE = 0.2`; `kcalFromMacros(n: Pick<Nutrients, 'protein'|'fat'|'carbs'>): number`; `hasKcalMismatch(n: Nutrients): boolean`
  - `type DaySummary = { totals: Nutrients; byMeal: Record<Meal, Nutrients> }`; `summarizeDay(entries: readonly { meal: Meal; nutrients: Nutrients }[]): DaySummary`
- Test-only (not exported): `expectNutrientsClose(actual: Nutrients, expected: Nutrients, digits?: number): void`

- [ ] **Step 1: Create the domain package shell**

`packages/domain/package.json`:

```json
{
  "name": "@foodlog/domain",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "typecheck": "tsc -p tsconfig.json",
    "lint": "eslint src",
    "test": "vitest run"
  },
  "dependencies": { "@foodlog/contracts": "workspace:*" }
}
```

`packages/domain/tsconfig.json`:

```json
{ "extends": "../../tsconfig.base.json", "include": ["src"] }
```

`packages/domain/src/index.ts`:

```ts
export * from './errors.ts';
export * from './nutrition.ts';
```

`packages/domain/src/testing/nutrients.ts`:

```ts
import { expect } from 'vitest';
import type { Nutrients } from '@foodlog/contracts';

export function expectNutrientsClose(actual: Nutrients, expected: Nutrients, digits = 6): void {
  expect(actual.kcal).toBeCloseTo(expected.kcal, digits);
  expect(actual.protein).toBeCloseTo(expected.protein, digits);
  expect(actual.fat).toBeCloseTo(expected.fat, digits);
  expect(actual.carbs).toBeCloseTo(expected.carbs, digits);
}
```

Run: `pnpm install`
Expected: workspace link for `@foodlog/contracts` created.

- [ ] **Step 2: Write the failing tests**

`packages/domain/src/errors.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DomainError } from './errors.ts';

describe('DomainError', () => {
  it('carries a code, message and details', () => {
    const error = new DomainError('NOT_FOUND', 'Product not found', { id: 'off-4820000000013' });
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('DomainError');
    expect(error.code).toBe('NOT_FOUND');
    expect(error.message).toBe('Product not found');
    expect(error.details).toEqual({ id: 'off-4820000000013' });
  });
});
```

`packages/domain/src/nutrition.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DomainError } from './errors.ts';
import {
  hasKcalMismatch,
  kcalFromMacros,
  per100gFromTotals,
  scaleNutrients,
  sumNutrients,
  summarizeDay,
  zeroNutrients,
} from './nutrition.ts';
import { expectNutrientsClose } from './testing/nutrients.ts';

const apple = { kcal: 52, protein: 0.3, fat: 0.2, carbs: 14 };

describe('scaleNutrients', () => {
  it('scales per-100 g values to a portion', () => {
    expectNutrientsClose(scaleNutrients(apple, 150), { kcal: 78, protein: 0.45, fat: 0.3, carbs: 21 });
  });
});

describe('sumNutrients', () => {
  it('returns zeros for no items', () => {
    expect(sumNutrients([])).toEqual(zeroNutrients());
  });

  it('adds field by field', () => {
    expectNutrientsClose(sumNutrients([apple, { kcal: 100, protein: 10, fat: 5, carbs: 1 }]), {
      kcal: 152,
      protein: 10.3,
      fat: 5.2,
      carbs: 15,
    });
  });
});

describe('per100gFromTotals', () => {
  it('converts totals of a 250 g portion back to per 100 g', () => {
    expectNutrientsClose(per100gFromTotals({ kcal: 500, protein: 25, fat: 10, carbs: 75 }, 250), {
      kcal: 200,
      protein: 10,
      fat: 4,
      carbs: 30,
    });
  });

  it('rejects a non-positive weight', () => {
    expect(() => per100gFromTotals(apple, 0)).toThrow(DomainError);
  });
});

describe('kcalFromMacros', () => {
  it('uses 4/9/4 kcal per gram', () => {
    expect(kcalFromMacros(apple)).toBeCloseTo(59, 6);
  });
});

describe('hasKcalMismatch', () => {
  it.each([
    ['an apple', apple, false],
    ['a misread kcal (520 instead of 52)', { ...apple, kcal: 520 }, true],
    ['all zeros', zeroNutrients(), false],
    ['zero kcal with protein', { kcal: 0, protein: 10, fat: 0, carbs: 0 }, true],
    ['exactly 20% off', { kcal: 100, protein: 30, fat: 0, carbs: 0 }, false],
    ['just over 20% off', { kcal: 100, protein: 30.25, fat: 0, carbs: 0 }, true],
  ])('%s → %s', (_label, nutrients, expected) => {
    expect(hasKcalMismatch(nutrients)).toBe(expected);
  });
});

describe('summarizeDay', () => {
  it('totals the day and each meal, with zeros for empty meals', () => {
    const summary = summarizeDay([
      { meal: 'breakfast', nutrients: { kcal: 300, protein: 20, fat: 10, carbs: 30 } },
      { meal: 'breakfast', nutrients: { kcal: 100, protein: 5, fat: 2, carbs: 15 } },
      { meal: 'snack', nutrients: apple },
    ]);
    expectNutrientsClose(summary.byMeal.breakfast, { kcal: 400, protein: 25, fat: 12, carbs: 45 });
    expect(summary.byMeal.lunch).toEqual(zeroNutrients());
    expect(summary.byMeal.dinner).toEqual(zeroNutrients());
    expectNutrientsClose(summary.byMeal.snack, apple);
    expectNutrientsClose(summary.totals, { kcal: 452, protein: 25.3, fat: 12.2, carbs: 59 });
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm --filter @foodlog/domain test`
Expected: FAIL — `Failed to resolve import "./errors.ts"` / `"./nutrition.ts"`.

- [ ] **Step 4: Implement `errors.ts` and `nutrition.ts`**

`packages/domain/src/errors.ts`:

```ts
import type { ErrorCode } from '@foodlog/contracts';

export class DomainError extends Error {
  readonly code: ErrorCode;
  readonly details: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.details = details;
  }
}
```

`packages/domain/src/nutrition.ts`:

```ts
import type { Meal, Nutrients } from '@foodlog/contracts';
import { DomainError } from './errors.ts';

export function zeroNutrients(): Nutrients {
  return { kcal: 0, protein: 0, fat: 0, carbs: 0 };
}

function mapNutrients(n: Nutrients, f: (value: number) => number): Nutrients {
  return { kcal: f(n.kcal), protein: f(n.protein), fat: f(n.fat), carbs: f(n.carbs) };
}

export function scaleNutrients(per100g: Nutrients, grams: number): Nutrients {
  return mapNutrients(per100g, (value) => (value * grams) / 100);
}

export function sumNutrients(items: readonly Nutrients[]): Nutrients {
  return items.reduce<Nutrients>(
    (acc, n) => ({
      kcal: acc.kcal + n.kcal,
      protein: acc.protein + n.protein,
      fat: acc.fat + n.fat,
      carbs: acc.carbs + n.carbs,
    }),
    zeroNutrients(),
  );
}

export function per100gFromTotals(totals: Nutrients, weightG: number): Nutrients {
  if (!(weightG > 0)) {
    throw new DomainError('VALIDATION', 'Weight must be greater than 0 g');
  }
  return mapNutrients(totals, (value) => (value * 100) / weightG);
}

export const KCAL_MISMATCH_TOLERANCE = 0.2;

export function kcalFromMacros(n: Pick<Nutrients, 'protein' | 'fat' | 'carbs'>): number {
  return 4 * n.protein + 9 * n.fat + 4 * n.carbs;
}

// Flags values whose stated kcal disagrees with 4/9/4 by more than 20% — typical of a misread label.
export function hasKcalMismatch(n: Nutrients): boolean {
  return Math.abs(n.kcal - kcalFromMacros(n)) / Math.max(n.kcal, 1) > KCAL_MISMATCH_TOLERANCE;
}

export type DaySummary = { totals: Nutrients; byMeal: Record<Meal, Nutrients> };

export function summarizeDay(entries: readonly { meal: Meal; nutrients: Nutrients }[]): DaySummary {
  const totalFor = (meal: Meal): Nutrients =>
    sumNutrients(entries.filter((e) => e.meal === meal).map((e) => e.nutrients));
  return {
    totals: sumNutrients(entries.map((e) => e.nutrients)),
    byMeal: {
      breakfast: totalFor('breakfast'),
      lunch: totalFor('lunch'),
      dinner: totalFor('dinner'),
      snack: totalFor('snack'),
    },
  };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @foodlog/domain test`
Expected: PASS — `Test Files 2 passed`.

- [ ] **Step 6: Run all gates and commit**

Run: `pnpm format && pnpm turbo run lint typecheck test`
Expected: all succeed.

```bash
git add packages/domain pnpm-lock.yaml
git commit -m "feat(domain): nutrition math, kcal mismatch check and day summary"
```

---

### Task 5: Dish computation

**Files:**
- Create: `packages/domain/src/dish.ts`
- Modify: `packages/domain/src/index.ts`
- Test: `packages/domain/src/dish.test.ts`

**Interfaces:**
- Consumes: `scaleNutrients`, `sumNutrients`, `per100gFromTotals`, `DomainError` (Task 4); `type Nutrients`.
- Produces:
  - `type DishIngredientValues = { grams: number; per100g: Nutrients }`
  - `type DishComputation = { totals: Nutrients; weightG: number; per100g: Nutrients }`
  - `computeDish(ingredients: readonly DishIngredientValues[], cookedWeightG?: number): DishComputation` — throws `DomainError('VALIDATION')` for no ingredients or non-positive weight

- [ ] **Step 1: Write the failing test**

`packages/domain/src/dish.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { computeDish } from './dish.ts';
import { DomainError } from './errors.ts';
import { expectNutrientsClose } from './testing/nutrients.ts';

const buckwheat = { grams: 100, per100g: { kcal: 343, protein: 13.3, fat: 3.4, carbs: 68 } };
const butter = { grams: 10, per100g: { kcal: 748, protein: 0.5, fat: 82.5, carbs: 0.8 } };
const totals = { kcal: 417.8, protein: 13.35, fat: 11.65, carbs: 68.08 };

describe('computeDish', () => {
  it('sums ingredients and uses their total weight by default', () => {
    const dish = computeDish([buckwheat, butter]);
    expectNutrientsClose(dish.totals, totals);
    expect(dish.weightG).toBe(110);
    expectNutrientsClose(dish.per100g, {
      kcal: (417.8 * 100) / 110,
      protein: (13.35 * 100) / 110,
      fat: (11.65 * 100) / 110,
      carbs: (68.08 * 100) / 110,
    });
  });

  it('uses the cooked weight for per-100 g values when given', () => {
    const dish = computeDish([buckwheat, butter], 250);
    expectNutrientsClose(dish.totals, totals);
    expect(dish.weightG).toBe(250);
    expectNutrientsClose(dish.per100g, { kcal: 167.12, protein: 5.34, fat: 4.66, carbs: 27.232 });
  });

  it('rejects a dish without ingredients', () => {
    expect(() => computeDish([])).toThrow(DomainError);
  });

  it('rejects a zero cooked weight', () => {
    expect(() => computeDish([buckwheat], 0)).toThrow(DomainError);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @foodlog/domain test src/dish.test.ts`
Expected: FAIL — `Failed to resolve import "./dish.ts"`.

- [ ] **Step 3: Implement `dish.ts`**

`packages/domain/src/dish.ts`:

```ts
import type { Nutrients } from '@foodlog/contracts';
import { DomainError } from './errors.ts';
import { per100gFromTotals, scaleNutrients, sumNutrients } from './nutrition.ts';

export type DishIngredientValues = { grams: number; per100g: Nutrients };
export type DishComputation = { totals: Nutrients; weightG: number; per100g: Nutrients };

export function computeDish(
  ingredients: readonly DishIngredientValues[],
  cookedWeightG?: number,
): DishComputation {
  if (ingredients.length === 0) {
    throw new DomainError('VALIDATION', 'A dish needs at least one ingredient');
  }
  const totals = sumNutrients(ingredients.map((i) => scaleNutrients(i.per100g, i.grams)));
  const weightG = cookedWeightG ?? ingredients.reduce((sum, i) => sum + i.grams, 0);
  return { totals, weightG, per100g: per100gFromTotals(totals, weightG) };
}
```

Add to `packages/domain/src/index.ts`:

```ts
export * from './dish.ts';
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @foodlog/domain test`
Expected: PASS — `Test Files 3 passed`.

- [ ] **Step 5: Run all gates and commit**

Run: `pnpm format && pnpm turbo run lint typecheck test`
Expected: all succeed.

```bash
git add packages/domain
git commit -m "feat(domain): dish totals, weight and per-100 g computation"
```

---

### Task 6: Barcode canonicalization + label normalization

**Files:**
- Create: `packages/domain/src/barcode.ts`, `packages/domain/src/label.ts`
- Modify: `packages/domain/src/index.ts`
- Test: `packages/domain/src/barcode.test.ts`, `packages/domain/src/label.test.ts`

**Interfaces:**
- Consumes: `EanSchema`, `Per100gSchema`, `type DraftWarning`, `type LabelReading`, `type ProductDraft` from `@foodlog/contracts`; `hasKcalMismatch` (Task 4).
- Produces:
  - `normalizeBarcode(raw: string): string | undefined` — strips spaces/dashes, validates, pads UPC-A (12) to EAN-13
  - `KJ_PER_KCAL = 4.184`
  - `type LabelNormalization = { ok: true; draft: ProductDraft; warnings: DraftWarning[] } | { ok: false; code: 'SCAN_UNREADABLE' }`
  - `normalizeLabel(reading: LabelReading, scannedBarcode?: string): LabelNormalization` — warnings are pushed in this order: `SERVING_SIZE_REQUIRED`, `MISSING_VALUES`, `OUT_OF_RANGE`, `KCAL_MISMATCH`

- [ ] **Step 1: Write the failing tests**

`packages/domain/src/barcode.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { normalizeBarcode } from './barcode.ts';

describe('normalizeBarcode', () => {
  it('pads UPC-A to the EAN-13 form stored by Open Food Facts', () => {
    expect(normalizeBarcode('012345678905')).toBe('0012345678905');
  });

  it.each([
    [' 4820000000013 ', '4820000000013'],
    ['4820-0000-00013', '4820000000013'],
    ['12345678', '12345678'],
    ['14820000000010', '14820000000010'],
  ])('normalizes %s to %s', (raw, expected) => {
    expect(normalizeBarcode(raw)).toBe(expected);
  });

  it.each(['abc', '1234567', '12345678901', ''])('rejects %s', (raw) => {
    expect(normalizeBarcode(raw)).toBeUndefined();
  });
});
```

`packages/domain/src/label.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { LabelReading } from '@foodlog/contracts';
import { normalizeLabel } from './label.ts';

const yogurt: LabelReading = {
  readable: true,
  name: ' Йогурт персик ',
  brand: 'Галичина',
  basis: 'per100g',
  energyKcal: 72,
  protein: 3.3,
  fat: 1.3,
  carbs: 11.3,
};

describe('normalizeLabel', () => {
  it('passes per-100 g values through and trims text', () => {
    expect(normalizeLabel(yogurt)).toEqual({
      ok: true,
      draft: {
        name: 'Йогурт персик',
        brand: 'Галичина',
        per100g: { kcal: 72, protein: 3.3, fat: 1.3, carbs: 11.3 },
      },
      warnings: [],
    });
  });

  it('converts per-serving values to per 100 g, rounded to 0.1, and keeps the serving size', () => {
    const result = normalizeLabel({
      readable: true,
      name: 'Батончик',
      basis: 'perServing',
      servingSizeG: 30,
      energyKcal: 120,
      protein: 3,
      fat: 6,
      carbs: 14,
    });
    expect(result).toEqual({
      ok: true,
      draft: {
        name: 'Батончик',
        servingSizeG: 30,
        per100g: { kcal: 400, protein: 10, fat: 20, carbs: 46.7 },
      },
      warnings: [],
    });
  });

  it('leaves per-100 g values empty when a per-serving label has no serving size', () => {
    const result = normalizeLabel({
      readable: true,
      name: 'Батончик',
      basis: 'perServing',
      energyKcal: 120,
      protein: 3,
      fat: 6,
      carbs: 14,
    });
    expect(result).toEqual({
      ok: true,
      draft: {
        name: 'Батончик',
        per100g: { kcal: undefined, protein: undefined, fat: undefined, carbs: undefined },
      },
      warnings: ['SERVING_SIZE_REQUIRED'],
    });
  });

  it('derives kcal from kJ when only kJ is printed', () => {
    const result = normalizeLabel({
      readable: true,
      name: 'Мюслі',
      basis: 'per100g',
      energyKj: 1500,
      protein: 10,
      fat: 20,
      carbs: 40,
    });
    expect(result.ok && result.draft.per100g.kcal).toBe(358.5);
    expect(result.ok && result.warnings).toEqual([]);
  });

  it('prefers printed kcal over kJ', () => {
    const result = normalizeLabel({ ...yogurt, energyKj: 9999 });
    expect(result.ok && result.draft.per100g.kcal).toBe(72);
  });

  it('flags missing values', () => {
    const result = normalizeLabel({ ...yogurt, fat: undefined });
    expect(result.ok && result.warnings).toEqual(['MISSING_VALUES']);
  });

  it('flags a missing name', () => {
    const result = normalizeLabel({ ...yogurt, name: '  ' });
    expect(result.ok && result.warnings).toEqual(['MISSING_VALUES']);
  });

  it('flags a kcal value that disagrees with the macros', () => {
    const result = normalizeLabel({ ...yogurt, energyKcal: 720 });
    expect(result.ok && result.warnings).toEqual(['KCAL_MISMATCH']);
  });

  it('flags impossible per-100 g values', () => {
    const result = normalizeLabel({
      readable: true,
      name: 'Помилка',
      basis: 'per100g',
      energyKcal: 590,
      protein: 60,
      fat: 30,
      carbs: 20,
    });
    expect(result.ok && result.warnings).toEqual(['OUT_OF_RANGE']);
  });

  it('prefers the scanned barcode, then a valid printed one, and canonicalizes UPC-A', () => {
    const printed = { ...yogurt, barcode: '4820000000020' };
    expect(normalizeLabel(printed, '4820000000013')).toMatchObject({
      draft: { barcode: '4820000000013' },
    });
    expect(normalizeLabel(printed)).toMatchObject({ draft: { barcode: '4820000000020' } });
    expect(normalizeLabel({ ...yogurt, barcode: '012345678905' })).toMatchObject({
      draft: { barcode: '0012345678905' },
    });
    const noBarcode = normalizeLabel({ ...yogurt, barcode: 'not a code' });
    expect(noBarcode.ok && 'barcode' in noBarcode.draft).toBe(false);
  });

  it.each([
    ['the model marks it unreadable', { ...yogurt, readable: false }],
    [
      'there is no name and no value',
      { readable: true, basis: 'per100g' } satisfies LabelReading,
    ],
  ])('returns SCAN_UNREADABLE when %s', (_label, reading) => {
    expect(normalizeLabel(reading)).toEqual({ ok: false, code: 'SCAN_UNREADABLE' });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @foodlog/domain test src/barcode.test.ts src/label.test.ts`
Expected: FAIL — `Failed to resolve import "./barcode.ts"` / `"./label.ts"`.

- [ ] **Step 3: Implement `barcode.ts` and `label.ts`**

`packages/domain/src/barcode.ts`:

```ts
import { EanSchema } from '@foodlog/contracts';

// UPC-A (12 digits) and its EAN-13 form with a leading 0 identify the same product; Open Food
// Facts stores the 13-digit form, so every lookup and write goes through this canonical form.
export function normalizeBarcode(raw: string): string | undefined {
  const digits = raw.replace(/[\s-]/g, '');
  if (!EanSchema.safeParse(digits).success) return undefined;
  return digits.length === 12 ? `0${digits}` : digits;
}
```

`packages/domain/src/label.ts`:

```ts
import {
  Per100gSchema,
  type DraftWarning,
  type LabelReading,
  type ProductDraft,
} from '@foodlog/contracts';
import { normalizeBarcode } from './barcode.ts';
import { hasKcalMismatch } from './nutrition.ts';

export const KJ_PER_KCAL = 4.184;

export type LabelNormalization =
  | { ok: true; draft: ProductDraft; warnings: DraftWarning[] }
  | { ok: false; code: 'SCAN_UNREADABLE' };

const round1 = (value: number): number => Math.round(value * 10) / 10;

// The model reports what is printed; all arithmetic (per-serving → per-100 g, kJ → kcal) happens
// here so it is deterministic and tested.
export function normalizeLabel(reading: LabelReading, scannedBarcode?: string): LabelNormalization {
  const name = reading.name?.trim() ?? '';
  const kcal =
    reading.energyKcal ??
    (reading.energyKj === undefined ? undefined : reading.energyKj / KJ_PER_KCAL);
  const printed = [kcal, reading.protein, reading.fat, reading.carbs];
  if (!reading.readable || (name === '' && printed.every((v) => v === undefined))) {
    return { ok: false, code: 'SCAN_UNREADABLE' };
  }

  const warnings: DraftWarning[] = [];
  let factor: number | undefined = 1;
  if (reading.basis === 'perServing') {
    if (reading.servingSizeG === undefined) {
      factor = undefined;
      warnings.push('SERVING_SIZE_REQUIRED');
    } else {
      factor = 100 / reading.servingSizeG;
    }
  }
  const convert = (value: number | undefined): number | undefined =>
    value === undefined || factor === undefined ? undefined : round1(value * factor);
  const per100g = {
    kcal: convert(kcal),
    protein: convert(reading.protein),
    fat: convert(reading.fat),
    carbs: convert(reading.carbs),
  };

  const hasGap = Object.values(per100g).some((v) => v === undefined);
  if (name === '' || (factor !== undefined && hasGap)) warnings.push('MISSING_VALUES');

  if (
    per100g.kcal !== undefined &&
    per100g.protein !== undefined &&
    per100g.fat !== undefined &&
    per100g.carbs !== undefined
  ) {
    const complete = {
      kcal: per100g.kcal,
      protein: per100g.protein,
      fat: per100g.fat,
      carbs: per100g.carbs,
    };
    if (!Per100gSchema.safeParse(complete).success) warnings.push('OUT_OF_RANGE');
    if (hasKcalMismatch(complete)) warnings.push('KCAL_MISMATCH');
  }

  const barcode = [scannedBarcode, reading.barcode]
    .map((candidate) => (candidate === undefined ? undefined : normalizeBarcode(candidate)))
    .find((candidate) => candidate !== undefined);
  const brand = reading.brand?.trim();

  const draft: ProductDraft = {
    name,
    per100g,
    ...(brand ? { brand } : {}),
    ...(barcode ? { barcode } : {}),
    ...(reading.servingSizeG === undefined ? {} : { servingSizeG: reading.servingSizeG }),
  };
  return { ok: true, draft, warnings };
}
```

Add to `packages/domain/src/index.ts`:

```ts
export * from './barcode.ts';
export * from './label.ts';
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @foodlog/domain test`
Expected: PASS — `Test Files 5 passed`.

- [ ] **Step 5: Run all gates and commit**

Run: `pnpm format && pnpm turbo run lint typecheck test`
Expected: all succeed.

```bash
git add packages/domain
git commit -m "feat(domain): barcode canonicalization and label normalization"
```

---

### Task 7: Daily targets (Mifflin–St Jeor)

**Files:**
- Create: `packages/domain/src/targets.ts`
- Modify: `packages/domain/src/index.ts`
- Test: `packages/domain/src/targets.test.ts`

**Interfaces:**
- Consumes: `type Activity`, `type Goal`, `type Sex`, `type Targets` from `@foodlog/contracts`.
- Produces:
  - `ACTIVITY_FACTORS: Record<Activity, number>`; `GOAL_FACTORS: Record<Goal, number>`; `PROTEIN_G_PER_KG = 1.6`; `FAT_SHARE_OF_KCAL = 0.25`
  - `type TargetInput = { sex: Sex; birthYear: number; heightCm: number; weightKg: number; activity: Activity; goal: Goal; currentYear: number }`
  - `basalMetabolicRate(input: Pick<TargetInput, 'sex'|'birthYear'|'heightCm'|'weightKg'|'currentYear'>): number`
  - `splitMacros(kcal: number, weightKg: number): Targets` — integer grams, carbs floored at 0
  - `computeTargets(input: TargetInput): Targets` — kcal rounded to an integer before the macro split

- [ ] **Step 1: Write the failing test**

`packages/domain/src/targets.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { basalMetabolicRate, computeTargets, splitMacros } from './targets.ts';

const currentYear = 2026;

describe('basalMetabolicRate', () => {
  it('applies Mifflin–St Jeor for men and women', () => {
    expect(
      basalMetabolicRate({ sex: 'male', birthYear: 1996, heightCm: 180, weightKg: 80, currentYear }),
    ).toBeCloseTo(1780, 6);
    expect(
      basalMetabolicRate({ sex: 'female', birthYear: 2001, heightCm: 165, weightKg: 60, currentYear }),
    ).toBeCloseTo(1345.25, 6);
  });
});

describe('computeTargets', () => {
  it('maintains a moderately active man', () => {
    expect(
      computeTargets({
        sex: 'male',
        birthYear: 1996,
        heightCm: 180,
        weightKg: 80,
        activity: 'moderate',
        goal: 'maintain',
        currentYear,
      }),
    ).toEqual({ kcal: 2759, protein: 128, fat: 77, carbs: 389 });
  });

  it('applies a 15% deficit for a sedentary woman losing weight', () => {
    expect(
      computeTargets({
        sex: 'female',
        birthYear: 2001,
        heightCm: 165,
        weightKg: 60,
        activity: 'sedentary',
        goal: 'lose',
        currentYear,
      }),
    ).toEqual({ kcal: 1372, protein: 96, fat: 38, carbs: 162 });
  });

  it('applies a 10% surplus for a very active man gaining weight', () => {
    expect(
      computeTargets({
        sex: 'male',
        birthYear: 1986,
        heightCm: 175,
        weightKg: 90,
        activity: 'very_active',
        goal: 'gain',
        currentYear,
      }),
    ).toEqual({ kcal: 3759, protein: 144, fat: 104, carbs: 562 });
  });
});

describe('splitMacros', () => {
  it('never returns negative carbs', () => {
    expect(splitMacros(1000, 200)).toEqual({ kcal: 1000, protein: 320, fat: 28, carbs: 0 });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @foodlog/domain test src/targets.test.ts`
Expected: FAIL — `Failed to resolve import "./targets.ts"`.

- [ ] **Step 3: Implement `targets.ts`**

`packages/domain/src/targets.ts`:

```ts
import type { Activity, Goal, Sex, Targets } from '@foodlog/contracts';

export const ACTIVITY_FACTORS: Record<Activity, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const GOAL_FACTORS: Record<Goal, number> = { lose: 0.85, maintain: 1, gain: 1.1 };

export const PROTEIN_G_PER_KG = 1.6;
export const FAT_SHARE_OF_KCAL = 0.25;

export type TargetInput = {
  sex: Sex;
  birthYear: number;
  heightCm: number;
  weightKg: number;
  activity: Activity;
  goal: Goal;
  currentYear: number;
};

export function basalMetabolicRate(
  input: Pick<TargetInput, 'sex' | 'birthYear' | 'heightCm' | 'weightKg' | 'currentYear'>,
): number {
  const age = input.currentYear - input.birthYear;
  return 10 * input.weightKg + 6.25 * input.heightCm - 5 * age + (input.sex === 'male' ? 5 : -161);
}

export function splitMacros(kcal: number, weightKg: number): Targets {
  const protein = Math.round(PROTEIN_G_PER_KG * weightKg);
  const fat = Math.round((FAT_SHARE_OF_KCAL * kcal) / 9);
  const carbs = Math.max(0, Math.round((kcal - 4 * protein - 9 * fat) / 4));
  return { kcal, protein, fat, carbs };
}

export function computeTargets(input: TargetInput): Targets {
  const kcal = Math.round(
    basalMetabolicRate(input) * ACTIVITY_FACTORS[input.activity] * GOAL_FACTORS[input.goal],
  );
  return splitMacros(kcal, input.weightKg);
}
```

Add to `packages/domain/src/index.ts`:

```ts
export * from './targets.ts';
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @foodlog/domain test`
Expected: PASS — `Test Files 6 passed`.

- [ ] **Step 5: Run all gates and commit**

Run: `pnpm format && pnpm turbo run lint typecheck test`
Expected: all succeed.

```bash
git add packages/domain
git commit -m "feat(domain): Mifflin-St Jeor daily targets and macro split"
```

---

### Task 8: Moderation state machine

**Files:**
- Create: `packages/domain/src/moderation.ts`
- Modify: `packages/domain/src/index.ts`
- Test: `packages/domain/src/moderation.test.ts`

**Interfaces:**
- Consumes: `type ModerationStatus` from `@foodlog/contracts`.
- Produces:
  - `type ModerationActor = 'author' | 'admin'`
  - `type ModerationState<C> = { status: ModerationStatus; rejectReason?: string; pendingRevision?: C; submittedAt?: string }`
  - `type ModerationEvent<C> = { type: 'publish'; at: string } | { type: 'unpublish' } | { type: 'edit'; changes: C; at: string } | { type: 'approve' } | { type: 'reject'; reason: string } | { type: 'hide' }`
  - `type ModerationResult<C> = { ok: true; state: ModerationState<C>; content: C; reindex: boolean } | { ok: false; code: 'FORBIDDEN' | 'CONFLICT'; message: string }`
  - `applyModeration<C>(state: ModerationState<C>, content: C, event: ModerationEvent<C>, actor: ModerationActor): ModerationResult<C>` — `publish`/`unpublish`/`edit` require `author`; `approve`/`reject`/`hide` require `admin`
  - `initialModerationState<C>(publish: boolean, at: string): ModerationState<C>`
  - `isInModerationQueue(state: ModerationState<unknown>): boolean`
  - `isPublic(status: ModerationStatus): boolean`
  - `deletionMode(status: ModerationStatus): 'anonymize' | 'delete'`

- [ ] **Step 1: Write the failing test**

`packages/domain/src/moderation.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  applyModeration,
  deletionMode,
  initialModerationState,
  isInModerationQueue,
  isPublic,
  type ModerationState,
} from './moderation.ts';

type Content = { name: string };
const live: Content = { name: 'Йогурт' };
const changed: Content = { name: 'Йогурт персик' };
const AT = '2026-10-15T10:00:00.000Z';

const state = (s: ModerationState<Content>): ModerationState<Content> => s;

describe('initialModerationState', () => {
  it('submits published items and keeps others private', () => {
    expect(initialModerationState<Content>(true, AT)).toEqual({ status: 'pending', submittedAt: AT });
    expect(initialModerationState<Content>(false, AT)).toEqual({ status: 'private' });
  });
});

describe('applyModeration — author events', () => {
  it('publishes a private item', () => {
    expect(applyModeration(state({ status: 'private' }), live, { type: 'publish', at: AT }, 'author')).toEqual({
      ok: true,
      state: { status: 'pending', submittedAt: AT },
      content: live,
      reindex: false,
    });
  });

  it('republishes a rejected item and clears the reason', () => {
    const result = applyModeration(
      state({ status: 'rejected', rejectReason: 'Wrong kcal' }),
      live,
      { type: 'publish', at: AT },
      'author',
    );
    expect(result).toEqual({ ok: true, state: { status: 'pending', submittedAt: AT }, content: live, reindex: false });
  });

  it('refuses to publish an approved item', () => {
    expect(applyModeration(state({ status: 'approved' }), live, { type: 'publish', at: AT }, 'author')).toMatchObject({
      ok: false,
      code: 'CONFLICT',
    });
  });

  it('unpublishes a pending item back to private', () => {
    expect(
      applyModeration(state({ status: 'pending', submittedAt: AT }), live, { type: 'unpublish' }, 'author'),
    ).toEqual({ ok: true, state: { status: 'private' }, content: live, reindex: false });
  });

  it('refuses to unpublish an approved item', () => {
    expect(applyModeration(state({ status: 'approved' }), live, { type: 'unpublish' }, 'author')).toMatchObject({
      ok: false,
      code: 'CONFLICT',
    });
  });

  it.each(['private', 'pending'] as const)('edits a %s item in place', (status) => {
    const result = applyModeration(state({ status }), live, { type: 'edit', changes: changed, at: AT }, 'author');
    expect(result).toEqual({ ok: true, state: { status }, content: changed, reindex: false });
  });

  it('keeps the reject reason when editing a rejected item', () => {
    const result = applyModeration(
      state({ status: 'rejected', rejectReason: 'Wrong kcal' }),
      live,
      { type: 'edit', changes: changed, at: AT },
      'author',
    );
    expect(result).toEqual({
      ok: true,
      state: { status: 'rejected', rejectReason: 'Wrong kcal' },
      content: changed,
      reindex: false,
    });
  });

  it('stores an edit of an approved item as a pending revision', () => {
    const result = applyModeration(
      state({ status: 'approved', rejectReason: 'Earlier revision rejected' }),
      live,
      { type: 'edit', changes: changed, at: AT },
      'author',
    );
    expect(result).toEqual({
      ok: true,
      state: { status: 'approved', pendingRevision: changed, submittedAt: AT },
      content: live,
      reindex: false,
    });
  });

  it('refuses to edit a hidden item', () => {
    expect(
      applyModeration(state({ status: 'hidden' }), live, { type: 'edit', changes: changed, at: AT }, 'author'),
    ).toMatchObject({ ok: false, code: 'CONFLICT' });
  });
});

describe('applyModeration — admin events', () => {
  it('approves a pending item and requests a reindex', () => {
    expect(
      applyModeration(state({ status: 'pending', submittedAt: AT }), live, { type: 'approve' }, 'admin'),
    ).toEqual({ ok: true, state: { status: 'approved' }, content: live, reindex: true });
  });

  it('approves a pending revision by merging it into the live content', () => {
    expect(
      applyModeration(
        state({ status: 'approved', pendingRevision: changed, submittedAt: AT }),
        live,
        { type: 'approve' },
        'admin',
      ),
    ).toEqual({ ok: true, state: { status: 'approved' }, content: changed, reindex: true });
  });

  it('refuses to approve a private item', () => {
    expect(applyModeration(state({ status: 'private' }), live, { type: 'approve' }, 'admin')).toMatchObject({
      ok: false,
      code: 'CONFLICT',
    });
  });

  it('rejects a pending item with a reason', () => {
    expect(
      applyModeration(
        state({ status: 'pending', submittedAt: AT }),
        live,
        { type: 'reject', reason: 'Wrong kcal' },
        'admin',
      ),
    ).toEqual({ ok: true, state: { status: 'rejected', rejectReason: 'Wrong kcal' }, content: live, reindex: false });
  });

  it('rejects a pending revision but keeps the item approved', () => {
    expect(
      applyModeration(
        state({ status: 'approved', pendingRevision: changed, submittedAt: AT }),
        live,
        { type: 'reject', reason: 'Wrong kcal' },
        'admin',
      ),
    ).toEqual({ ok: true, state: { status: 'approved', rejectReason: 'Wrong kcal' }, content: live, reindex: false });
  });

  it('refuses to reject an approved item without a revision', () => {
    expect(
      applyModeration(state({ status: 'approved' }), live, { type: 'reject', reason: 'Wrong kcal' }, 'admin'),
    ).toMatchObject({ ok: false, code: 'CONFLICT' });
  });

  it('hides an approved item, dropping any revision', () => {
    expect(
      applyModeration(
        state({ status: 'approved', pendingRevision: changed, submittedAt: AT }),
        live,
        { type: 'hide' },
        'admin',
      ),
    ).toEqual({ ok: true, state: { status: 'hidden' }, content: live, reindex: true });
  });

  it('refuses to hide a pending item', () => {
    expect(applyModeration(state({ status: 'pending' }), live, { type: 'hide' }, 'admin')).toMatchObject({
      ok: false,
      code: 'CONFLICT',
    });
  });
});

describe('applyModeration — roles', () => {
  it('forbids authors from admin events and admins from author events', () => {
    expect(applyModeration(state({ status: 'pending' }), live, { type: 'approve' }, 'author')).toMatchObject({
      ok: false,
      code: 'FORBIDDEN',
    });
    expect(applyModeration(state({ status: 'private' }), live, { type: 'publish', at: AT }, 'admin')).toMatchObject({
      ok: false,
      code: 'FORBIDDEN',
    });
  });
});

describe('predicates', () => {
  it('queues pending items and approved items with a revision', () => {
    expect(isInModerationQueue({ status: 'pending' })).toBe(true);
    expect(isInModerationQueue({ status: 'approved', pendingRevision: changed })).toBe(true);
    expect(isInModerationQueue({ status: 'approved' })).toBe(false);
    expect(isInModerationQueue({ status: 'rejected' })).toBe(false);
  });

  it('treats only approved items as public', () => {
    expect(isPublic('approved')).toBe(true);
    expect(isPublic('pending')).toBe(false);
    expect(isPublic('hidden')).toBe(false);
  });

  it('anonymizes approved items on deletion and deletes everything else', () => {
    expect(deletionMode('approved')).toBe('anonymize');
    expect(deletionMode('private')).toBe('delete');
    expect(deletionMode('hidden')).toBe('delete');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @foodlog/domain test src/moderation.test.ts`
Expected: FAIL — `Failed to resolve import "./moderation.ts"`.

- [ ] **Step 3: Implement `moderation.ts`**

`packages/domain/src/moderation.ts`:

```ts
import type { ModerationStatus } from '@foodlog/contracts';

export type ModerationActor = 'author' | 'admin';

export type ModerationState<C> = {
  status: ModerationStatus;
  rejectReason?: string;
  pendingRevision?: C;
  submittedAt?: string;
};

export type ModerationEvent<C> =
  | { type: 'publish'; at: string }
  | { type: 'unpublish' }
  | { type: 'edit'; changes: C; at: string }
  | { type: 'approve' }
  | { type: 'reject'; reason: string }
  | { type: 'hide' };

export type ModerationResult<C> =
  | { ok: true; state: ModerationState<C>; content: C; reindex: boolean }
  | { ok: false; code: 'FORBIDDEN' | 'CONFLICT'; message: string };

const ADMIN_EVENTS: ReadonlySet<ModerationEvent<unknown>['type']> = new Set([
  'approve',
  'reject',
  'hide',
]);

export function initialModerationState<C>(publish: boolean, at: string): ModerationState<C> {
  return publish ? { status: 'pending', submittedAt: at } : { status: 'private' };
}

export function applyModeration<C>(
  state: ModerationState<C>,
  content: C,
  event: ModerationEvent<C>,
  actor: ModerationActor,
): ModerationResult<C> {
  if (ADMIN_EVENTS.has(event.type) !== (actor === 'admin')) {
    return { ok: false, code: 'FORBIDDEN', message: `${event.type} is not allowed for ${actor}` };
  }
  const { status, pendingRevision } = state;
  const hasRevision = pendingRevision !== undefined;
  const conflict: ModerationResult<C> = {
    ok: false,
    code: 'CONFLICT',
    message: `cannot ${event.type} an item in status ${status}${hasRevision ? ' with a pending revision' : ''}`,
  };

  switch (event.type) {
    case 'publish':
      if (status !== 'private' && status !== 'rejected') return conflict;
      return { ok: true, state: { status: 'pending', submittedAt: event.at }, content, reindex: false };
    case 'unpublish':
      if (status !== 'pending') return conflict;
      return { ok: true, state: { status: 'private' }, content, reindex: false };
    case 'edit':
      if (status === 'hidden') return conflict;
      if (status === 'approved') {
        return {
          ok: true,
          state: { status: 'approved', pendingRevision: event.changes, submittedAt: event.at },
          content,
          reindex: false,
        };
      }
      return { ok: true, state, content: event.changes, reindex: false };
    case 'approve':
      if (status === 'pending') {
        return { ok: true, state: { status: 'approved' }, content, reindex: true };
      }
      if (status === 'approved' && pendingRevision !== undefined) {
        return { ok: true, state: { status: 'approved' }, content: pendingRevision, reindex: true };
      }
      return conflict;
    case 'reject':
      if (status === 'pending') {
        return {
          ok: true,
          state: { status: 'rejected', rejectReason: event.reason },
          content,
          reindex: false,
        };
      }
      if (status === 'approved' && hasRevision) {
        return {
          ok: true,
          state: { status: 'approved', rejectReason: event.reason },
          content,
          reindex: false,
        };
      }
      return conflict;
    case 'hide':
      if (status !== 'approved') return conflict;
      return { ok: true, state: { status: 'hidden' }, content, reindex: true };
  }
}

export function isInModerationQueue(state: ModerationState<unknown>): boolean {
  return state.status === 'pending' || state.pendingRevision !== undefined;
}

export function isPublic(status: ModerationStatus): boolean {
  return status === 'approved';
}

export function deletionMode(status: ModerationStatus): 'anonymize' | 'delete' {
  return status === 'approved' ? 'anonymize' : 'delete';
}
```

Add to `packages/domain/src/index.ts`:

```ts
export * from './moderation.ts';
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @foodlog/domain test`
Expected: PASS — `Test Files 7 passed`.

- [ ] **Step 5: Run all gates and commit**

Run: `pnpm format && pnpm turbo run lint typecheck test`
Expected: all succeed.

```bash
git add packages/domain
git commit -m "feat(domain): moderation state machine with revisions, roles and deletion mode"
```

---

### Task 9: Recents, default meal, search text

**Files:**
- Create: `packages/domain/src/dates.ts`, `packages/domain/src/recents.ts`, `packages/domain/src/meal.ts`, `packages/domain/src/search-text.ts`
- Modify: `packages/domain/src/index.ts`
- Test: `packages/domain/src/dates.test.ts`, `packages/domain/src/recents.test.ts`, `packages/domain/src/meal.test.ts`, `packages/domain/src/search-text.test.ts`

**Interfaces:**
- Consumes: `type IsoDate`, `type ItemRef`, `type Meal` from `@foodlog/contracts`.
- Produces:
  - `addDays(date: IsoDate, days: number): IsoDate`
  - `RECENTS_LIMIT = 20`; `RECENTS_WINDOW_DAYS = 30`
  - `deriveRecents(entries: readonly { item: ItemRef; createdAt: string }[], limit?: number): ItemRef[]` — newest first, distinct by `type` + `id`
  - `recentsWindow(today: IsoDate): { from: IsoDate; to: IsoDate }` — 30 days inclusive
  - `defaultMealForHour(hour: number): Meal` — `< 11` breakfast, `< 16` lunch, `< 21` dinner, else snack
  - `normalizeSearchText(text: string): string`; `tokenize(text: string): string[]`; `matchesAllPrefixes(haystack: string, query: string): boolean`

- [ ] **Step 1: Write the failing tests**

`packages/domain/src/dates.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { addDays } from './dates.ts';

describe('addDays', () => {
  it.each([
    ['2026-03-01', -1, '2026-02-28'],
    ['2024-03-01', -1, '2024-02-29'],
    ['2026-12-31', 1, '2027-01-01'],
    ['2026-10-15', -29, '2026-09-16'],
    ['2026-10-15', 0, '2026-10-15'],
  ])('%s plus %i days → %s', (date, days, expected) => {
    expect(addDays(date, days)).toBe(expected);
  });
});
```

`packages/domain/src/recents.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { ItemRef } from '@foodlog/contracts';
import { RECENTS_LIMIT, deriveRecents, recentsWindow } from './recents.ts';

const ULID = '01JA2B3C4D5E6F7G8H9JKMNPQR';
const entry = (item: ItemRef, createdAt: string) => ({ item, createdAt });
const yogurt: ItemRef = { type: 'product', id: 'off-4820000000013' };
const dish: ItemRef = { type: 'dish', id: ULID };

describe('deriveRecents', () => {
  it('returns distinct items, newest first', () => {
    expect(
      deriveRecents([
        entry(yogurt, '2026-10-14T08:00:00.000Z'),
        entry(dish, '2026-10-15T12:00:00.000Z'),
        entry(yogurt, '2026-10-15T08:00:00.000Z'),
      ]),
    ).toEqual([dish, yogurt]);
  });

  it('treats a product and a dish with the same id as different items', () => {
    const sameIdProduct: ItemRef = { type: 'product', id: ULID };
    expect(
      deriveRecents([entry(dish, '2026-10-15T12:00:00.000Z'), entry(sameIdProduct, '2026-10-15T11:00:00.000Z')]),
    ).toEqual([dish, sameIdProduct]);
  });

  it(`caps the list at ${RECENTS_LIMIT} items`, () => {
    const entries = Array.from({ length: RECENTS_LIMIT + 5 }, (_, i) =>
      entry({ type: 'product', id: `off-${String(4820000000000 + i)}` }, `2026-10-15T08:${String(i).padStart(2, '0')}:00.000Z`),
    );
    const recents = deriveRecents(entries);
    expect(recents).toHaveLength(RECENTS_LIMIT);
    expect(recents[0]).toEqual({ type: 'product', id: 'off-4820000000024' });
  });
});

describe('recentsWindow', () => {
  it('covers the last 30 days including today', () => {
    expect(recentsWindow('2026-10-15')).toEqual({ from: '2026-09-16', to: '2026-10-15' });
  });
});
```

`packages/domain/src/meal.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { defaultMealForHour } from './meal.ts';

describe('defaultMealForHour', () => {
  it.each([
    [0, 'breakfast'],
    [10, 'breakfast'],
    [11, 'lunch'],
    [15, 'lunch'],
    [16, 'dinner'],
    [20, 'dinner'],
    [21, 'snack'],
    [23, 'snack'],
  ])('%i:00 → %s', (hour, meal) => {
    expect(defaultMealForHour(hour)).toBe(meal);
  });
});
```

`packages/domain/src/search-text.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { matchesAllPrefixes, normalizeSearchText, tokenize } from './search-text.ts';

describe('normalizeSearchText', () => {
  it('lowercases, maps ё to е and collapses whitespace', () => {
    expect(normalizeSearchText('  Йогурт   ЁЖИК ')).toBe('йогурт ежик');
  });

  it.each(["М'ясо", 'М’ясо', 'Мʼясо', 'М`ясо'])('strips the apostrophe in %s', (text) => {
    expect(normalizeSearchText(text)).toBe('мясо');
  });

  it('applies NFKC (full-width digits become ASCII)', () => {
    expect(normalizeSearchText('Молоко ２.５%')).toBe('молоко 2.5%');
  });
});

describe('tokenize', () => {
  it('splits on anything that is not a letter or digit', () => {
    expect(tokenize('Сир кисломолочний 5%, Галичина')).toEqual(['сир', 'кисломолочний', '5', 'галичина']);
  });

  it('returns no tokens for punctuation only', () => {
    expect(tokenize(' ,.- ')).toEqual([]);
  });
});

describe('matchesAllPrefixes', () => {
  const name = 'Сир кисломолочний Галичина';

  it('matches when every query token prefixes some word, in any order', () => {
    expect(matchesAllPrefixes(name, 'гал сир')).toBe(true);
    expect(matchesAllPrefixes(name, 'кисло')).toBe(true);
  });

  it('does not match a missing word or an empty query', () => {
    expect(matchesAllPrefixes(name, 'молоко')).toBe(false);
    expect(matchesAllPrefixes(name, '   ')).toBe(false);
  });

  it('matches across apostrophe variants', () => {
    expect(matchesAllPrefixes('Мʼясо куряче', "м'яс")).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @foodlog/domain test src/dates.test.ts src/recents.test.ts src/meal.test.ts src/search-text.test.ts`
Expected: FAIL — `Failed to resolve import` for each new module.

- [ ] **Step 3: Implement the modules**

`packages/domain/src/dates.ts`:

```ts
import type { IsoDate } from '@foodlog/contracts';

export function addDays(date: IsoDate, days: number): IsoDate {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
```

`packages/domain/src/recents.ts`:

```ts
import type { IsoDate, ItemRef } from '@foodlog/contracts';
import { addDays } from './dates.ts';

export const RECENTS_LIMIT = 20;
export const RECENTS_WINDOW_DAYS = 30;

export function deriveRecents(
  entries: readonly { item: ItemRef; createdAt: string }[],
  limit = RECENTS_LIMIT,
): ItemRef[] {
  const seen = new Set<string>();
  const recents: ItemRef[] = [];
  for (const entry of entries.toSorted((a, b) => b.createdAt.localeCompare(a.createdAt))) {
    const key = `${entry.item.type}#${entry.item.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    recents.push(entry.item);
    if (recents.length === limit) break;
  }
  return recents;
}

export function recentsWindow(today: IsoDate): { from: IsoDate; to: IsoDate } {
  return { from: addDays(today, -(RECENTS_WINDOW_DAYS - 1)), to: today };
}
```

`packages/domain/src/meal.ts`:

```ts
import type { Meal } from '@foodlog/contracts';

// Spec §11: before 11:00 breakfast, 11:00–16:00 lunch, 16:00–21:00 dinner, otherwise snack.
export function defaultMealForHour(hour: number): Meal {
  if (hour < 11) return 'breakfast';
  if (hour < 16) return 'lunch';
  if (hour < 21) return 'dinner';
  return 'snack';
}
```

`packages/domain/src/search-text.ts`:

```ts
// Shared by the search index (MiniSearch processTerm) and the matching of a user's own items, so
// both sides normalize text identically.
const APOSTROPHES = /['’ʼ`]/g;

export function normalizeSearchText(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(APOSTROPHES, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenize(text: string): string[] {
  return normalizeSearchText(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 0);
}

export function matchesAllPrefixes(haystack: string, query: string): boolean {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return false;
  const tokens = tokenize(haystack);
  return queryTokens.every((q) => tokens.some((token) => token.startsWith(q)));
}
```

Replace `packages/domain/src/index.ts` with the complete list:

```ts
export * from './errors.ts';
export * from './nutrition.ts';
export * from './dish.ts';
export * from './barcode.ts';
export * from './label.ts';
export * from './targets.ts';
export * from './moderation.ts';
export * from './dates.ts';
export * from './recents.ts';
export * from './meal.ts';
export * from './search-text.ts';
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @foodlog/domain test`
Expected: PASS — `Test Files 11 passed`.

- [ ] **Step 5: Verify the public entry points from plain Node**

Run: `node --input-type=module -e "import('@foodlog/domain').then((d) => console.log(Object.keys(d).length > 20, d.normalizeBarcode('012345678905')))"` from `packages/domain`
Expected: `true 0012345678905` — confirms Node 26 runs the source-only packages without a build step (needed by plans 2–3).

- [ ] **Step 6: Run all gates**

Run: `pnpm format && pnpm turbo run lint typecheck test`
Expected: all tasks succeed for `@foodlog/contracts` and `@foodlog/domain`.

- [ ] **Step 7: Commit**

```bash
git add packages/domain
git commit -m "feat(domain): recents, default meal by time and search text normalization"
```
