import { handle } from 'hono/aws-lambda';
import { createApp } from './app.ts';
import { DynamoRepository } from './dynamo-repo.ts';
import { HttpFoodFacts } from './off.ts';

const table = process.env.TABLE_NAME;
if (!table) throw new Error('TABLE_NAME is not set');

const app = createApp({
  repo: new DynamoRepository(table),
  off: new HttpFoodFacts(),
  clock: () => new Date(),
  historyDays: Number(process.env.HISTORY_DAYS ?? 365),
});

export const handler = handle(app);
