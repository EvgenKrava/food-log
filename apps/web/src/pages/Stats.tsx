import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tr, activeLocale, intlTag } from '../i18n';
import { api } from '../api';
import { ErrorNote, Header, Skeleton, kcalText } from '../components';
import { grams, kcal, localDate, shiftDate } from '../format';

export function StatsPage() {
  const qc = useQueryClient();
  const [range, setRange] = useState<7 | 30>(7);
  const to = localDate();
  const from = shiftDate(to, -(range - 1));
  const stats = useQuery({ queryKey: ['stats', from, to], queryFn: () => api.stats(from, to) });
  const weights = useQuery({ queryKey: ['weights', range], queryFn: () => api.weights(shiftDate(to, -89), to) });
  const [kg, setKg] = useState('');
  const addWeight = useMutation({
    mutationFn: () => api.putWeight(to, Number(kg.replace(',', '.'))),
    onSuccess: () => {
      setKg('');
      void qc.invalidateQueries({ queryKey: ['weights'] });
      void qc.invalidateQueries({ queryKey: ['profile'] });
      void qc.invalidateQueries({ queryKey: ['day'] });
    },
  });

  const days = Array.from({ length: range }, (_, i) => shiftDate(from, i));
  const byDate = new Map(stats.data?.days.map((d) => [d.date, d.totals]) ?? []);
  const target = stats.data?.targets?.kcal;
  const logged = stats.data?.days ?? [];
  const max = Math.max(target ?? 0, ...logged.map((d) => d.totals.kcal), 1);
  const avg = (k: 'kcal' | 'protein' | 'fat' | 'carbs') => (logged.length ? logged.reduce((s, d) => s + d.totals[k], 0) / logged.length : 0);

  return (
    <>
      <Header title={tr('Статистика')} right={
        <div className="ot-segment">
          <button aria-pressed={range === 7} onClick={() => setRange(7)}>{tr('Тиждень')}</button>
          <button aria-pressed={range === 30} onClick={() => setRange(30)}>{tr('Місяць')}</button>
        </div>
      } />
      <div className="ot-content">
        <ErrorNote error={stats.error} />
        {!stats.data ? <Skeleton h={220} /> : (
          <section className="ot-card">
            <div className="flex items-baseline justify-between">
              <div className="ot-stat">
                <span className="ot-stat__value">{kcal(avg('kcal'))}</span>
                <span className="ot-stat__unit">{tr('ккал у середньому за день')}{target ? ` · ${tr('ціль')} ${kcal(target)}` : ''}</span>
              </div>
            </div>
            <div className="ot-bars" style={{ gap: range === 30 ? 3 : 8 }}>
              {days.map((d) => {
                const v = byDate.get(d)?.kcal ?? 0;
                return <i key={d} className={d === to ? 'is-today' : ''} style={{ ['--h' as string]: `${(v / max) * 100}%` }} title={`${d}: ${kcalText(v)}`} />;
              })}
            </div>
            <p className="ot-caption ot-num">
              {tr('Б')} {grams(avg('protein'))} · {tr('Ж')} {grams(avg('fat'))} · {tr('В')} {grams(avg('carbs'))} {tr('г у середньому')} · {tr('днів із записами')}: {logged.length}
            </p>
          </section>
        )}
        <section className="ot-card">
          <h2 className="ot-h3">{tr('Вага')}</h2>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); addWeight.mutate(); }}>
            <input className="ot-input ot-num" inputMode="decimal" placeholder={tr('Вага сьогодні, кг')} value={kg} onChange={(e) => setKg(e.target.value)} />
            <button className="ot-btn" disabled={!kg || addWeight.isPending}>{tr('Зберегти')}</button>
          </form>
          <ErrorNote error={addWeight.error} />
          <div className="ot-list">
            {weights.data?.entries.toReversed().slice(0, 10).map((w) => (
              <div key={w.date} className="ot-row">
                <span className="ot-row__body ot-row__sub">{new Date(`${w.date}T12:00:00`).toLocaleDateString(intlTag(activeLocale()), { day: 'numeric', month: 'long' })}</span>
                <span className="ot-row__value">{grams(w.kg)} {tr('кг')}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
