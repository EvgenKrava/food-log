import { tr } from './i18n';
import { useEffect, type ReactNode } from 'react';
import type { Nutrients } from '@foodlog/contracts';
import { grams, kcal } from './format';

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fl-sheet-backdrop" onClick={onClose}>
      <div className="fl-sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h2 className="ot-h3">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function Header({ title, left, right }: { title: ReactNode; left?: ReactNode; right?: ReactNode }) {
  return (
    <header className="ot-header">
      <div className="flex min-w-0 items-center gap-2">
        {left}
        <h1 className="ot-h2 truncate">{title}</h1>
      </div>
      <div className="flex items-center gap-2">{right}</div>
    </header>
  );
}

export function MacroLine({ n }: { n: Nutrients }) {
  return (
    <>
      {tr('Б')} {grams(n.protein)} · {tr('Ж')} {grams(n.fat)} · {tr('В')} {grams(n.carbs)}
    </>
  );
}

export const kcalText = (n: number) => `${kcal(n)} ${tr('ккал')}`;

export function Skeleton({ h = 56 }: { h?: number }) {
  return <div className="fl-skeleton" style={{ height: h }} />;
}

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null;
  const message = error instanceof Error ? error.message : tr('Щось пішло не так');
  return <p className="ot-chip ot-chip--bad self-start">{message}</p>;
}
