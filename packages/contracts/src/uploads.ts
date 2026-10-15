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
