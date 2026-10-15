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
