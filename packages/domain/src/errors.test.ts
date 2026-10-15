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
