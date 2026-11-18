import { DynamoDBClient, TransactionCanceledException } from '@aws-sdk/client-dynamodb';
import {
  BatchWriteCommand,
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  type QueryCommandInput,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import type { DiaryEntry, IsoDate, Profile, WeightEntry } from '@foodlog/contracts';
import type { Repository, ScanLimits, StoredDish, StoredProduct } from './ports.ts';

// Single table (spec §7). Keys: pk/sk; gsi1 = barcode lookup; gsi2 = owner's items. TTL attribute `ttl`.
const userPk = (uid: string) => `USER#${uid}`;
const productPk = (id: string) => `PRODUCT#${id}`;

type Item = Record<string, unknown>;

function strip<T>(item: Item | undefined, keys: readonly string[]): T {
  return Object.fromEntries(Object.entries(item ?? {}).filter(([k]) => !keys.includes(k))) as T;
}
const KEY_ATTRS = ['pk', 'sk', 'gsi1pk', 'gsi1sk', 'gsi2pk', 'gsi2sk', 'ttl', 'kind'] as const;

export class DynamoRepository implements Repository {
  private readonly db: DynamoDBDocumentClient;
  private readonly table: string;

  constructor(table: string, client = new DynamoDBClient({})) {
    this.table = table;
    this.db = DynamoDBDocumentClient.from(client, {
      marshallOptions: { removeUndefinedValues: true },
    });
  }

  private async queryAll(input: Omit<QueryCommandInput, 'TableName'>): Promise<Item[]> {
    const out: Item[] = [];
    let start: Record<string, unknown> | undefined;
    do {
      const res = await this.db.send(
        new QueryCommand({ ...input, TableName: this.table, ExclusiveStartKey: start }),
      );
      out.push(...((res.Items ?? []) as Item[]));
      start = res.LastEvaluatedKey;
    } while (start);
    return out;
  }

  async getDish(id: string) {
    const res = await this.db.send(
      new GetCommand({ TableName: this.table, Key: { pk: `DISH#${id}`, sk: 'META' } }),
    );
    return res.Item ? strip<StoredDish>(res.Item, KEY_ATTRS) : null;
  }

  async putDish(d: StoredDish) {
    await this.db.send(
      new PutCommand({
        TableName: this.table,
        Item: {
          ...d,
          pk: `DISH#${d.id}`,
          sk: 'META',
          kind: 'dish',
          ...(d.ownerId ? { gsi2pk: `OWNER#${d.ownerId}`, gsi2sk: `DISH#${d.updatedAt}#${d.id}` } : {}),
        },
      }),
    );
  }

  async deleteDish(id: string) {
    await this.db.send(
      new DeleteCommand({ TableName: this.table, Key: { pk: `DISH#${id}`, sk: 'META' } }),
    );
  }

  async listOwnDishes(ownerId: string) {
    const items = await this.queryAll({
      IndexName: 'gsi2',
      KeyConditionExpression: 'gsi2pk = :pk AND begins_with(gsi2sk, :p)',
      ExpressionAttributeValues: { ':pk': `OWNER#${ownerId}`, ':p': 'DISH#' },
      ScanIndexForward: false,
    });
    return items.map((i) => strip<StoredDish>(i, KEY_ATTRS));
  }

  async getProduct(id: string) {
    const res = await this.db.send(
      new GetCommand({ TableName: this.table, Key: { pk: productPk(id), sk: 'META' } }),
    );
    return res.Item ? strip<StoredProduct>(res.Item, KEY_ATTRS) : null;
  }

  async putProduct(p: StoredProduct) {
    await this.db.send(
      new PutCommand({
        TableName: this.table,
        Item: {
          ...p,
          pk: productPk(p.id),
          sk: 'META',
          kind: 'product',
          ...(p.barcode ? { gsi1pk: `BARCODE#${p.barcode}`, gsi1sk: `${p.status}#${p.id}` } : {}),
          ...(p.ownerId
            ? { gsi2pk: `OWNER#${p.ownerId}`, gsi2sk: `PRODUCT#${p.updatedAt}#${p.id}` }
            : {}),
        },
      }),
    );
  }

  async deleteProduct(id: string) {
    await this.db.send(
      new DeleteCommand({ TableName: this.table, Key: { pk: productPk(id), sk: 'META' } }),
    );
  }

  async listOwnProducts(ownerId: string) {
    const items = await this.queryAll({
      IndexName: 'gsi2',
      KeyConditionExpression: 'gsi2pk = :pk AND begins_with(gsi2sk, :p)',
      ExpressionAttributeValues: { ':pk': `OWNER#${ownerId}`, ':p': 'PRODUCT#' },
      ScanIndexForward: false,
    });
    return items.map((i) => strip<StoredProduct>(i, KEY_ATTRS));
  }

  async findByBarcode(barcode: string) {
    const items = await this.queryAll({
      IndexName: 'gsi1',
      KeyConditionExpression: 'gsi1pk = :pk',
      ExpressionAttributeValues: { ':pk': `BARCODE#${barcode}` },
    });
    return items.map((i) => strip<StoredProduct>(i, KEY_ATTRS));
  }

  async listEntries(uid: string, from: IsoDate, to: IsoDate) {
    const items = await this.queryAll({
      KeyConditionExpression: 'pk = :pk AND sk BETWEEN :a AND :b',
      ExpressionAttributeValues: { ':pk': userPk(uid), ':a': `DAY#${from}`, ':b': `DAY#${to}~` },
    });
    return items.map((i) => strip<DiaryEntry>(i, KEY_ATTRS));
  }

  async getEntry(uid: string, date: IsoDate, id: string) {
    const res = await this.db.send(
      new GetCommand({ TableName: this.table, Key: { pk: userPk(uid), sk: `DAY#${date}#${id}` } }),
    );
    return res.Item ? strip<DiaryEntry>(res.Item, KEY_ATTRS) : null;
  }

  async putEntry(uid: string, entry: DiaryEntry, expiresAt: number) {
    await this.db.send(
      new PutCommand({
        TableName: this.table,
        Item: {
          ...entry,
          pk: userPk(uid),
          sk: `DAY#${entry.date}#${entry.id}`,
          kind: 'entry',
          ttl: expiresAt,
        },
      }),
    );
  }

  async deleteEntry(uid: string, date: IsoDate, id: string) {
    await this.db.send(
      new DeleteCommand({
        TableName: this.table,
        Key: { pk: userPk(uid), sk: `DAY#${date}#${id}` },
      }),
    );
  }

  async getProfile(uid: string) {
    const res = await this.db.send(
      new GetCommand({ TableName: this.table, Key: { pk: userPk(uid), sk: 'PROFILE' } }),
    );
    return res.Item ? strip<Profile>(res.Item, KEY_ATTRS) : null;
  }

  async putProfile(uid: string, profile: Profile) {
    await this.db.send(
      new PutCommand({
        TableName: this.table,
        Item: { ...profile, pk: userPk(uid), sk: 'PROFILE', kind: 'profile' },
      }),
    );
  }

  async listWeights(uid: string, from: IsoDate, to: IsoDate) {
    const items = await this.queryAll({
      KeyConditionExpression: 'pk = :pk AND sk BETWEEN :a AND :b',
      ExpressionAttributeValues: { ':pk': userPk(uid), ':a': `WEIGHT#${from}`, ':b': `WEIGHT#${to}` },
    });
    return items.map((i) => ({ date: String(i.date), kg: Number(i.kg) }));
  }

  async latestWeight(uid: string) {
    const res = await this.db.send(
      new QueryCommand({
        TableName: this.table,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :p)',
        ExpressionAttributeValues: { ':pk': userPk(uid), ':p': 'WEIGHT#' },
        ScanIndexForward: false,
        Limit: 1,
      }),
    );
    const i = res.Items?.[0];
    return i ? { date: String(i.date), kg: Number(i.kg) } : null;
  }

  async putWeight(uid: string, entry: WeightEntry, expiresAt: number) {
    await this.db.send(
      new PutCommand({
        TableName: this.table,
        Item: { ...entry, pk: userPk(uid), sk: `WEIGHT#${entry.date}`, kind: 'weight', ttl: expiresAt },
      }),
    );
  }

  async deleteWeight(uid: string, date: IsoDate) {
    await this.db.send(
      new DeleteCommand({ TableName: this.table, Key: { pk: userPk(uid), sk: `WEIGHT#${date}` } }),
    );
  }

  async deleteUserData(uid: string) {
    const keys = await this.queryAll({
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: { ':pk': userPk(uid) },
      ProjectionExpression: 'pk, sk',
    });
    for (let i = 0; i < keys.length; i += 25) {
      let requests = keys.slice(i, i + 25).map((k) => ({ DeleteRequest: { Key: k } }));
      while (requests.length > 0) {
        const res = await this.db.send(
          new BatchWriteCommand({ RequestItems: { [this.table]: requests } }),
        );
        requests = (res.UnprocessedItems?.[this.table] ?? []) as typeof requests;
      }
    }
  }

  // Kept outside USER#<uid> on purpose: deleting your data must not reset today's scan count.
  async consumeScanQuota(uid: string, day: IsoDate, limits: ScanLimits, expiresAt: number) {
    const bump = (sk: string, limit: number) => ({
      Update: {
        TableName: this.table,
        Key: { pk: `QUOTA#scan#${day}`, sk },
        UpdateExpression: 'ADD n :one SET #ttl = :ttl',
        ConditionExpression: 'attribute_not_exists(n) OR n < :limit',
        ExpressionAttributeNames: { '#ttl': 'ttl' },
        ExpressionAttributeValues: { ':one': 1, ':limit': limit, ':ttl': expiresAt },
      },
    });
    try {
      await this.db.send(
        new TransactWriteCommand({
          TransactItems: [bump(`USER#${uid}`, limits.perUser), bump('GLOBAL', limits.global)],
        }),
      );
      return true;
    } catch (err) {
      if (err instanceof TransactionCanceledException) return false;
      throw err;
    }
  }
}
