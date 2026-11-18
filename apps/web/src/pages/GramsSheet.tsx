import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MEALS, type Meal, type Nutrients } from '@foodlog/contracts';
import { defaultMealForHour, scaleNutrients } from '@foodlog/domain';
import { tr } from '../i18n';
import { api } from '../api';
import { ErrorNote, MacroLine, Sheet, kcalText } from '../components';
import { mealLabel } from '../format';

export type Pickable = { type?: 'product' | 'dish'; id: string; name: string; brand?: string; per100g: Nutrients; servingSizeG?: number };

export function GramsSheet({
  item,
  date,
  meal: initialMeal,
  onClose,
  onAdded,
}: {
  item: Pickable;
  date: string;
  meal?: Meal | null;
  onClose: () => void;
  onAdded: () => void;
}) {
  const qc = useQueryClient();
  const [meal, setMeal] = useState<Meal>(initialMeal ?? defaultMealForHour(new Date().getHours()));
  const [value, setValue] = useState(String(item.servingSizeG ?? 100));
  const g = Number(value.replace(',', '.'));
  const valid = Number.isFinite(g) && g > 0 && g <= 5000;
  const add = useMutation({
    mutationFn: () => api.addEntry(date, { meal, item: item.type === 'dish' ? { type: 'dish', id: item.id } : { type: 'product', id: item.id }, grams: g }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['day', date] });
      void qc.invalidateQueries({ queryKey: ['search', ''] });
      onAdded();
    },
  });
  const chips = [...new Set([...(item.servingSizeG ? [item.servingSizeG] : []), 50, 100, 150, 200])];
  const n = scaleNutrients(item.per100g, valid ? g : 0);
  return (
    <Sheet title={item.brand ? `${item.name} · ${item.brand}` : item.name} onClose={onClose}>
      <p className="ot-caption">{tr('На 100 г')}: {kcalText(item.per100g.kcal)} · <MacroLine n={item.per100g} /></p>
      <label className="ot-field">
        <span className="ot-label">{tr('Скільки грамів')}</span>
        <input className="ot-input ot-num" inputMode="decimal" autoFocus value={value} onChange={(e) => setValue(e.target.value)} />
      </label>
      <div className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <button key={c} type="button" className="ot-btn ot-btn--soft ot-btn--sm" onClick={() => setValue(String(c))}>
            {c} {tr('г')}{c === item.servingSizeG ? ` ${tr('(порція)')}` : ''}
          </button>
        ))}
      </div>
      <div className="ot-segment self-start flex-wrap">
        {MEALS.map((m) => (
          <button key={m} type="button" aria-pressed={meal === m} onClick={() => setMeal(m)}>{mealLabel(m)}</button>
        ))}
      </div>
      <div className="ot-card ot-card--accent">
        <span className="ot-h2 ot-num">{kcalText(n.kcal)}</span>
        <span className="ot-label ot-num"><MacroLine n={n} /></span>
      </div>
      <ErrorNote error={add.error} />
      <button className="ot-btn ot-btn--block" disabled={!valid || add.isPending} onClick={() => add.mutate()}>
        {add.isPending ? tr('Додаю…') : tr('Додати в «{meal}»', { meal: mealLabel(meal) })}
      </button>
    </Sheet>
  );
}
