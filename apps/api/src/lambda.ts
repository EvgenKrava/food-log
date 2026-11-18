import { handle } from 'hono/aws-lambda';
import { createApp } from './app.ts';
import { DynamoRepository } from './dynamo-repo.ts';
import { BedrockLabelReader } from './label-reader.ts';
import { HttpFoodFacts } from './off.ts';

const table = process.env.TABLE_NAME;
if (!table) throw new Error('TABLE_NAME is not set');

const app = createApp({
  repo: new DynamoRepository(table),
  off: new HttpFoodFacts(),
  clock: () => new Date(),
  historyDays: Number(process.env.HISTORY_DAYS ?? 365),
  labels: new BedrockLabelReader(process.env.LABEL_MODEL || undefined),
  scanLimits: {
    perUser: Number(process.env.SCAN_LIMIT_PER_USER ?? 20),
    global: Number(process.env.SCAN_LIMIT_GLOBAL ?? 300),
  },
});

export const handler = handle(app);
