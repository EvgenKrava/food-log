import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PackagePlus, Trash2 } from 'lucide-react';
import { api } from '../api';
import { ErrorNote, Header, MacroLine, Skeleton } from '../components';
import { kcal } from '../format';
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
      <Header title="Мої продукти" right={<button className="ot-btn ot-btn--sm" onClick={() => navigate('/products/new')}><PackagePlus className="ot-icon" />Новий</button>} />
      <div className="ot-content">
        <ErrorNote error={items.error ?? remove.error} />
        <div className="ot-list">
          {items.isLoading && <><Skeleton /><Skeleton /></>}
          {items.data?.products.map((p) => (
            <div key={p.id} className="ot-row">
              <span className="ot-row__body">
                <span className="ot-row__title">{p.name}</span>
                <span className="ot-row__sub ot-num">{kcal(p.per100g.kcal)} ккал · <MacroLine n={p.per100g} /> на 100 г</span>
              </span>
              <button className="ot-btn ot-btn--ghost ot-btn--icon" aria-label={`Видалити ${p.name}`} disabled={remove.isPending} onClick={() => confirm(`Видалити «${p.name}»? Записи в щоденнику залишаться.`) && remove.mutate(p.id)}>
                <Trash2 className="ot-icon" />
              </button>
            </div>
          ))}
          {items.data?.products.length === 0 && (
            <p className="ot-text px-1">Тут будуть продукти, які ви створите самі. Решту шукайте через «+» — каталог Open Food Facts.</p>
          )}
        </div>
        <p className="ot-caption px-1">Дані про продукти: Open Food Facts (ODbL).</p>
      </div>
    </>
  );
}
