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
