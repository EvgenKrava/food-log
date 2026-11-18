import { tr } from './i18n';
import { useEffect, type ReactNode } from 'react';
import type { ModerationStatus, Nutrients } from '@foodlog/contracts';
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

const STATUS_CHIP: Record<ModerationStatus, string> = {
  private: 'ot-chip--neutral',
  pending: 'ot-chip--warn',
  approved: 'ot-chip--good',
  rejected: 'ot-chip--bad',
  hidden: 'ot-chip--neutral',
};

export function statusLabel(status: ModerationStatus): string {
  return {
    private: tr('Лише для вас'),
    pending: tr('На перевірці'),
    approved: tr('Доступно всім'),
    rejected: tr('Відхилено'),
    hidden: tr('Приховано модератором'),
  }[status];
}

export function StatusChip({ status }: { status: ModerationStatus }) {
  return <span className={`ot-chip ${STATUS_CHIP[status]}`}>{statusLabel(status)}</span>;
}

/** Opt-in to the shared catalog: the item goes to moderation first. */
export function ShareSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="flex flex-col">
        <span className="ot-label">{tr('Поділитися з усіма')}</span>
        <span className="ot-hint">{tr('Після перевірки модератором інші зможуть знайти це в пошуку.')}</span>
      </span>
      <input type="checkbox" role="switch" className="ot-switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}
