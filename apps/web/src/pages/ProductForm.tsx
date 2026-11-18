import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Camera } from 'lucide-react';
import {
  BarcodeSchema,
  CreateProductRequestSchema,
  MealSchema,
  type DraftWarning,
  type Product,
  type ScanResponse,
} from '@foodlog/contracts';
import { hasKcalMismatch, kcalFromMacros } from '@foodlog/domain';
import { tr } from '../i18n';
import { ApiError, api } from '../api';
import { photoToJpegBase64 } from '../photo';
import { ErrorNote, Header } from '../components';
import { kcal as fmtKcal, localDate } from '../format';
import { navigate, useLocation } from '../router';
import { GramsSheet } from './GramsSheet';

const num = (s: string) => (s.trim() === '' ? NaN : Number(s.replace(',', '.')));
const str = (v: number | undefined) => (v === undefined ? '' : String(v));

const warningText = (w: DraftWarning): string =>
  ({
    SERVING_SIZE_REQUIRED: tr('На етикетці значення на порцію: вкажіть вагу порції і перерахуйте на 100 г'),
    MISSING_VALUES: tr('Не все вдалося прочитати: допишіть порожні поля'),
    KCAL_MISMATCH: tr('Калорійність не сходиться з БЖУ: звірте з етикеткою'),
    OUT_OF_RANGE: tr('Деякі числа виглядають дивно: звірте з етикеткою'),
  })[w];

function scanErrorText(err: unknown): string {
  if (err instanceof ApiError && err.code === 'QUOTA_EXCEEDED') return tr('Ліміт сканувань на сьогодні вичерпано. Введіть дані вручну.');
  if (err instanceof ApiError && err.code === 'SCAN_UNREADABLE') return tr('Не вдалося прочитати етикетку. Сфотографуйте ближче і рівніше.');
  return tr('Сканування зараз недоступне. Введіть дані вручну.');
}

export function ProductFormPage() {
  const { query } = useLocation();
  const qc = useQueryClient();
  const date = query.get('date');
  const meal = MealSchema.safeParse(query.get('meal')).data ?? null;
  const [f, setF] = useState({
    name: query.get('name') ?? '',
    brand: '',
    barcode: query.get('barcode') ?? '',
    kcal: '',
    protein: '',
    fat: '',
    carbs: '',
    serving: '',
  });
  const [created, setCreated] = useState<Product | null>(null);
  const [warnings, setWarnings] = useState<DraftWarning[]>([]);
  const photoInput = useRef<HTMLInputElement>(null);

  const scan = useMutation({
    mutationFn: async (file: File) => {
      const image = await photoToJpegBase64(file);
      const barcode = BarcodeSchema.safeParse(f.barcode.replace(/\D/g, '')).data;
      return api.scanLabel({ image, mediaType: 'image/jpeg', ...(barcode ? { barcode } : {}) });
    },
    onSuccess: ({ draft, warnings: w }: ScanResponse) => {
      setF((prev) => ({
        name: draft.name || prev.name,
        brand: draft.brand ?? prev.brand,
        barcode: draft.barcode ?? prev.barcode,
        kcal: str(draft.per100g.kcal),
        protein: str(draft.per100g.protein),
        fat: str(draft.per100g.fat),
        carbs: str(draft.per100g.carbs),
        serving: str(draft.servingSizeG) || prev.serving,
      }));
      setWarnings(w);
    },
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const per100g = { kcal: num(f.kcal), protein: num(f.protein), fat: num(f.fat), carbs: num(f.carbs) };
  const request = {
    name: f.name,
    ...(f.brand.trim() ? { brand: f.brand } : {}),
    ...(f.barcode.trim() ? { barcode: f.barcode.replace(/\D/g, '') } : {}),
    ...(f.serving.trim() ? { servingSizeG: num(f.serving) } : {}),
    per100g,
    publish: false,
  };
  const parsed = CreateProductRequestSchema.safeParse(request);
  const issues = parsed.success ? [] : parsed.error.issues.map((i) => i.path.join('.'));
  const mismatch = parsed.success && hasKcalMismatch(parsed.data.per100g);

  const save = useMutation({
    mutationFn: () => {
      if (!parsed.success) throw new Error(tr('Перевірте поля'));
      return api.createProduct(parsed.data);
    },
    onSuccess: (p) => {
      void qc.invalidateQueries({ queryKey: ['myItems'] });
      void qc.invalidateQueries({ queryKey: ['search'] });
      if (date) setCreated(p);
      else navigate('/catalog');
    },
  });

  const field = (k: keyof typeof f, label: string, opts: { decimal?: boolean; placeholder?: string } = {}) => (
    <label className={`ot-field${issues.some((i) => i === k || i === `per100g.${k}`) && f[k] !== '' ? ' ot-field--error' : ''}`}>
      <span className="ot-label">{label}</span>
      <input className="ot-input ot-num" value={f[k]} onChange={set(k)} inputMode={opts.decimal ? 'decimal' : undefined} placeholder={opts.placeholder} />
    </label>
  );
  const back = () => (date ? navigate(`/add?date=${date}${meal ? `&meal=${meal}` : ''}`) : navigate('/catalog'));

  return (
    <>
      <Header title={tr('Новий продукт')} left={<button className="ot-btn ot-btn--ghost ot-btn--icon" aria-label={tr('Назад')} onClick={back}><ArrowLeft className="ot-icon" /></button>} />
      <form className="ot-content" onSubmit={(e) => { e.preventDefault(); if (parsed.success) save.mutate(); }}>
        <div className="ot-card">
          <button type="button" className="ot-btn ot-btn--soft ot-btn--block" disabled={scan.isPending} onClick={() => photoInput.current?.click()}>
            <Camera className="ot-icon" />
            {scan.isPending ? tr('Читаю етикетку…') : tr('Заповнити з фото етикетки')}
          </button>
          <input
            ref={photoInput}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) scan.mutate(file);
            }}
          />
          {scan.isError ? (
            <p className="ot-chip ot-chip--bad self-start">{scanErrorText(scan.error)}</p>
          ) : scan.isSuccess ? (
            <p className="ot-hint">{tr('Дані прочитав ШІ. Звірте з етикеткою перед збереженням.')}</p>
          ) : (
            <p className="ot-hint">{tr('Сфотографуйте таблицю харчової цінності — ШІ заповнить поля.')}</p>
          )}
          {warnings.map((w) => (
            <p key={w} className="ot-chip ot-chip--warn self-start">{warningText(w)}</p>
          ))}
        </div>
        <div className="ot-card">
          {field('name', tr('Назва'), { placeholder: tr('Наприклад, Сир кисломолочний 5%') })}
          {field('brand', tr('Виробник (необовʼязково)'))}
          {field('barcode', tr('Штрихкод (необовʼязково)'), { decimal: true })}
        </div>
        <div className="ot-card">
          <p className="ot-label">{tr('На 100 г')}</p>
          <div className="grid grid-cols-2 gap-3">
            {field('kcal', tr('Ккал'), { decimal: true })}
            {field('protein', tr('Білки, г'), { decimal: true })}
            {field('fat', tr('Жири, г'), { decimal: true })}
            {field('carbs', tr('Вуглеводи, г'), { decimal: true })}
          </div>
          {mismatch && (
            <p className="ot-chip ot-chip--warn self-start">
              {tr('За БЖУ виходить ≈{kcal} ккал. Перевірте етикетку.', { kcal: fmtKcal(kcalFromMacros(parsed.data.per100g)) })}
            </p>
          )}
          {field('serving', tr('Порція, г (необовʼязково)'), { decimal: true })}
        </div>
        <ErrorNote error={save.error} />
        <button className="ot-btn ot-btn--block" type="submit" disabled={!parsed.success || save.isPending}>
          {save.isPending ? tr('Зберігаю…') : tr('Зберегти')}
        </button>
      </form>
      {created && date && (
        <GramsSheet item={created} date={date} meal={meal} onClose={() => navigate(`/add?date=${date}${meal ? `&meal=${meal}` : ''}`)} onAdded={() => navigate(date === localDate() ? '/' : `/?date=${date}`)} />
      )}
    </>
  );
}
