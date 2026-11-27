import { GetParameterCommand, ParameterNotFound, SSMClient } from '@aws-sdk/client-ssm';
import { handle } from 'hono/aws-lambda';
import { createApp } from './app.ts';
import { DynamoRepository } from './dynamo-repo.ts';
import { BedrockLabelReader } from './label-reader.ts';
import { HttpFoodFacts } from './off.ts';
import { cachedPlanLimits } from './plans.ts';
import { S3PhotoStore } from './s3-photos.ts';

const table = process.env.TABLE_NAME;
if (!table) throw new Error('TABLE_NAME is not set');

const photoBucket = process.env.PHOTO_BUCKET;
const publicUrl = process.env.PUBLIC_URL;

const ssm = new SSMClient({});
const limitsParam = process.env.PLAN_LIMITS_PARAM ?? '/onlytools/plans/limits';
const planLimits = cachedPlanLimits(async () => {
  try {
    const res = await ssm.send(new GetParameterCommand({ Name: limitsParam }));
    return res.Parameter?.Value;
  } catch (err) {
    if (err instanceof ParameterNotFound) return undefined;
    throw err;
  }
});

const app = createApp({
  repo: new DynamoRepository(table),
  off: new HttpFoodFacts(),
  clock: () => new Date(),
  planLimits,
  ...(photoBucket && publicUrl ? { photos: new S3PhotoStore(photoBucket, publicUrl) } : {}),
  labels: new BedrockLabelReader(process.env.LABEL_MODEL || undefined),
  scanLimits: {
    perUser: 3,
    global: Number(process.env.SCAN_LIMIT_GLOBAL ?? 300),
  },
});

export const handler = handle(app);
