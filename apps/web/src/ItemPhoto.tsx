import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Camera, ImageOff, X } from 'lucide-react';
import type { ItemType } from '@foodlog/contracts';
import { api } from './api';
import { ErrorNote } from './components';
import { tr } from './i18n';

/** Small square thumbnail for list rows; tapping it opens the photo full screen. */
export function PhotoThumb({ url, alt }: { url: string; alt: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {/* A span, not a button: list rows are often buttons or links themselves. */}
      <span
        role="button"
        tabIndex={0}
        className="fl-thumb"
        aria-label={tr('Показати фото')}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
      >
        <img src={url} alt={alt} loading="lazy" />
      </span>
      {open && <PhotoViewer url={url} alt={alt} onClose={() => setOpen(false)} />}
    </>
  );
}

export function PhotoViewer({
  url,
  alt,
  onClose,
}: {
  url: string;
  alt: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <div
      className="fl-viewer"
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <img src={url} alt={alt} />
      <button
        type="button"
        className="ot-btn ot-btn--soft ot-btn--icon fl-viewer__close"
        aria-label={tr('Закрити')}
      >
        <X className="ot-icon" />
      </button>
    </div>,
    document.body,
  );
}

/**
 * The person's own photo of a product or dish, e.g. one cookie on a kitchen scale, so they know
 * how much a piece weighs next time. Shows it, and lets them add, replace or remove it.
 */
export function ItemPhoto({
  type,
  id,
  name,
  url: initialUrl,
}: {
  type: ItemType;
  id: string;
  name: string;
  url?: string | undefined;
}) {
  const qc = useQueryClient();
  const [url, setUrl] = useState(initialUrl);
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => setUrl(initialUrl), [initialUrl]);
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['search'] });
    void qc.invalidateQueries({ queryKey: ['myItems'] });
    void qc.invalidateQueries({ queryKey: ['dish', id] });
  };
  const upload = useMutation({
    mutationFn: (file: File) => api.setPhoto(type, id, file),
    onSuccess: (r) => {
      setUrl(r.photoUrl);
      refresh();
    },
  });
  const remove = useMutation({
    mutationFn: () => api.removePhoto(type, id),
    onSuccess: () => {
      setUrl(undefined);
      refresh();
    },
  });
  const busy = upload.isPending || remove.isPending;
  const pick = () => input.current?.click();

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) upload.mutate(file);
        }}
      />
      {url ? (
        <div className="fl-photo">
          <button
            type="button"
            className="fl-photo__img"
            aria-label={tr('Показати фото')}
            onClick={() => setOpen(true)}
          >
            <img src={url} alt={name} />
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              className="ot-btn ot-btn--soft ot-btn--sm"
              disabled={busy}
              onClick={pick}
            >
              <Camera className="ot-icon" />
              {upload.isPending ? tr('Завантажую фото…') : tr('Змінити фото')}
            </button>
            <button
              type="button"
              className="ot-btn ot-btn--ghost ot-btn--sm"
              disabled={busy}
              onClick={() => confirm(tr('Видалити фото?')) && remove.mutate()}
            >
              <ImageOff className="ot-icon" />
              {tr('Видалити фото')}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="ot-btn ot-btn--soft ot-btn--sm self-start"
          disabled={busy}
          onClick={pick}
        >
          <Camera className="ot-icon" />
          {upload.isPending ? tr('Завантажую фото…') : tr('Додати фото')}
        </button>
      )}
      {!url && !upload.isPending && (
        <span className="ot-hint">
          {tr(
            'Наприклад, одне печиво на вагах: наступного разу одразу видно, скільки грамів записати.',
          )}
        </span>
      )}
      <ErrorNote error={upload.error ?? remove.error} />
      {open && url && <PhotoViewer url={url} alt={name} onClose={() => setOpen(false)} />}
    </div>
  );
}
