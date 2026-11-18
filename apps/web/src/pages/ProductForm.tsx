import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { CreateProductRequestSchema, MealSchema, type Product } from '@foodlog/contracts';
import { hasKcalMismatch, kcalFromMacros } from '@foodlog/domain';
import { api } from '../api';
import { ErrorNote, Header } from '../components';
import { kcal as fmtKcal, localDate } from '../format';
import { navigate, useLocation } from '../router';
import { GramsSheet } from './GramsSheet';

const num = (s: string) => (s.trim() === '' ? NaN : Number(s.replace(',', '.')));

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
      if (!parsed.success) throw new Error('Перевірте поля');
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
      <Header title="Новий продукт" left={<button className="ot-btn ot-btn--ghost ot-btn--icon" aria-label="Назад" onClick={back}><ArrowLeft className="ot-icon" /></button>} />
      <form className="ot-content" onSubmit={(e) => { e.preventDefault(); if (parsed.success) save.mutate(); }}>
        <div className="ot-card">
          {field('name', 'Назва', { placeholder: 'Наприклад, Сир кисломолочний 5%' })}
          {field('brand', 'Виробник (необовʼязково)')}
          {field('barcode', 'Штрихкод (необовʼязково)', { decimal: true })}
        </div>
        <div className="ot-card">
          <p className="ot-label">На 100 г</p>
          <div className="grid grid-cols-2 gap-3">
            {field('kcal', 'Ккал', { decimal: true })}
            {field('protein', 'Білки, г', { decimal: true })}
            {field('fat', 'Жири, г', { decimal: true })}
            {field('carbs', 'Вуглеводи, г', { decimal: true })}
          </div>
          {mismatch && (
            <p className="ot-chip ot-chip--warn self-start">
              За БЖУ виходить ≈{fmtKcal(kcalFromMacros(parsed.data.per100g))} ккал. Перевірте етикетку.
            </p>
          )}
          {field('serving', 'Порція, г (необовʼязково)', { decimal: true })}
        </div>
        <ErrorNote error={save.error} />
        <button className="ot-btn ot-btn--block" type="submit" disabled={!parsed.success || save.isPending}>
          {save.isPending ? 'Зберігаю…' : 'Зберегти'}
        </button>
      </form>
      {created && date && (
        <GramsSheet item={created} date={date} meal={meal} onClose={() => navigate(`/add?date=${date}${meal ? `&meal=${meal}` : ''}`)} onAdded={() => navigate(date === localDate() ? '/' : `/?date=${date}`)} />
      )}
    </>
  );
}
