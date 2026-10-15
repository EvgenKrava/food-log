import { describe, expect, it } from 'vitest';
import { normalizeBarcode } from './barcode.ts';

describe('normalizeBarcode', () => {
  it('pads UPC-A to the EAN-13 form stored by Open Food Facts', () => {
    expect(normalizeBarcode('012345678905')).toBe('0012345678905');
    expect(normalizeBarcode('012345678905')).toBe(normalizeBarcode('0012345678905'));
  });

  it.each([
    [' 4820000000017 ', '4820000000017'],
    ['4820-0000-00017', '4820000000017'],
    ['12345670', '12345670'],
    ['14820000000014', '14820000000014'],
  ])('normalizes %s to %s', (raw, expected) => {
    expect(normalizeBarcode(raw)).toBe(expected);
  });

  it.each(['abc', '1234567', '12345678901', ''])('rejects %s', (raw) => {
    expect(normalizeBarcode(raw)).toBeUndefined();
  });

  it.each(['4820000000013', '012345678904', '12345678', '14820000000010'])(
    'rejects %s (bad check digit)',
    (raw) => {
      expect(normalizeBarcode(raw)).toBeUndefined();
    },
  );
});
