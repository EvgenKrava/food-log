import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, EyeOff, X } from 'lucide-react';
import type { Dish, ModerationQueueItem, Product } from '@foodlog/contracts';
import { api, type CatalogKind } from '../api';
import { ErrorNote, Header, MacroLine, Skeleton, kcalText } from '../components';
import { grams } from '../format';
import { tr } from '../i18n';
import { navigate, useLocation } from '../router';

type Action = { kind: CatalogKind; id: string; action: 'approve' | 'reject' | 'hide'; reason?: string };

function Facts({ item }: { item: Product | Dish }) {
  return (
    <span className="ot-row__sub ot-num">
      {kcalText(item.per100g.kcal)} · <MacroLine n={item.per100g} /> {tr('на 100 г')}
      {'weightG' in item && <> · {grams(item.weightG)} {tr('г')}</>}
    </span>
  );
}

/** Moderation for foodlog-admin: the queue of items people shared, and the public catalog. */
export function AdminPage() {
  const qc = useQueryClient();
  const { query } = useLocation();
  const tab = query.get('tab') === 'published' ? 'published' : 'queue';
  const queue = useQuery({ queryKey: ['admin', 'queue'], queryFn: api.adminQueue, enabled: tab === 'queue' });
  const published = useQuery({ queryKey: ['admin', 'published'], queryFn: api.adminPublished, enabled: tab === 'published' });
  const act = useMutation({
    mutationFn: (a: Action) => api.moderate(a.kind, a.id, a.action, a.reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin'] }),
  });
  const reject = (kind: CatalogKind, id: string) => {
    const reason = prompt(tr('Причина відхилення (її побачить автор):'))?.trim();
    if (reason && reason.length >= 3) act.mutate({ kind, id, action: 'reject', reason });
  };

  const queueRow = (q: ModerationQueueItem) => {
    const kind: CatalogKind = q.type === 'product' ? 'products' : 'dishes';
    const item = q.type === 'product' ? q.product : q.dish;
    return (
      <div key={item.id} className="ot-card">
        <span className="flex flex-col">
          <span className="ot-row__title">
            {q.type === 'dish' ? `🍲 ${item.name}` : item.name}
            {q.type === 'product' && q.product.brand ? ` · ${q.product.brand}` : ''}
          </span>
          <Facts item={item} />
          {q.type === 'product' && q.product.barcode && <span className="ot-hint ot-num">{q.product.barcode}</span>}
          {q.type === 'dish' && (
            <span className="ot-hint">{q.dish.ingredients.map((i) => `${i.name} ${grams(i.grams)} ${tr('г')}`).join(', ')}</span>
          )}
        </span>
        {q.kcalMismatch && <p className="ot-chip ot-chip--warn self-start">{tr('Калорійність не сходиться з БЖУ')}</p>}
        {q.type === 'product' && q.duplicate && (
          <p className="ot-chip ot-chip--warn self-start">{tr('Вже є опублікований продукт з цим штрихкодом: {name}', { name: q.duplicate.name })}</p>
        )}
        <div className="flex gap-2">
          <button className="ot-btn ot-btn--sm" disabled={act.isPending} onClick={() => act.mutate({ kind, id: item.id, action: 'approve' })}>
            <Check className="ot-icon" />{tr('Схвалити')}
          </button>
          <button className="ot-btn ot-btn--outline ot-btn--sm" disabled={act.isPending} onClick={() => reject(kind, item.id)}>
            <X className="ot-icon" />{tr('Відхилити')}
          </button>
        </div>
      </div>
    );
  };

  const publishedRow = (kind: CatalogKind, item: Product | Dish) => (
    <div key={item.id} className="ot-row">
      <span className="ot-row__body">
        <span className="ot-row__title">{item.name}</span>
        <Facts item={item} />
      </span>
      <button
        className="ot-btn ot-btn--ghost ot-btn--sm"
        disabled={act.isPending}
        onClick={() => confirm(tr('Приховати «{name}» з пошуку для всіх?', { name: item.name })) && act.mutate({ kind, id: item.id, action: 'hide' })}
      >
        <EyeOff className="ot-icon" />{tr('Приховати')}
      </button>
    </div>
  );

  const loading = tab === 'queue' ? queue.isLoading : published.isLoading;
  return (
    <>
      <Header
        title={tr('Модерація')}
        left={<button className="ot-btn ot-btn--ghost ot-btn--icon" aria-label={tr('Назад')} onClick={() => navigate('/profile')}><ArrowLeft className="ot-icon" /></button>}
      />
      <div className="ot-content">
        <div className="ot-segment self-start">
          <button aria-pressed={tab === 'queue'} onClick={() => navigate('/admin', { replace: true })}>{tr('Черга')}</button>
          <button aria-pressed={tab === 'published'} onClick={() => navigate('/admin?tab=published', { replace: true })}>{tr('Опубліковані')}</button>
        </div>
        <ErrorNote error={queue.error ?? published.error ?? act.error} />
        {loading && <><Skeleton /><Skeleton /></>}
        {tab === 'queue' && queue.data?.items.map(queueRow)}
        {tab === 'queue' && queue.data?.items.length === 0 && <p className="ot-text px-1">{tr('Черга порожня.')}</p>}
        {tab === 'published' && published.data && (
          <div className="ot-list">
            {published.data.products.map((p) => publishedRow('products', p))}
            {published.data.dishes.map((d) => publishedRow('dishes', d))}
            {published.data.products.length + published.data.dishes.length === 0 && (
              <p className="ot-text px-1">{tr('Поки нічого не опубліковано.')}</p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
