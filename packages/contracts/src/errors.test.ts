import { describe, expect, it } from 'vitest';
import { ApiErrorSchema, ErrorCodeSchema, HTTP_STATUS_BY_ERROR_CODE } from './errors.ts';

describe('HTTP_STATUS_BY_ERROR_CODE', () => {
  it('maps every error code', () => {
    expect(Object.keys(HTTP_STATUS_BY_ERROR_CODE).sort()).toEqual(
      [...ErrorCodeSchema.options].sort(),
    );
  });

  it('uses 429 for quota and 422 for unreadable scans', () => {
    expect(HTTP_STATUS_BY_ERROR_CODE.QUOTA_EXCEEDED).toBe(429);
    expect(HTTP_STATUS_BY_ERROR_CODE.SCAN_UNREADABLE).toBe(422);
  });
});

describe('ApiErrorSchema', () => {
  it('parses the error envelope', () => {
    expect(
      ApiErrorSchema.safeParse({ error: { code: 'NOT_FOUND', message: 'Product not found' } })
        .success,
    ).toBe(true);
  });

  it('rejects unknown codes', () => {
    expect(ApiErrorSchema.safeParse({ error: { code: 'TEAPOT', message: 'x' } }).success).toBe(
      false,
    );
  });
});
