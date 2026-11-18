import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Plus, Target } from 'lucide-react';
import { MEALS, type DiaryEntry, type Meal } from '@foodlog/contracts';
import { api } from '../api';
import { ErrorNote, Header, MacroLine, Sheet, Skeleton, kcalText } from '../components';
import { MEAL_LABEL, dateTitle, grams, kcal, localDate, shiftDate } from '../format';
import { navigate, useLocation } from '../router';

export function TodayPage() {
  const { query } = useLocation();
  const date = query.get('date') ?? localDate();
  const setDate = (d: string) => navigate(d === localDate() ? '/' : `/?date=${d}`, { replace: true });
  const day = useQuery({ queryKey: ['day', date], queryFn: () => api.day(date) });
  const [editing, setEditing] = useState<DiaryEntry | null>(null);

  const data = day.data;
  const t = data?.targets;
  const pct = (v: number, target?: number) => (target ? Math.min(100, (v / target) * 100) : 0);

  return (
    <>
      <Header
        title={dateTitle(date)}
        right={
          <>
            <button className="ot-btn ot-btn--outline ot-btn--icon" aria-label="Попередній день" onClick={() => setDate(shiftDate(date, -1))}><ChevronLeft className="ot-icon" /></button>
            <button className="ot-btn ot-btn--outline ot-btn--icon" aria-label="Наступний день" onClick={() => setDate(shiftDate(date, 1))}><ChevronRight className="ot-icon" /></button>
          </>
        }
      />
      <div className="ot-content">
        <ErrorNote error={day.error} />
        {!data ? (
          <><Skeleton h={180} /><Skeleton /><Skeleton /></>
        ) : (
          <>
            <section className="ot-card flex-row! items-center gap-5">
              <div className="ot-ring" style={{ ['--p' as string]: pct(data.totals.kcal, t?.kcal) }}>
                <div>
                  <b>{kcal(data.totals.kcal)}</b>
                  <small>{t ? `з ${kcal(t.kcal)} ккал` : 'ккал'}</small>
                </div>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                {(['protein', 'fat', 'carbs'] as const).map((k) => (
                  <div key={k} className="flex flex-col gap-1">
                    <div className="flex justify-between ot-caption">
                      <span>{{ protein: 'Білки', fat: 'Жири', carbs: 'Вуглеводи' }[k]}</span>
                      <span className="ot-num">{grams(data.totals[k])}{t ? ` / ${t[k]}` : ''} г</span>
                    </div>
                    <div className="ot-progress"><i style={{ ['--p' as string]: `${pct(data.totals[k], t?.[k])}%` }} /></div>
                  </div>
                ))}
              </div>
            </section>
            {!t && (
              <a className="ot-row" href="/profile" onClick={(e) => { e.preventDefault(); navigate('/profile'); }}>
                <span className="ot-row__icon"><Target className="ot-icon" /></span>
                <span className="ot-row__body">
                  <span className="ot-row__title">Встановіть денну ціль</span>
                  <span className="ot-row__sub">Розрахуємо калорії та БЖУ за вашими параметрами</span>
                </span>
              </a>
            )}
            {MEALS.map((meal) => (
              <MealSection key={meal} meal={meal} date={date} entries={data.entries.filter((e) => e.meal === meal)} total={data.byMeal[meal].kcal} onEdit={setEditing} />
            ))}
          </>
        )}
      </div>
      {editing && <EditEntrySheet entry={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function MealSection({ meal, date, entries, total, onEdit }: { meal: Meal; date: string; entries: DiaryEntry[]; total: number; onEdit: (e: DiaryEntry) => void }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="ot-h3">{MEAL_LABEL[meal]}</h2>
        <span className="ot-caption ot-num">{entries.length ? kcalText(total) : ''}</span>
      </div>
      <div className="ot-list">
        {entries.map((e) => (
          <button key={e.id} className="ot-row text-left" onClick={() => onEdit(e)}>
            <span className="ot-row__body">
              <span className="ot-row__title">{e.name}</span>
              <span className="ot-row__sub ot-num">{grams(e.grams)} г · <MacroLine n={e.nutrients} /></span>
            </span>
            <span className="ot-row__value">{kcal(e.nutrients.kcal)}</span>
          </button>
        ))}
        <a className="ot-row ot-row--empty" href={`/add?meal=${meal}&date=${date}`} onClick={(ev) => { ev.preventDefault(); navigate(`/add?meal=${meal}&date=${date}`); }}>
          <span className="ot-row__body ot-row__sub">Додати до «{MEAL_LABEL[meal]}»</span>
          <span className="ot-row__value"><Plus className="ot-icon" /></span>
        </a>
      </div>
    </section>
  );
}

function EditEntrySheet({ entry, onClose }: { entry: DiaryEntry; onClose: () => void }) {
  const qc = useQueryClient();
  const [value, setValue] = useState(String(entry.grams));
  const [meal, setMeal] = useState<Meal>(entry.meal);
  const g = Number(value.replace(',', '.'));
  const valid = Number.isFinite(g) && g > 0 && g <= 5000;
  const done = async () => {
    await qc.invalidateQueries({ queryKey: ['day', entry.date] });
    onClose();
  };
  const save = useMutation({ mutationFn: () => api.updateEntry(entry.date, entry.id, { grams: g, meal }), onSuccess: done });
  const remove = useMutation({ mutationFn: () => api.deleteEntry(entry.date, entry.id), onSuccess: done });
  return (
    <Sheet title={entry.name} onClose={onClose}>
      <label className="ot-field">
        <span className="ot-label">Грами</span>
        <input className="ot-input ot-num" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
      </label>
      <div className="ot-segment self-start flex-wrap">
        {MEALS.map((m) => (
          <button key={m} type="button" aria-pressed={meal === m} onClick={() => setMeal(m)}>{MEAL_LABEL[m]}</button>
        ))}
      </div>
      <p className="ot-label ot-num">{kcalText((entry.per100g.kcal * (valid ? g : 0)) / 100)}</p>
      <ErrorNote error={save.error ?? remove.error} />
      <div className="flex gap-2">
        <button className="ot-btn ot-btn--outline flex-1" disabled={remove.isPending} onClick={() => remove.mutate()}>Видалити</button>
        <button className="ot-btn flex-1" disabled={!valid || save.isPending} onClick={() => save.mutate()}>Зберегти</button>
      </div>
    </Sheet>
  );
}
