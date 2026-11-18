import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Search, Trash2 } from 'lucide-react';
import type { CatalogItem, Nutrients } from '@foodlog/contracts';
import { computeDish } from '@foodlog/domain';
import { api } from '../api';
import { ErrorNote, Header, MacroLine, Sheet, kcalText } from '../components';
import { grams, kcal } from '../format';
import { tr } from '../i18n';
import { navigate, useLocation } from '../router';

type Row = { productId: string; name: string; per100g: Nutrients; grams: string };
const num = (s: string) => Number(s.replace(',', '.'));
const okGrams = (s: string) => num(s) > 0 && num(s) <= 5000;

export function DishBuilderPage() {
  const { path } = useLocation();
  const id = path.startsWith('/dishes/') && path !== '/dishes/new' ? path.slice('/dishes/'.length) : null;
  const qc = useQueryClient();
  const existing = useQuery({ queryKey: ['dish', id], queryFn: () => api.dish(id ?? ''), enabled: !!id });
  const [name, setName] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [cooked, setCooked] = useState('');
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    const d = existing.data;
    if (!d) return;
    setName(d.name);
    setRows(d.ingredients.map((i) => ({ productId: i.productId, name: i.name, per100g: i.per100g, grams: String(i.grams) })));
    setCooked(d.cookedWeightG ? String(d.cookedWeightG) : '');
  }, [existing.data]);

  const valid = name.trim() !== '' && rows.length > 0 && rows.every((r) => okGrams(r.grams)) && (cooked === '' || num(cooked) > 0);
  const computed = useMemo(() => {
    const ready = rows.filter((r) => okGrams(r.grams));
    if (!ready.length) return null;
    try {
      return computeDish(ready.map((r) => ({ grams: num(r.grams), per100g: r.per100g })), cooked && num(cooked) > 0 ? num(cooked) : undefined);
    } catch {
      return null;
    }
  }, [rows, cooked]);

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: name.trim(),
        ingredients: rows.map((r) => ({ productId: r.productId, grams: num(r.grams) })),
        ...(cooked ? { cookedWeightG: num(cooked) } : {}),
      };
      return id ? api.updateDish(id, body) : api.createDish({ ...body, publish: false });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['myItems'] });
      void qc.invalidateQueries({ queryKey: ['search'] });
      if (id) void qc.invalidateQueries({ queryKey: ['dish', id] });
      navigate('/catalog?tab=dishes');
    },
  });

  const setRow = (i: number, g: string) => setRows(rows.map((r, j) => (j === i ? { ...r, grams: g } : r)));
  const add = (item: CatalogItem) => {
    setRows([...rows, { productId: item.id, name: item.brand ? `${item.name} · ${item.brand}` : item.name, per100g: item.per100g, grams: '100' }]);
    setPicking(false);
  };

  return (
    <>
      <Header
        title={id ? tr('Страва') : tr('Нова страва')}
        left={<button className="ot-btn ot-btn--ghost ot-btn--icon" aria-label={tr('Назад')} onClick={() => navigate('/catalog?tab=dishes')}><ArrowLeft className="ot-icon" /></button>}
      />
      <form className="ot-content" onSubmit={(e) => { e.preventDefault(); if (valid) save.mutate(); }}>
        <label className="ot-field">
          <span className="ot-label">{tr('Назва')}</span>
          <input className="ot-input" value={name} onChange={(e) => setName(e.target.value)} placeholder={tr('Наприклад, Сирники')} />
        </label>
        <section className="flex flex-col gap-2">
          <h2 className="ot-h3 px-1">{tr('Інгредієнти')}</h2>
          <div className="ot-list">
            {rows.map((r, i) => (
              <div key={`${r.productId}-${i}`} className="ot-row">
                <span className="ot-row__body">
                  <span className="ot-row__title">{r.name}</span>
                  <span className="ot-row__sub ot-num">{okGrams(r.grams) ? kcalText((r.per100g.kcal * num(r.grams)) / 100) : '—'}</span>
                </span>
                <input className="ot-input ot-num" style={{ width: 84, minHeight: 40 }} inputMode="decimal" aria-label={tr('Грами')} value={r.grams} onChange={(e) => setRow(i, e.target.value)} />
                <span className="ot-caption">{tr('г')}</span>
                <button type="button" className="ot-btn ot-btn--ghost ot-btn--icon" aria-label={tr('Видалити')} onClick={() => setRows(rows.filter((_, j) => j !== i))}><Trash2 className="ot-icon" /></button>
              </div>
            ))}
            <button type="button" className="ot-row ot-row--empty text-left" onClick={() => setPicking(true)}>
              <span className="ot-row__body ot-row__sub">{tr('Додати інгредієнт')}</span>
              <span className="ot-row__value"><Plus className="ot-icon" /></span>
            </button>
          </div>
        </section>
        <label className="ot-field">
          <span className="ot-label">{tr('Вага готової страви, г (необовʼязково)')}</span>
          <input className="ot-input ot-num" inputMode="decimal" value={cooked} onChange={(e) => setCooked(e.target.value)} placeholder={computed ? grams(rows.filter((r) => okGrams(r.grams)).reduce((s, r) => s + num(r.grams), 0)) : ''} />
          <span className="ot-hint">{tr('Якщо зважили після готування: вода випаровується, і на 100 г стає більше калорій.')}</span>
        </label>
        {computed && (
          <section className="ot-card ot-card--accent">
            <span className="ot-label">{tr('Уся страва')} · {grams(computed.weightG)} {tr('г')}</span>
            <span className="ot-h2 ot-num">{kcalText(computed.totals.kcal)}</span>
            <span className="ot-label ot-num">{tr('На 100 г')}: {kcal(computed.per100g.kcal)} {tr('ккал')} · <MacroLine n={computed.per100g} /></span>
          </section>
        )}
        <ErrorNote error={save.error ?? existing.error} />
        <button className="ot-btn ot-btn--block" type="submit" disabled={!valid || save.isPending}>
          {save.isPending ? tr('Зберігаю…') : tr('Зберегти')}
        </button>
      </form>
      {picking && <IngredientPicker onPick={add} onClose={() => setPicking(false)} />}
    </>
  );
}

function IngredientPicker({ onPick, onClose }: { onPick: (i: CatalogItem) => void; onClose: () => void }) {
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);
  const results = useQuery({ queryKey: ['search', q], queryFn: () => api.search(q), placeholderData: (p) => p });
  const products = results.data?.items.filter((i) => i.type === 'product') ?? [];
  return (
    <Sheet title={tr('Додати інгредієнт')} onClose={onClose}>
      <label className="ot-search">
        <Search className="ot-icon" />
        <input className="ot-input" type="search" autoFocus placeholder={tr('Назва продукту або штрихкод')} value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      <div className="ot-list">
        {products.map((item) => (
          <button key={item.id} className="ot-row text-left" onClick={() => onPick(item)}>
            <span className="ot-row__body">
              <span className="ot-row__title">{item.name}</span>
              <span className="ot-row__sub ot-num">{item.brand ? `${item.brand} · ` : ''}<MacroLine n={item.per100g} /></span>
            </span>
            <span className="ot-row__value">{kcal(item.per100g.kcal)}</span>
          </button>
        ))}
        {results.data && products.length === 0 && <p className="ot-text px-1">{q ? tr('Нічого не знайдено.') : tr('Почніть вводити назву.')}</p>}
      </div>
    </Sheet>
  );
}
