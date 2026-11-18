import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, PackagePlus, ScanBarcode, Search, Star } from 'lucide-react';
import { MealSchema } from '@foodlog/contracts';
import { ApiError, api } from '../api';
import { ErrorNote, Header, MacroLine, Skeleton } from '../components';
import { kcal, localDate } from '../format';
import { navigate, useLocation } from '../router';
import { GramsSheet, type Pickable } from './GramsSheet';

const Scanner = lazy(() => import('./Scanner').then((m) => ({ default: m.Scanner })));

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

export function AddPage() {
  const { query } = useLocation();
  const date = query.get('date') ?? localDate();
  const meal = MealSchema.safeParse(query.get('meal')).data ?? null;
  const [text, setText] = useState(query.get('q') ?? '');
  const q = useDebounced(text.trim(), 300);
  const results = useQuery({ queryKey: ['search', q], queryFn: () => api.search(q), placeholderData: (prev) => prev });
  const [picked, setPicked] = useState<Pickable | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<unknown>(null);
  const onCode = useCallback(
    (code: string) => {
      setScanning(false);
      setScanError(null);
      api.barcode(code).then(setPicked, (e: unknown) => {
        if (e instanceof ApiError && e.status === 404) {
          navigate(`/products/new?date=${date}${meal ? `&meal=${meal}` : ''}&barcode=${code}`);
        } else if (e instanceof ApiError && e.code === 'VALIDATION') setScanError(new Error(`Штрихкод ${code} не схожий на товарний. Спробуйте ще раз.`));
        else setScanError(e);
      });
    },
    [date, meal],
  );
  const back = () => navigate(date === localDate() ? '/' : `/?date=${date}`);
  const newProduct = `/products/new?date=${date}${meal ? `&meal=${meal}` : ''}${/^\d{8,14}$/.test(q) ? `&barcode=${q}` : `&name=${encodeURIComponent(q)}`}`;

  return (
    <>
      <Header title="Додати їжу" left={<button className="ot-btn ot-btn--ghost ot-btn--icon" aria-label="Назад" onClick={back}><ArrowLeft className="ot-icon" /></button>} />
      <div className="ot-content">
        <div className="flex gap-2">
          <label className="ot-search flex-1">
            <Search className="ot-icon" />
            <input className="ot-input" type="search" autoFocus placeholder="Назва продукту або штрихкод" value={text} onChange={(e) => setText(e.target.value)} />
          </label>
          <button className="ot-btn ot-btn--soft ot-btn--icon" style={{ minHeight: 48, width: 48 }} aria-label="Сканувати штрихкод" onClick={() => setScanning(true)}>
            <ScanBarcode className="ot-icon" />
          </button>
        </div>
        <ErrorNote error={results.error ?? scanError} />
        {!q && <p className="ot-caption px-1">Нещодавні</p>}
        <div className="ot-list">
          {results.isLoading && <><Skeleton /><Skeleton /><Skeleton /></>}
          {results.data?.items.map((item) => (
            <button key={item.id} className="ot-row text-left" onClick={() => setPicked(item)}>
              <span className="ot-row__body">
                <span className="ot-row__title">{item.name}</span>
                <span className="ot-row__sub ot-num">
                  {item.brand ? `${item.brand} · ` : ''}<MacroLine n={item.per100g} />
                </span>
              </span>
              {item.isOwn && <Star className="ot-icon text-[var(--ot-accent)]" aria-label="Мій продукт" />}
              <span className="ot-row__value">{kcal(item.per100g.kcal)}<span className="ot-caption"> /100г</span></span>
            </button>
          ))}
          {results.data && results.data.items.length === 0 && (
            <p className="ot-text px-1">{q ? 'Нічого не знайдено.' : 'Тут з’являться продукти, які ви нещодавно додавали.'}</p>
          )}
          <a className="ot-row ot-row--empty" href={newProduct} onClick={(e) => { e.preventDefault(); navigate(newProduct); }}>
            <span className="ot-row__icon"><PackagePlus className="ot-icon" /></span>
            <span className="ot-row__body">
              <span className="ot-row__title">Створити свій продукт</span>
              <span className="ot-row__sub">Введіть калорії та БЖУ з етикетки</span>
            </span>
          </a>
        </div>
        <p className="ot-caption px-1">Дані про продукти: Open Food Facts (ODbL).</p>
      </div>
      {scanning && (
        <Suspense fallback={null}>
          <Scanner onCode={onCode} onClose={() => setScanning(false)} />
        </Suspense>
      )}
      {picked && <GramsSheet item={picked} date={date} meal={meal} onClose={() => setPicked(null)} onAdded={back} />}
    </>
  );
}
