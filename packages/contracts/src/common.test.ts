import { describe, expect, it } from 'vitest';
import {
  BarcodeSchema,
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

describe('BarcodeSchema', () => {
  it.each([
    ['012345678905', '0012345678905'],
    ['04820000000017', '4820000000017'],
    ['4820000000017', '4820000000017'],
    ['12345670', '12345670'],
    ['14820000000014', '14820000000014'],
  ])('accepts %s and canonicalizes it to %s', (raw, expected) => {
    expect(BarcodeSchema.parse(raw)).toBe(expected);
  });

  it.each(['4820000000013', '012345678904', '12345678', '14820000000010'])(
    'rejects %s (bad check digit)',
    (v) => {
      expect(BarcodeSchema.safeParse(v).success).toBe(false);
    },
  );

  it('rejects a non-numeric barcode', () => {
    expect(BarcodeSchema.safeParse('482000000001X').success).toBe(false);
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
    expect(ItemRefSchema.safeParse({ type: 'product', id: 'off-4820000000013' }).success).toBe(
      true,
    );
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
