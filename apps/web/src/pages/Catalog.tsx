import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PackagePlus, Trash2 } from 'lucide-react';
import { tr } from '../i18n';
import { api } from '../api';
import { ErrorNote, Header, MacroLine, Skeleton, kcalText } from '../components';

import { navigate } from '../router';

export function CatalogPage() {
  const qc = useQueryClient();
  const items = useQuery({ queryKey: ['myItems'], queryFn: api.myItems });
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteProduct(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['myItems'] }),
  });
  return (
    <>
      <Header title={tr('Мої продукти')} right={<button className="ot-btn ot-btn--sm" onClick={() => navigate('/products/new')}><PackagePlus className="ot-icon" />{tr('Новий')}</button>} />
      <div className="ot-content">
        <ErrorNote error={items.error ?? remove.error} />
        <div className="ot-list">
          {items.isLoading && <><Skeleton /><Skeleton /></>}
          {items.data?.products.map((p) => (
            <div key={p.id} className="ot-row">
              <span className="ot-row__body">
                <span className="ot-row__title">{p.name}</span>
                <span className="ot-row__sub ot-num">{kcalText(p.per100g.kcal)} · <MacroLine n={p.per100g} /> {tr('на 100 г')}</span>
              </span>
              <button className="ot-btn ot-btn--ghost ot-btn--icon" aria-label={tr('Видалити {name}', { name: p.name })} disabled={remove.isPending} onClick={() => confirm(tr('Видалити «{name}»? Записи в щоденнику залишаться.', { name: p.name })) && remove.mutate(p.id)}>
                <Trash2 className="ot-icon" />
              </button>
            </div>
          ))}
          {items.data?.products.length === 0 && (
            <p className="ot-text px-1">{tr('Тут будуть продукти, які ви створите самі. Решту шукайте через «+» — каталог Open Food Facts.')}</p>
          )}
        </div>
        <p className="ot-caption px-1">{tr('Дані про продукти: Open Food Facts (ODbL).')}</p>
      </div>
    </>
  );
}
