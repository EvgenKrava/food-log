import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CookingPot, PackagePlus, Trash2 } from 'lucide-react';
import { api } from '../api';
import { ErrorNote, Header, MacroLine, Skeleton, kcalText } from '../components';
import { grams } from '../format';
import { tr } from '../i18n';
import { navigate, useLocation } from '../router';

export function CatalogPage() {
  const qc = useQueryClient();
  const { query } = useLocation();
  const tab = query.get('tab') === 'dishes' ? 'dishes' : 'products';
  const items = useQuery({ queryKey: ['myItems'], queryFn: api.myItems });
  const done = () => qc.invalidateQueries({ queryKey: ['myItems'] });
  const removeProduct = useMutation({ mutationFn: (id: string) => api.deleteProduct(id), onSuccess: done });
  const removeDish = useMutation({ mutationFn: (id: string) => api.deleteDish(id), onSuccess: done });
  const confirmDelete = (name: string) => confirm(tr('Видалити «{name}»? Записи в щоденнику залишаться.', { name }));
  const newHref = tab === 'dishes' ? '/dishes/new' : '/products/new';

  return (
    <>
      <Header
        title={tr('Каталог')}
        right={
          <button className="ot-btn ot-btn--sm" onClick={() => navigate(newHref)}>
            {tab === 'dishes' ? <CookingPot className="ot-icon" /> : <PackagePlus className="ot-icon" />}
            {tr('Новий')}
          </button>
        }
      />
      <div className="ot-content">
        <div className="ot-segment self-start">
          <button aria-pressed={tab === 'products'} onClick={() => navigate('/catalog', { replace: true })}>{tr('Мої продукти')}</button>
          <button aria-pressed={tab === 'dishes'} onClick={() => navigate('/catalog?tab=dishes', { replace: true })}>{tr('Мої страви')}</button>
        </div>
        <ErrorNote error={items.error ?? removeProduct.error ?? removeDish.error} />
        <div className="ot-list">
          {items.isLoading && <><Skeleton /><Skeleton /></>}
          {tab === 'products' &&
            items.data?.products.map((p) => (
              <div key={p.id} className="ot-row">
                <span className="ot-row__body">
                  <span className="ot-row__title">{p.name}</span>
                  <span className="ot-row__sub ot-num">{kcalText(p.per100g.kcal)} · <MacroLine n={p.per100g} /> {tr('на 100 г')}</span>
                </span>
                <button className="ot-btn ot-btn--ghost ot-btn--icon" aria-label={tr('Видалити {name}', { name: p.name })} disabled={removeProduct.isPending} onClick={() => confirmDelete(p.name) && removeProduct.mutate(p.id)}>
                  <Trash2 className="ot-icon" />
                </button>
              </div>
            ))}
          {tab === 'dishes' &&
            items.data?.dishes.map((d) => (
              <div key={d.id} className="ot-row">
                <a className="ot-row__body" href={`/dishes/${d.id}`} onClick={(e) => { e.preventDefault(); navigate(`/dishes/${d.id}`); }}>
                  <span className="ot-row__title">{d.name}</span>
                  <span className="ot-row__sub ot-num">{kcalText(d.per100g.kcal)} {tr('на 100 г')} · {grams(d.weightG)} {tr('г')}</span>
                </a>
                <button className="ot-btn ot-btn--ghost ot-btn--icon" aria-label={tr('Видалити {name}', { name: d.name })} disabled={removeDish.isPending} onClick={() => confirmDelete(d.name) && removeDish.mutate(d.id)}>
                  <Trash2 className="ot-icon" />
                </button>
              </div>
            ))}
          {tab === 'products' && items.data?.products.length === 0 && (
            <p className="ot-text px-1">{tr('Тут будуть продукти, які ви створите самі. Решту шукайте через «+» — каталог Open Food Facts.')}</p>
          )}
          {tab === 'dishes' && items.data?.dishes.length === 0 && (
            <p className="ot-text px-1">{tr('Зберіть страву з продуктів, і калорії на 100 г порахуються самі.')}</p>
          )}
        </div>
        <p className="ot-caption px-1">{tr('Дані про продукти: Open Food Facts (ODbL).')}</p>
      </div>
    </>
  );
}
