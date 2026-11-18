import AnthropicBedrock from '@anthropic-ai/bedrock-sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { LabelReadingSchema, type LabelReading } from '@foodlog/contracts';
import { DomainError } from '@foodlog/domain';
import { z } from 'zod';
import type { LabelImage, LabelReader } from './ports.ts';

// Haiku models are served through the legacy InvokeModel stack, so this uses AnthropicBedrock
// (not the Mantle client), signed with the Lambda role. Haiku 4.5 is the default because Haiku 5.5
// is not enabled on the account; LABEL_MODEL switches it without a code change.
export const DEFAULT_LABEL_MODEL = 'global.anthropic.claude-haiku-4-5-20251001-v1:0';

// Haiku 4.5 rejects the effort field; the 5.x generation takes it.
const takesEffort = (model: string) => /claude-[a-z]+-5/.test(model);

// Structured outputs need every property present, so "not printed" is null here and becomes
// undefined in the LabelReading the domain consumes.
const n = (what: string) => z.number().nullable().describe(what);
const LabelOutputSchema = z.object({
  readable: z.boolean().describe('false if the photo is not a nutrition label or is too blurry to read'),
  name: z.string().nullable().describe('Product name as printed, in its original language'),
  brand: z.string().nullable().describe('Brand or manufacturer, if printed'),
  barcode: z.string().nullable().describe('EAN/UPC digits if a barcode number is legible'),
  basis: z
    .enum(['per100g', 'perServing'])
    .describe('Which column the numbers below come from; prefer the per 100 g / 100 ml column when present'),
  servingSizeG: n('Serving size in grams (or ml), only when basis is perServing or a serving is printed'),
  energyKcal: n('Energy in kcal for the chosen basis'),
  energyKj: n('Energy in kJ for the chosen basis, if printed'),
  protein: n('Protein in grams'),
  fat: n('Total fat in grams'),
  carbs: n('Total carbohydrates in grams (not just sugars)'),
});
type LabelOutput = z.infer<typeof LabelOutputSchema>;

const SYSTEM = `You read photos of food packaging nutrition labels (often Ukrainian, Russian, Polish or English).
Report exactly what is printed for one basis column; do not compute or convert anything.
Use a dot as the decimal separator (8,5 on the label is 8.5). Use null for any value that is not printed or not legible.
If the label shows both per 100 g and per serving, use per 100 g.`;

type ParsedResponse<T> = { parsed_output: T | null; stop_reason: string | null };
type ParseClient = { messages: { parse<T>(params: Record<string, unknown>): Promise<ParsedResponse<T>> } };

export class BedrockLabelReader implements LabelReader {
  private readonly client: ParseClient;

  private readonly model: string;

  constructor(model = DEFAULT_LABEL_MODEL, region = process.env.AWS_REGION ?? 'us-east-1') {
    this.model = model;
    // A null apiKey stops the SDK from picking up a bearer token from the environment, so the
    // request is SigV4-signed with the Lambda role. The option type only admits string | undefined.
    this.client = new AnthropicBedrock({
      awsRegion: region,
      apiKey: null as unknown as string,
    }) as unknown as ParseClient;
  }

  async read(image: LabelImage): Promise<LabelReading> {
    let response: ParsedResponse<LabelOutput>;
    try {
      response = await this.client.messages.parse<LabelOutput>({
        model: this.model,
        max_tokens: 4096,
        system: SYSTEM,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.data } },
              { type: 'text', text: 'Read the nutrition facts from this label.' },
            ],
          },
        ],
        output_config: {
          format: zodOutputFormat(LabelOutputSchema),
          ...(takesEffort(this.model) && { effort: 'low' }),
        },
      });
    } catch (err) {
      console.error('label read failed', err);
      throw new DomainError('UPSTREAM_UNAVAILABLE', 'label reader unavailable');
    }
    const raw = response.parsed_output;
    if (!raw) throw new DomainError('SCAN_UNREADABLE', `no label output (${response.stop_reason ?? 'none'})`);
    return toReading(raw);
  }
}

export function toReading(raw: LabelOutput): LabelReading {
  const opt = <T>(v: T | null): T | undefined => (v === null ? undefined : v);
  const amount = (v: number | null): number | undefined => (v === null || v < 0 ? undefined : v);
  return LabelReadingSchema.parse({
    readable: raw.readable,
    name: opt(raw.name),
    brand: opt(raw.brand),
    barcode: opt(raw.barcode),
    basis: raw.basis,
    servingSizeG: raw.servingSizeG !== null && raw.servingSizeG > 0 ? raw.servingSizeG : undefined,
    energyKcal: amount(raw.energyKcal),
    energyKj: amount(raw.energyKj),
    protein: amount(raw.protein),
    fat: amount(raw.fat),
    carbs: amount(raw.carbs),
  });
}
