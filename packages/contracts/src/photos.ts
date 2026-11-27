import { z } from 'zod';
import { ItemTypeSchema } from './common.ts';

// A personal photo of a product or dish (say, one cookie on a kitchen scale), visible only to the
// person who took it. The browser shrinks it before upload, so the cap is far above a real photo.
export const PHOTO_UPLOAD_MAX_BYTES = 2 * 1024 * 1024;
/** Photos one person may keep; bounds storage for an abusive account, far above normal use. */
export const PHOTOS_PER_USER_MAX = 500;

// uploads/<cognito sub>/<ulid>.jpg — the API additionally checks the sub matches the caller.
export const PhotoUploadKeySchema = z
  .string()
  .regex(/^uploads\/[0-9a-f-]{36}\/[0-9A-HJKMNP-TV-Z]{26}\.jpg$/, 'must be a photo upload key');

/** A presigned S3 POST: send `fields` plus the file (last) as multipart form data to `url`. */
export const PhotoUploadResponseSchema = z.object({
  url: z.url(),
  fields: z.record(z.string(), z.string()),
  key: PhotoUploadKeySchema,
});
export type PhotoUploadResponse = z.infer<typeof PhotoUploadResponseSchema>;

export const AttachPhotoRequestSchema = z.object({ key: PhotoUploadKeySchema });
export type AttachPhotoRequest = z.infer<typeof AttachPhotoRequestSchema>;

export const PhotoTargetSchema = ItemTypeSchema;

export const PhotoResponseSchema = z.object({ photoUrl: z.url() });
export type PhotoResponse = z.infer<typeof PhotoResponseSchema>;
