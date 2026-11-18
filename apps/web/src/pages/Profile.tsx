import { useEffect, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LogOut, ShieldCheck } from 'lucide-react';
import { navigate } from '../router';
import { PutProfileRequestSchema, type Activity, type Goal, type Sex } from '@foodlog/contracts';
import { LOCALES, LOCALE_NAMES, tr, useI18n, type Locale } from '../i18n';
import { api } from '../api';
import { logoutUrl } from '../auth';
import { ErrorNote, Header, Skeleton, kcalText } from '../components';
import { config } from '../config';
import { localDate } from '../format';

const ACTIVITY: Record<Activity, string> = {
  sedentary: 'Сидячий спосіб життя',
  light: 'Легка активність (1–3 тренування)',
  moderate: 'Середня (3–5 тренувань)',
  active: 'Висока (6–7 тренувань)',
  very_active: 'Дуже висока (фізична робота)',
};
const GOAL: Record<Goal, string> = { lose: 'Схуднути', maintain: 'Тримати вагу', gain: 'Набрати масу' };

export function ProfilePage({ email, isAdmin }: { email: string; isAdmin: boolean }) {
  const auth = useAuth();
  const { locale, setLocale } = useI18n();
  const qc = useQueryClient();
  const data = useQuery({ queryKey: ['profile'], queryFn: api.profile });
  const [f, setF] = useState({
    sex: 'male' as Sex,
    birthYear: '',
    heightCm: '',
    weightKg: '',
    activity: 'light' as Activity,
    goal: 'maintain' as Goal,
    manual: false,
    kcal: '',
    protein: '',
    fat: '',
    carbs: '',
  });

  useEffect(() => {
    const p = data.data?.profile;
    if (!data.data) return;
    setF((cur) => ({
      ...cur,
      ...(p
        ? {
            sex: p.sex,
            birthYear: String(p.birthYear),
            heightCm: String(p.heightCm),
            activity: p.activity,
            goal: p.goal,
            manual: p.targetsManual,
            kcal: String(p.targets.kcal),
            protein: String(p.targets.protein),
            fat: String(p.targets.fat),
            carbs: String(p.targets.carbs),
          }
        : {}),
      weightKg: data.data?.currentWeightKg ? String(data.data.currentWeightKg) : cur.weightKg,
    }));
  }, [data.data]);

  const n = (s: string) => Number(s.replace(',', '.'));
  const request = {
    sex: f.sex,
    birthYear: n(f.birthYear),
    heightCm: n(f.heightCm),
    activity: f.activity,
    goal: f.goal,
    locale,
    targetsManual: f.manual,
    ...(f.manual ? { targets: { kcal: n(f.kcal), protein: n(f.protein), fat: n(f.fat), carbs: n(f.carbs) } } : {}),
  };
  const parsed = PutProfileRequestSchema.safeParse(request);
  const weightOk = f.manual || (n(f.weightKg) >= 20 && n(f.weightKg) <= 400);

  const save = useMutation({
    mutationFn: async () => {
      if (f.weightKg && n(f.weightKg) !== data.data?.currentWeightKg) await api.putWeight(localDate(), n(f.weightKg));
      if (!parsed.success) throw new Error(tr('Перевірте поля'));
      await api.putProfile(parsed.data);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['profile'] });
      void qc.invalidateQueries({ queryKey: ['day'] });
      void qc.invalidateQueries({ queryKey: ['stats'] });
    },
  });
  const wipe = useMutation({
    mutationFn: api.deleteMyData,
    onSuccess: () => qc.invalidateQueries(),
  });

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const input = (k: keyof typeof f, label: string) => (
    <label className="ot-field">
      <span className="ot-label">{label}</span>
      <input className="ot-input ot-num" inputMode="decimal" value={String(f[k])} onChange={set(k)} />
    </label>
  );
  const targets = data.data?.profile?.targets;

  return (
    <>
      <Header title={tr('Профіль')} />
      <div className="ot-content">
        {!data.data ? <Skeleton h={300} /> : (
          <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
            {targets && (
              <section className="ot-card ot-card--accent">
                <span className="ot-label">{tr('Денна ціль')}</span>
                <span className="ot-h2 ot-num">{kcalText(targets.kcal)}</span>
                <span className="ot-label ot-num">{tr('Б')} {targets.protein} · {tr('Ж')} {targets.fat} · {tr('В')} {targets.carbs} {tr('г')}</span>
              </section>
            )}
            <section className="ot-card">
              <h2 className="ot-h3">{tr('Параметри')}</h2>
              <div className="ot-segment self-start">
                <button type="button" aria-pressed={f.sex === 'male'} onClick={() => setF({ ...f, sex: 'male' })}>{tr('Чоловік')}</button>
                <button type="button" aria-pressed={f.sex === 'female'} onClick={() => setF({ ...f, sex: 'female' })}>{tr('Жінка')}</button>
              </div>
              <div className="grid grid-cols-3 items-end gap-3">
                {input('birthYear', tr('Рік народження'))}
                {input('heightCm', tr('Зріст, см'))}
                {input('weightKg', tr('Вага, кг'))}
              </div>
              <label className="ot-field">
                <span className="ot-label">{tr('Активність')}</span>
                <select className="ot-select" value={f.activity} onChange={set('activity')}>
                  {Object.entries(ACTIVITY).map(([k, v]) => <option key={k} value={k}>{tr(v)}</option>)}
                </select>
              </label>
              <label className="ot-field">
                <span className="ot-label">{tr('Мета')}</span>
                <select className="ot-select" value={f.goal} onChange={set('goal')}>
                  {Object.entries(GOAL).map(([k, v]) => <option key={k} value={k}>{tr(v)}</option>)}
                </select>
              </label>
              <label className="flex items-center justify-between gap-3">
                <span className="ot-label">{tr('Задати ціль вручну')}</span>
                <input type="checkbox" className="ot-switch" checked={f.manual} onChange={(e) => setF({ ...f, manual: e.target.checked })} />
              </label>
              {f.manual && (
                <div className="grid grid-cols-2 gap-3">
                  {input('kcal', tr('Ккал'))}
                  {input('protein', tr('Білки, г'))}
                  {input('fat', tr('Жири, г'))}
                  {input('carbs', tr('Вуглеводи, г'))}
                </div>
              )}
              {!f.manual && <p className="ot-hint">{tr('Ціль рахуємо за формулою Міффліна–Сан Жеора і оновлюємо, коли ви записуєте нову вагу.')}</p>}
              <ErrorNote error={save.error} />
              <button className="ot-btn ot-btn--block" disabled={!parsed.success || !weightOk || save.isPending}>
                {save.isPending ? tr('Зберігаю…') : save.isSuccess ? tr('Збережено') : tr('Зберегти')}
              </button>
            </section>
          </form>
        )}
        <section className="ot-card">
          <h2 className="ot-h3">{tr('Акаунт')}</h2>
          <label className="ot-field">
            <span className="ot-label">{tr('Мова')}</span>
            <select className="ot-select" value={locale} onChange={(e) => setLocale(e.target.value as Locale)}>
              {LOCALES.map((l) => <option key={l} value={l}>{LOCALE_NAMES[l]}</option>)}
            </select>
          </label>
          <p className="ot-text">{email}</p>
          {isAdmin && (
            <a className="ot-btn ot-btn--outline" href="/admin" onClick={(e) => { e.preventDefault(); navigate('/admin'); }}>
              <ShieldCheck className="ot-icon" />{tr('Модерація каталогу')}
            </a>
          )}
          <a className="ot-btn ot-btn--outline" href={config.hubUrl}>{tr('Інші інструменти Only Tools')}</a>
          <button className="ot-btn ot-btn--outline" onClick={() => { void auth.removeUser(); window.location.assign(logoutUrl()); }}>
            <LogOut className="ot-icon" />{tr('Вийти')}
          </button>
          <ErrorNote error={wipe.error} />
          <button className="ot-btn ot-btn--ghost" disabled={wipe.isPending} onClick={() => confirm(tr('Видалити весь щоденник, вагу, профіль і ваші продукти у FoodLog? Акаунт Only Tools залишиться.')) && wipe.mutate()}>
            {tr('Видалити мої дані FoodLog')}
          </button>
        </section>
      </div>
    </>
  );
}
