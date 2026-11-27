import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CookingPot, PackagePlus, Trash2 } from 'lucide-react';
import type { ModerationStatus } from '@foodlog/contracts';
import { api, type CatalogKind } from '../api';
import { ErrorNote, Header, MacroLine, Skeleton, StatusChip, kcalText } from '../components';
import { grams } from '../format';
import { tr } from '../i18n';
import { navigate, useLocation } from '../router';
import { PhotoThumb } from '../ItemPhoto';

export function CatalogPage() {
  const qc = useQueryClient();
  const { query } = useLocation();
  const tab = query.get('tab') === 'dishes' ? 'dishes' : 'products';
  const items = useQuery({ queryKey: ['myItems'], queryFn: api.myItems });
  const done = () => qc.invalidateQueries({ queryKey: ['myItems'] });
  const removeProduct = useMutation({ mutationFn: (id: string) => api.deleteProduct(id), onSuccess: done });
  const removeDish = useMutation({ mutationFn: (id: string) => api.deleteDish(id), onSuccess: done });
  const publish = useMutation({
    mutationFn: (v: { kind: CatalogKind; id: string; on: boolean }) => api.setPublished(v.kind, v.id, v.on),
    onSuccess: done,
  });
  // What the author can do from each status (see the moderation rules in @foodlog/domain).
  const shareAction = (kind: CatalogKind, item: { id: string; status: ModerationStatus; rejectReason?: string }) => (
    <span className="flex flex-wrap items-center gap-2">
      <StatusChip status={item.status} />
      {(item.status === 'private' || item.status === 'rejected') && (
        <button type="button" className="ot-btn ot-btn--soft ot-btn--sm" disabled={publish.isPending} onClick={() => publish.mutate({ kind, id: item.id, on: true })}>
          {item.status === 'rejected' ? tr('Надіслати знову') : tr('Поділитися')}
        </button>
      )}
      {item.status === 'pending' && (
        <button type="button" className="ot-btn ot-btn--ghost ot-btn--sm" disabled={publish.isPending} onClick={() => publish.mutate({ kind, id: item.id, on: false })}>
          {tr('Скасувати')}
        </button>
      )}
      {item.status === 'rejected' && item.rejectReason && <span className="ot-hint">{item.rejectReason}</span>}
    </span>
  );
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
        <ErrorNote error={items.error ?? removeProduct.error ?? removeDish.error ?? publish.error} />
        <div className="ot-list">
          {items.isLoading && <><Skeleton /><Skeleton /></>}
          {tab === 'products' &&
            items.data?.products.map((p) => (
              <div key={p.id} className="ot-row">
                {p.photoUrl && <PhotoThumb url={p.photoUrl} alt={p.name} />}
                <span className="ot-row__body">
                  <span className="ot-row__title">{p.name}</span>
                  <span className="ot-row__sub ot-num">{kcalText(p.per100g.kcal)} · <MacroLine n={p.per100g} /> {tr('на 100 г')}</span>
                  {shareAction('products', p)}
                </span>
                <button className="ot-btn ot-btn--ghost ot-btn--icon" aria-label={tr('Видалити {name}', { name: p.name })} disabled={removeProduct.isPending || p.status === 'approved'} onClick={() => confirmDelete(p.name) && removeProduct.mutate(p.id)}>
                  <Trash2 className="ot-icon" />
                </button>
              </div>
            ))}
          {tab === 'dishes' &&
            items.data?.dishes.map((d) => (
              <div key={d.id} className="ot-row">
                {d.photoUrl && <PhotoThumb url={d.photoUrl} alt={d.name} />}
                <span className="ot-row__body">
                  <a className="flex flex-col" href={`/dishes/${d.id}`} onClick={(e) => { e.preventDefault(); navigate(`/dishes/${d.id}`); }}>
                    <span className="ot-row__title">{d.name}</span>
                    <span className="ot-row__sub ot-num">{kcalText(d.per100g.kcal)} {tr('на 100 г')} · {grams(d.weightG)} {tr('г')}</span>
                  </a>
                  {shareAction('dishes', d)}
                </span>
                <button className="ot-btn ot-btn--ghost ot-btn--icon" aria-label={tr('Видалити {name}', { name: d.name })} disabled={removeDish.isPending || d.status === 'approved'} onClick={() => confirmDelete(d.name) && removeDish.mutate(d.id)}>
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
