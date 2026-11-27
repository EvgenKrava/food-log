import {
  CopyObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  NoSuchKey,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { PHOTO_UPLOAD_MAX_BYTES } from '@foodlog/contracts';
import { DomainError } from '@foodlog/domain';
import type { PhotoStore } from './ports.ts';

const UPLOAD_TTL_S = 300;

/**
 * Photos bucket (infra/main/photos.tf): `uploads/` is written by the browser through a presigned
 * POST and expires after a day; `photos/` holds attached photos that CloudFront serves at
 * `<publicBase>/photos/...`.
 */
export class S3PhotoStore implements PhotoStore {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly publicBase: string;

  constructor(bucket: string, publicBase: string, client = new S3Client({})) {
    this.bucket = bucket;
    this.publicBase = publicBase.replace(/\/$/, '');
    this.s3 = client;
  }

  async presignUpload(uid: string, id: string) {
    const key = `uploads/${uid}/${id}.jpg`;
    const { url, fields } = await createPresignedPost(this.s3, {
      Bucket: this.bucket,
      Key: key,
      Conditions: [
        ['content-length-range', 1, PHOTO_UPLOAD_MAX_BYTES],
        ['eq', '$Content-Type', 'image/jpeg'],
      ],
      Fields: { 'Content-Type': 'image/jpeg' },
      Expires: UPLOAD_TTL_S,
    });
    return { url, fields, key };
  }

  async attach(uploadKey: string, uid: string, id: string) {
    const key = `photos/${uid}/${id}.jpg`;
    try {
      await this.s3.send(
        new CopyObjectCommand({
          Bucket: this.bucket,
          CopySource: `${this.bucket}/${uploadKey}`,
          Key: key,
          MetadataDirective: 'REPLACE',
          ContentType: 'image/jpeg',
          // A key is never reused: a new photo gets a new key.
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
    } catch (err) {
      if (
        err instanceof NoSuchKey ||
        (err instanceof S3ServiceException && err.name === 'NoSuchKey')
      ) {
        throw new DomainError('NOT_FOUND', 'upload not found');
      }
      throw err;
    }
    await this.remove(uploadKey);
    return key;
  }

  async remove(key: string) {
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async removeAll(uid: string) {
    for (const prefix of [`photos/${uid}/`, `uploads/${uid}/`]) {
      let token: string | undefined;
      do {
        const page = await this.s3.send(
          new ListObjectsV2Command({
            Bucket: this.bucket,
            Prefix: prefix,
            ContinuationToken: token,
          }),
        );
        const keys = (page.Contents ?? []).flatMap((o) => (o.Key ? [{ Key: o.Key }] : []));
        if (keys.length) {
          await this.s3.send(
            new DeleteObjectsCommand({ Bucket: this.bucket, Delete: { Objects: keys } }),
          );
        }
        token = page.NextContinuationToken;
      } while (token);
    }
  }

  url(key: string) {
    return `${this.publicBase}/${key}`;
  }
}
